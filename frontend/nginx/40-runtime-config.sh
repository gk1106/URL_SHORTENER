#!/bin/sh
set -eu
# jq safely escapes public deployment values. No credentials belong in this file.
jq -n \
  --arg api "$API_BASE_URL" \
  --arg issuer "$OIDC_URL" \
  --arg realm "$OIDC_REALM" \
  --arg client "$OIDC_CLIENT_ID" \
  --argjson registration "${REGISTRATION_ENABLED:-false}" \
  '{apiBaseUrl: $api, registrationEnabled: $registration, oidc: {url: $issuer, realm: $realm, clientId: $client}}' \
  > /usr/share/nginx/html/assets/config.json
