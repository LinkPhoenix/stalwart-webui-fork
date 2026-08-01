#Requires -Version 5.1
<#
.SYNOPSIS
  One-time setup for the disposable Stalwart test server from
  docker-compose.yml: completes the bootstrap wizard, creates a real
  "devadmin" account, and sets the default OAuth access token lifetime.

.DESCRIPTION
  Local development only. Requires the dev container to be running
  ('npm run dev:server'). The STALWART_RECOVERY_ADMIN account is
  break-glass only and always issues fixed 1h OAuth tokens regardless of
  server config, so dev-token.ps1 authenticates as "devadmin" instead,
  created here. Idempotent: safe to re-run; does nothing if the server
  already left bootstrap mode.
#>
param(
  [string]$ApiBaseUrl = "http://localhost:8080"
)

$ErrorActionPreference = 'Stop'

$RecoveryAccount = "admin@example.org"
$RecoverySecret = "c8321iEscHDy0GWV"
$DevDomain = "example.org"
$DevHostname = "mail.example.org"
$DevAdminName = "devadmin"
$DevAdminSecret = "DevAdminPass123!"
$DefaultTokenExpiryMs = 10800000 # 3 hours

$recoveryCreds = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("$($RecoveryAccount):$($RecoverySecret)"))
$authHeader = @{ Authorization = "Basic $recoveryCreds" }

function Invoke-Jmap($body) {
  Invoke-RestMethod -Uri "$ApiBaseUrl/jmap/" -Method Post -ContentType "application/json" -Headers $authHeader -Body ($body | ConvertTo-Json -Depth 10 -Compress) -TimeoutSec 15
}

Write-Host "Waiting for $ApiBaseUrl to be reachable..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    Invoke-RestMethod -Uri "$ApiBaseUrl/jmap/session" -Headers $authHeader -TimeoutSec 5 | Out-Null
    $ready = $true
    break
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $ready) { throw "Server did not become reachable at $ApiBaseUrl" }

$session = Invoke-RestMethod -Uri "$ApiBaseUrl/jmap/session" -Headers $authHeader -TimeoutSec 15
$accountId = $session.primaryAccounts.'urn:stalwart:jmap'

$queryResult = Invoke-Jmap @{
  using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
  methodCalls = @(, @("x:Domain/query", @{ accountId = $accountId }, "0"))
}
$alreadyBootstrapped = -not ($queryResult.methodResponses[0][1].type -eq "forbidden")

if ($alreadyBootstrapped) {
  Write-Host "Server already bootstrapped, skipping setup. (Use 'docker compose down -v; npm run dev:server' to start fresh.)"
  return
}

Write-Host "Completing server bootstrap (domain: $DevDomain, no TLS certificate request)..."
Invoke-Jmap @{
  using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
  methodCalls = @(, @("x:Bootstrap/set", @{
        accountId = $accountId
        update    = @{ singleton = @{ defaultDomain = $DevDomain; serverHostname = $DevHostname; requestTlsCertificate = $false } }
      }, "0"))
} | Out-Null

Write-Host "Restarting the container to apply bootstrap config (one-time only)..."
docker compose restart stalwart | Out-Null
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    Invoke-RestMethod -Uri "$ApiBaseUrl/jmap/session" -Headers $authHeader -TimeoutSec 5 | Out-Null
    $ready = $true
    break
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $ready) { throw "Server did not come back up after restart" }

$domainResult = Invoke-Jmap @{
  using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
  methodCalls = @(, @("x:Domain/query", @{ accountId = $accountId }, "0"))
}
$domainId = $domainResult.methodResponses[0][1].ids[0]

Write-Host "Creating devadmin account ($DevAdminName@$DevDomain)..."
$createResult = Invoke-Jmap @{
  using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
  methodCalls = @(, @("x:Account/set", @{
        accountId = $accountId
        create    = @{ u1 = @{ "@type" = "User"; name = $DevAdminName; domainId = $domainId; roles = @{ "@type" = "Admin" } } }
      }, "0"))
}
$devAdminId = $createResult.methodResponses[0][1].created.u1.id

Invoke-Jmap @{
  using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
  methodCalls = @(, @("x:Account/set", @{
        accountId = $accountId
        update    = @{ $devAdminId = @{ credentials = @{ "0" = @{ "@type" = "Password"; secret = $DevAdminSecret } } } }
      }, "0"))
} | Out-Null

Write-Host "Setting default OAuth access token lifetime to 3 hours..."
Invoke-Jmap @{
  using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
  methodCalls = @(, @("x:OidcProvider/set", @{
        accountId = $accountId
        update    = @{ singleton = @{ accessTokenExpiry = $DefaultTokenExpiryMs } }
      }, "0"))
} | Out-Null
try {
  Invoke-Jmap @{
    using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
    methodCalls = @(, @("x:Action/set", @{ accountId = $accountId; create = @{ a1 = @{ "@type" = "ReloadSettings" } } }, "0"))
  } | Out-Null
} catch {}

Write-Host "Done. $DevAdminName@$DevDomain / $DevAdminSecret is ready - run scripts/dev-token.ps1 to get a token."
