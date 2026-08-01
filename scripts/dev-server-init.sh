#!/usr/bin/env bash
# Local development only. One-time setup for the disposable Stalwart test
# server from docker-compose.yml: completes the server's bootstrap wizard,
# creates a real "devadmin" account (used by dev-token.sh/.ps1 — the
# STALWART_RECOVERY_ADMIN account is break-glass only and always issues
# fixed 1h OAuth tokens regardless of server config), and sets the default
# OAuth access token lifetime to 3 hours.
#
# Idempotent: safe to re-run; does nothing if the server already left
# bootstrap mode. Run this once after `npm run dev:server` on a fresh
# volume (or after `docker compose down -v`).
set -euo pipefail

API_BASE_URL="${1:-http://localhost:8080}"
RECOVERY_ACCOUNT="admin@example.org"
RECOVERY_SECRET="c8321iEscHDy0GWV"
DEV_DOMAIN="example.org"
DEV_HOSTNAME="mail.example.org"
DEVADMIN_NAME="devadmin"
DEVADMIN_SECRET="DevAdminPass123!"
DEFAULT_TOKEN_EXPIRY_MS=10800000 # 3 hours

jmap() {
  curl -sf --compressed -u "$RECOVERY_ACCOUNT:$RECOVERY_SECRET" \
    -X POST -H "Content-Type: application/json" -d "$1" "$API_BASE_URL/jmap/"
}

echo "Waiting for $API_BASE_URL to be reachable..."
for _ in $(seq 1 30); do
  curl -sf -o /dev/null -u "$RECOVERY_ACCOUNT:$RECOVERY_SECRET" "$API_BASE_URL/jmap/session" && break
  sleep 1
done

SESSION=$(curl -sf --compressed -u "$RECOVERY_ACCOUNT:$RECOVERY_SECRET" "$API_BASE_URL/jmap/session")
ACCOUNT_ID=$(printf '%s' "$SESSION" | grep -o '"urn:stalwart:jmap":"[^"]*"' | cut -d'"' -f4)

QUERY_RESULT=$(jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:Domain/query\",{\"accountId\":\"$ACCOUNT_ID\"},\"0\"]]}")
if ! printf '%s' "$QUERY_RESULT" | grep -q '"forbidden"'; then
  echo "Server already bootstrapped, skipping setup. (Use 'docker compose down -v && npm run dev:server' to start fresh.)"
else
  echo "Completing server bootstrap (domain: $DEV_DOMAIN, no TLS certificate request)..."
  jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:Bootstrap/set\",{\"accountId\":\"$ACCOUNT_ID\",\"update\":{\"singleton\":{\"defaultDomain\":\"$DEV_DOMAIN\",\"serverHostname\":\"$DEV_HOSTNAME\",\"requestTlsCertificate\":false}}},\"0\"]]}" > /dev/null

  echo "Restarting the container to apply bootstrap config (one-time only)..."
  docker compose restart stalwart > /dev/null
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null -u "$RECOVERY_ACCOUNT:$RECOVERY_SECRET" "$API_BASE_URL/jmap/session" && break
    sleep 1
  done

  DOMAIN_RESULT=$(jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:Domain/query\",{\"accountId\":\"$ACCOUNT_ID\"},\"0\"]]}")
  DOMAIN_ID=$(printf '%s' "$DOMAIN_RESULT" | grep -o '"ids":\["[^"]*"' | cut -d'"' -f4)

  echo "Creating devadmin account ($DEVADMIN_NAME@$DEV_DOMAIN)..."
  CREATE_RESULT=$(jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:Account/set\",{\"accountId\":\"$ACCOUNT_ID\",\"create\":{\"u1\":{\"@type\":\"User\",\"name\":\"$DEVADMIN_NAME\",\"domainId\":\"$DOMAIN_ID\",\"roles\":{\"@type\":\"Admin\"}}}},\"0\"]]}")
  DEVADMIN_ID=$(printf '%s' "$CREATE_RESULT" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

  jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:Account/set\",{\"accountId\":\"$ACCOUNT_ID\",\"update\":{\"$DEVADMIN_ID\":{\"credentials\":{\"0\":{\"@type\":\"Password\",\"secret\":\"$DEVADMIN_SECRET\"}}}}},\"0\"]]}" > /dev/null

  echo "Setting default OAuth access token lifetime to 3 hours..."
  jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:OidcProvider/set\",{\"accountId\":\"$ACCOUNT_ID\",\"update\":{\"singleton\":{\"accessTokenExpiry\":$DEFAULT_TOKEN_EXPIRY_MS}}},\"0\"]]}" > /dev/null
  jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:Action/set\",{\"accountId\":\"$ACCOUNT_ID\",\"create\":{\"a1\":{\"@type\":\"ReloadSettings\"}}},\"0\"]]}" > /dev/null 2>&1 || true

  echo "Done. devadmin@$DEV_DOMAIN / $DEVADMIN_SECRET is ready — run scripts/dev-token.sh to get a token."
fi
