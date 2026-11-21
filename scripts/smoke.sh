#!/usr/bin/env bash
# Smoke test for Fynk staging deployment (HU-032 / HU-033).
# Verifies ALB endpoints, the Banco Demo portal login redirect, Keycloak discovery,
# and the HTTP to HTTPS redirect.
set -euo pipefail

DOMAIN="${1:-fynk.club}"
API_URL="https://api.${DOMAIN}"
AUTH_URL="https://auth.${DOMAIN}"
BANK_URL="https://bancodemo.${DOMAIN}"

echo "========================================="
echo "Running Fynk Staging Smoke Tests for: $DOMAIN"
echo "========================================="

check_status() {
  local name="$1"
  local url="$2"
  local expected="$3"
  echo -n "[SMOKE] Checking $name ($url)... "
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "$url" || true)
  if [ "$code" = "$expected" ]; then
    echo "OK ($code)"
  else
    echo "FAILED (Expected $expected, got $code)"
    return 1
  fi
}

# Passes when the URL answers 302 and its Location starts with the expected prefix.
# Only the status code is printed: the Location carries state, nonce and PKCE values.
check_redirect() {
  local name="$1"
  local url="$2"
  local prefix="$3"
  echo -n "[SMOKE] Checking $name ($url)... "
  local out code location
  out=$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" --connect-timeout 10 --max-time 15 "$url" || true)
  code="${out%% *}"
  location="${out#* }"
  if [ "$code" = "302" ] && [[ "$location" == "$prefix"* ]]; then
    echo "OK (302 -> login)"
  else
    echo "FAILED (Expected 302 to $prefix, got $code)"
    return 1
  fi
}

echo "1. Testing ALB & Core Service Health..."
check_status "fynk-api liveness" "${API_URL}/healthz" "200"
check_status "bank-simulator liveness" "${BANK_URL}/healthz" "200"
# The portal logs in through the banco-demo realm, so an anonymous visit is sent to Keycloak.
check_redirect "bank-simulator portal login redirect" "${BANK_URL}/portal" \
  "${AUTH_URL}/realms/banco-demo/protocol/openid-connect/auth?"

echo "2. Testing Keycloak OIDC Well-Known Configuration..."
check_status "keycloak discovery" "${AUTH_URL}/realms/fynk/.well-known/openid-configuration" "200"
check_status "banco-demo realm discovery" "${AUTH_URL}/realms/banco-demo/.well-known/openid-configuration" "200"

echo "3. Testing HTTP -> HTTPS 301 Redirect (HU-032)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "http://api.${DOMAIN}/healthz" || true)
if [ "$HTTP_CODE" = "301" ]; then
  echo "OK (HTTP redirected to HTTPS with 301)"
else
  echo "FAILED (Expected 301, got $HTTP_CODE)"
  exit 1
fi

echo "========================================="
echo "All smoke tests PASSED successfully!"
echo "========================================="
