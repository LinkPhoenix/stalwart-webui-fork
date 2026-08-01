#Requires -Version 5.1
<#
.SYNOPSIS
  Populates the disposable Stalwart test server with sample Users, Groups,
  Mailing Lists, and Roles, so each admin panel screen has something to
  click through and test against.

.DESCRIPTION
  Local development only. Run after scripts/dev-server-init.ps1.
  Idempotent: does nothing if the seed users already exist. Only a fresh
  volume (`docker compose down -v`) clears this data.
#>
param(
  [string]$ApiBaseUrl = "http://localhost:8080"
)

$ErrorActionPreference = 'Stop'

$DevAdminAccount = "devadmin@example.org"
$DevAdminSecret = "DevAdminPass123!"

$creds = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("$($DevAdminAccount):$($DevAdminSecret)"))
$authHeader = @{ Authorization = "Basic $creds" }

function Invoke-Jmap($body) {
  Invoke-RestMethod -Uri "$ApiBaseUrl/jmap/" -Method Post -ContentType "application/json" -Headers $authHeader -Body ($body | ConvertTo-Json -Depth 10 -Compress) -TimeoutSec 15
}

try {
  $session = Invoke-RestMethod -Uri "$ApiBaseUrl/jmap/session" -Headers $authHeader -TimeoutSec 15
} catch {
  throw "Could not reach $ApiBaseUrl as $DevAdminAccount. Run scripts/dev-server-init.ps1 first."
}
$accountId = $session.primaryAccounts.'urn:stalwart:jmap'

$existing = Invoke-Jmap @{
  using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
  methodCalls = @(, @("x:Account/query", @{ accountId = $accountId; filter = @{ text = "alice" } }, "0"))
}
if ($existing.methodResponses[0][1].ids.Count -gt 0) {
  Write-Host "Seed data already present (found 'alice'), skipping. Use 'docker compose down -v' + dev-server-init.ps1 to start fresh."
  return
}

$domainResult = Invoke-Jmap @{
  using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
  methodCalls = @(, @("x:Domain/query", @{ accountId = $accountId }, "0"))
}
$domainId = $domainResult.methodResponses[0][1].ids[0]

Write-Host "Creating groups..."
$groupsResult = Invoke-Jmap @{
  using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
  methodCalls = @(, @("x:Account/set", @{
        accountId = $accountId
        create    = @{
          g_eng = @{ "@type" = "Group"; name = "engineering"; domainId = $domainId; description = "Engineering team" }
          g_mkt = @{ "@type" = "Group"; name = "marketing"; domainId = $domainId; description = "Marketing team" }
        }
      }, "0"))
}
$groupEngId = $groupsResult.methodResponses[0][1].created.g_eng.id
$groupMktId = $groupsResult.methodResponses[0][1].created.g_mkt.id

Write-Host "Creating users..."
$usersResult = Invoke-Jmap @{
  using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
  methodCalls = @(, @("x:Account/set", @{
        accountId = $accountId
        create    = @{
          u_alice = @{
            "@type"        = "User"; name = "alice"; domainId = $domainId; description = "Alice Smith"
            roles          = @{ "@type" = "User" }
            credentials    = @{ "0" = @{ "@type" = "Password"; secret = "AlicePass123!" } }
            memberGroupIds = @{ $groupEngId = $true }
          }
          u_bob   = @{
            "@type"        = "User"; name = "bob"; domainId = $domainId; description = "Bob Jones"
            roles          = @{ "@type" = "User" }
            credentials    = @{ "0" = @{ "@type" = "Password"; secret = "BobPass123!" } }
            memberGroupIds = @{ $groupEngId = $true; $groupMktId = $true }
          }
          u_carol = @{
            "@type"        = "User"; name = "carol"; domainId = $domainId; description = "Carol Diaz"
            roles          = @{ "@type" = "Admin" }
            credentials    = @{ "0" = @{ "@type" = "Password"; secret = "CarolPass123!" } }
            memberGroupIds = @{ $groupMktId = $true }
          }
        }
      }, "0"))
}
$userAliceId = $usersResult.methodResponses[0][1].created.u_alice.id

Write-Host "Adding an alias to alice (for the Aliases column)..."
Invoke-Jmap @{
  using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
  methodCalls = @(, @("x:Account/set", @{
        accountId = $accountId
        update    = @{ $userAliceId = @{ aliases = @{ "0" = @{ name = "a.smith"; domainId = $domainId } } } }
      }, "0"))
} | Out-Null

Write-Host "Creating mailing lists..."
Invoke-Jmap @{
  using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
  methodCalls = @(, @("x:MailingList/set", @{
        accountId = $accountId
        create    = @{
          m_news    = @{
            name = "newsletter"; domainId = $domainId; description = "Company newsletter"
            recipients = @{ "alice@example.org" = $true; "bob@example.org" = $true; "carol@example.org" = $true }
          }
          m_support = @{
            name = "support"; domainId = $domainId; description = "Support queue"
            recipients = @{ "bob@example.org" = $true }
          }
        }
      }, "0"))
} | Out-Null

Write-Host "Creating roles..."
Invoke-Jmap @{
  using       = @("urn:ietf:params:jmap:core", "urn:stalwart:jmap")
  methodCalls = @(, @("x:Role/set", @{
        accountId = $accountId
        create    = @{
          r_support = @{ description = "Support Agent"; enabledPermissions = @{ authenticate = $true; emailSend = $true; emailReceive = $true } }
          r_audit   = @{ description = "Read-only Auditor"; enabledPermissions = @{ authenticate = $true } }
        }
      }, "0"))
} | Out-Null

Write-Host "Done. Seeded:"
Write-Host "  Users:         alice@example.org / AlicePass123!  (User role, in engineering, 1 alias)"
Write-Host "                 bob@example.org / BobPass123!      (User role, in engineering + marketing)"
Write-Host "                 carol@example.org / CarolPass123!  (Admin role, in marketing)"
Write-Host "  Groups:        engineering, marketing"
Write-Host "  Mailing lists: newsletter@example.org, support@example.org"
Write-Host "  Roles:         Support Agent, Read-only Auditor"
