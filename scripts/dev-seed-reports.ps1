#Requires -Version 5.1
<#
.SYNOPSIS
  Seeds sample inbound DMARC / TLS / ARF reports via SMTP so the
  report-summary columns can be verified in the admin UI.

.DESCRIPTION
  External reports cannot be created through JMAP ("Reports cannot be
  created"). This script configures ReportSettings + DataRetention, then
  delivers the sample .eml fixtures from the Stalwart test suite over
  SMTP to an existing mailbox listed as an inbound report address.

  Idempotent: skips when any DMARC external report already exists.
  Requires a running local server (npm run dev:server) and
  scripts/dev-server-init.ps1 + scripts/dev-seed.ps1 (for alice@).
#>
param(
  [string]$ApiBaseUrl = "http://localhost:8080",
  [string]$SmtpHost = "127.0.0.1",
  [int]$SmtpPort = 25,
  [string]$ReportFixturesDir = ""
)

$ErrorActionPreference = 'Stop'

if (-not $ReportFixturesDir) {
  $candidate = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "project-rust\stalwart\tests\resources\smtp\reports"
  if (Test-Path $candidate) {
    $ReportFixturesDir = $candidate
  } else {
    throw "Set -ReportFixturesDir to the Stalwart tests/resources/smtp/reports directory (sample .eml files)."
  }
}

$DevAdminAccount = "devadmin@example.org"
$DevAdminSecret = "DevAdminPass123!"
$ReportRcpt = "alice@example.org"

$creds = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("$($DevAdminAccount):$($DevAdminSecret)"))
$authHeader = @{ Authorization = "Basic $creds" }

function Invoke-Jmap($body) {
  Invoke-RestMethod -Uri "$ApiBaseUrl/jmap/" -Method Post -ContentType "application/json" -Headers $authHeader -Body ($body | ConvertTo-Json -Depth 20 -Compress) -TimeoutSec 30
}

function Send-SmtpMessage([string]$Rcpt, [string]$Raw) {
  $client = New-Object System.Net.Sockets.TcpClient
  $client.ReceiveTimeout = 20000
  $client.SendTimeout = 20000
  $client.Connect($SmtpHost, $SmtpPort)
  $stream = $client.GetStream()
  $reader = New-Object System.IO.StreamReader($stream)
  $writer = New-Object System.IO.StreamWriter($stream)
  $writer.NewLine = "`r`n"
  $writer.AutoFlush = $true

  function Read-Reply {
    do {
      $line = $reader.ReadLine()
      if ($null -eq $line) { throw "SMTP connection closed" }
    } while ($line.Length -ge 4 -and $line[3] -eq '-')
    return $line
  }
  function Expect([string]$Prefix, [string]$Cmd) {
    if ($Cmd) { $writer.WriteLine($Cmd) }
    $reply = Read-Reply
    if (-not $reply.StartsWith($Prefix)) { throw "SMTP expected $Prefix, got: $reply" }
    return $reply
  }

  try {
    Expect "220" $null | Out-Null
    Expect "250" "EHLO mail.example.org" | Out-Null
    Expect "250" "MAIL FROM:<noreply@google.com>" | Out-Null
    Expect "250" "RCPT TO:<$Rcpt>" | Out-Null
    Expect "354" "DATA" | Out-Null
    $body = ($Raw -replace "`r?`n", "`r`n")
    if (-not $body.EndsWith("`r`n")) { $body += "`r`n" }
    $body = [regex]::Replace($body, '(?m)^\.', '..')
    $writer.Write($body)
    $writer.WriteLine(".")
    Expect "250" $null | Out-Null
    $writer.WriteLine("QUIT")
  } finally {
    $client.Close()
  }
}

$session = Invoke-RestMethod -Uri "$ApiBaseUrl/jmap/session" -Headers $authHeader -TimeoutSec 15
$accountId = $session.primaryAccounts.'urn:stalwart:jmap'

$existing = Invoke-Jmap @{
  using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
  methodCalls = @(, @("x:DmarcExternalReport/query", @{ accountId = $accountId }, "0"))
}
if ($existing.methodResponses[0][1].ids.Count -gt 0) {
  Write-Host "Sample reports already present, skipping."
  return
}

Write-Host "Configuring report ingestion (DataRetention + ReportSettings)..."
$retention = Invoke-Jmap @{
  using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
  methodCalls = @(, @("x:DataRetention/get", @{ accountId = $accountId; ids = @("singleton") }, "0"))
}
if (-not $retention.methodResponses[0][1].list -or $retention.methodResponses[0][1].list.Count -eq 0) {
  Invoke-Jmap @{
    using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
    methodCalls = @(, @("x:DataRetention/set", @{
          accountId = $accountId
          create    = @{ ret = @{ holdMtaReportsFor = 2592000000 } }
        }, "0"))
  } | Out-Null
} else {
  Invoke-Jmap @{
    using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
    methodCalls = @(, @("x:DataRetention/set", @{
          accountId = $accountId
          update    = @{ singleton = @{ holdMtaReportsFor = 2592000000 } }
        }, "0"))
  } | Out-Null
}

Invoke-Jmap @{
  using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
  methodCalls = @(, @("x:ReportSettings/set", @{
        accountId = $accountId
        update    = @{
          singleton = @{
            inboundReportAddresses  = @{
              $ReportRcpt             = $true
              "devadmin@example.org"  = $true
              "postmaster@*"          = $true
            }
            inboundReportForwarding = $false
          }
        }
      }, "0"))
} | Out-Null

Write-Host "Restarting Stalwart so SMTP picks up report addresses..."
docker restart stalwart-webui-dev | Out-Null
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  try {
    Invoke-RestMethod -Uri "$ApiBaseUrl/jmap/session" -Headers $authHeader -TimeoutSec 3 | Out-Null
    $ready = $true
    break
  } catch {}
}
if (-not $ready) { throw "Server did not come back after restart." }

$files = @("dmarc1.eml", "dmarc2.eml", "tls1.eml", "tls2.eml", "arf1.eml", "arf2.eml")
Write-Host "Delivering sample reports to $ReportRcpt via SMTP..."
foreach ($f in $files) {
  $path = Join-Path $ReportFixturesDir $f
  if (-not (Test-Path $path)) { throw "Missing fixture: $path" }
  Write-Host "  $f"
  Send-SmtpMessage -Rcpt $ReportRcpt -Raw (Get-Content -Raw -Path $path)
}

$ok = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 1
  $q = Invoke-Jmap @{
    using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
    methodCalls = @(
      , @("x:DmarcExternalReport/query", @{ accountId = $accountId }, "0")
      , @("x:TlsExternalReport/query", @{ accountId = $accountId }, "1")
      , @("x:ArfExternalReport/query", @{ accountId = $accountId }, "2")
    )
  }
  $d = $q.methodResponses[0][1].ids.Count
  $t = $q.methodResponses[1][1].ids.Count
  $a = $q.methodResponses[2][1].ids.Count
  if ($d -gt 0 -and $t -gt 0 -and $a -gt 0) {
    Write-Host "Stored reports: DMARC=$d TLS=$t ARF=$a"
    $ok = $true
    break
  }
}
if (-not $ok) { throw "Reports were accepted by SMTP but not stored. Check ReportSettings / DataRetention." }
Write-Host "Done. Open Management > Reports > Inbox in the WebUI."
