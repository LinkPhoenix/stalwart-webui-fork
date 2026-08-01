#!/usr/bin/env bash
# Local development only. Populates the disposable Stalwart test server
# (docker-compose.yml) with sample data across Users, Groups, Mailing Lists,
# and Roles, so each admin panel screen has something to click through and
# test against. Run after scripts/dev-server-init.sh.
#
# Idempotent: does nothing if the seed users already exist (re-running
# scripts/dev-server-init.sh does not wipe this data; only a fresh volume
# via `docker compose down -v` does).
set -euo pipefail

API_BASE_URL="${1:-http://localhost:8080}"
DEVADMIN_ACCOUNT="devadmin@example.org"
DEVADMIN_SECRET="DevAdminPass123!"

jmap() {
  curl -sf --compressed -u "$DEVADMIN_ACCOUNT:$DEVADMIN_SECRET" \
    -X POST -H "Content-Type: application/json" -d "$1" "$API_BASE_URL/jmap/"
}

extract_id() {
  # $1 = JSON response, $2 = create-id key (e.g. "u1")
  printf '%s' "$1" | grep -o "\"$2\":{\"id\":\"[^\"]*\"" | head -1 | grep -o '"id":"[^"]*"' | cut -d'"' -f4
}

SESSION=$(curl -sf --compressed -u "$DEVADMIN_ACCOUNT:$DEVADMIN_SECRET" "$API_BASE_URL/jmap/session") || {
  echo "Could not reach $API_BASE_URL as $DEVADMIN_ACCOUNT. Run scripts/dev-server-init.sh first." >&2
  exit 1
}
ACCOUNT_ID=$(printf '%s' "$SESSION" | grep -o '"urn:stalwart:jmap":"[^"]*"' | cut -d'"' -f4)

EXISTING=$(jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:Account/query\",{\"accountId\":\"$ACCOUNT_ID\",\"filter\":{\"text\":\"alice\"}},\"0\"]]}")
if printf '%s' "$EXISTING" | grep -q '"ids":\["'; then
  echo "Seed data already present (found 'alice'), skipping. Use 'docker compose down -v' + dev-server-init.sh to start fresh."
  exit 0
fi

DOMAIN_RESULT=$(jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:Domain/query\",{\"accountId\":\"$ACCOUNT_ID\"},\"0\"]]}")
DOMAIN_ID=$(printf '%s' "$DOMAIN_RESULT" | grep -o '"ids":\["[^"]*"' | cut -d'"' -f4)

echo "Creating groups..."
GROUPS_RESULT=$(jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:Account/set\",{\"accountId\":\"$ACCOUNT_ID\",\"create\":{
  \"g_eng\":{\"@type\":\"Group\",\"name\":\"engineering\",\"domainId\":\"$DOMAIN_ID\",\"description\":\"Engineering team\"},
  \"g_mkt\":{\"@type\":\"Group\",\"name\":\"marketing\",\"domainId\":\"$DOMAIN_ID\",\"description\":\"Marketing team\"}
}},\"0\"]]}")
GROUP_ENG_ID=$(extract_id "$GROUPS_RESULT" g_eng)
GROUP_MKT_ID=$(extract_id "$GROUPS_RESULT" g_mkt)

echo "Creating users..."
USERS_RESULT=$(jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:Account/set\",{\"accountId\":\"$ACCOUNT_ID\",\"create\":{
  \"u_alice\":{\"@type\":\"User\",\"name\":\"alice\",\"domainId\":\"$DOMAIN_ID\",\"description\":\"Alice Smith\",\"roles\":{\"@type\":\"User\"},\"credentials\":{\"0\":{\"@type\":\"Password\",\"secret\":\"AlicePass123!\"}},\"memberGroupIds\":{\"$GROUP_ENG_ID\":true}},
  \"u_bob\":{\"@type\":\"User\",\"name\":\"bob\",\"domainId\":\"$DOMAIN_ID\",\"description\":\"Bob Jones\",\"roles\":{\"@type\":\"User\"},\"credentials\":{\"0\":{\"@type\":\"Password\",\"secret\":\"BobPass123!\"}},\"memberGroupIds\":{\"$GROUP_ENG_ID\":true,\"$GROUP_MKT_ID\":true}},
  \"u_carol\":{\"@type\":\"User\",\"name\":\"carol\",\"domainId\":\"$DOMAIN_ID\",\"description\":\"Carol Diaz\",\"roles\":{\"@type\":\"Admin\"},\"credentials\":{\"0\":{\"@type\":\"Password\",\"secret\":\"CarolPass123!\"}},\"memberGroupIds\":{\"$GROUP_MKT_ID\":true}}
}},\"0\"]]}")
USER_ALICE_ID=$(extract_id "$USERS_RESULT" u_alice)

echo "Adding an alias to alice (for the Aliases column)..."
jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:Account/set\",{\"accountId\":\"$ACCOUNT_ID\",\"update\":{\"$USER_ALICE_ID\":{\"aliases\":{\"0\":{\"name\":\"a.smith\",\"domainId\":\"$DOMAIN_ID\"}}}}},\"0\"]]}" > /dev/null

echo "Creating mailing lists..."
jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:MailingList/set\",{\"accountId\":\"$ACCOUNT_ID\",\"create\":{
  \"m_news\":{\"name\":\"newsletter\",\"domainId\":\"$DOMAIN_ID\",\"description\":\"Company newsletter\",\"recipients\":{\"alice@example.org\":true,\"bob@example.org\":true,\"carol@example.org\":true}},
  \"m_support\":{\"name\":\"support\",\"domainId\":\"$DOMAIN_ID\",\"description\":\"Support queue\",\"recipients\":{\"bob@example.org\":true}}
}},\"0\"]]}" > /dev/null

echo "Creating roles..."
jmap "{\"using\":[\"urn:ietf:params:jmap:core\",\"urn:stalwart:jmap\"],\"methodCalls\":[[\"x:Role/set\",{\"accountId\":\"$ACCOUNT_ID\",\"create\":{
  \"r_support\":{\"description\":\"Support Agent\",\"enabledPermissions\":{\"authenticate\":true,\"emailSend\":true,\"emailReceive\":true}},
  \"r_audit\":{\"description\":\"Read-only Auditor\",\"enabledPermissions\":{\"authenticate\":true}}
}},\"0\"]]}" > /dev/null

echo "Done. Seeded:"
echo "  Users:         alice@example.org / AlicePass123!  (User role, in engineering, 1 alias)"
echo "                 bob@example.org / BobPass123!      (User role, in engineering + marketing)"
echo "                 carol@example.org / CarolPass123!  (Admin role, in marketing)"
echo "  Groups:        engineering, marketing"
echo "  Mailing lists: newsletter@example.org, support@example.org"
echo "  Roles:         Support Agent, Read-only Auditor"
