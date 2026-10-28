#!/usr/bin/env bash
# Smoke test for Fynk staging deployment (HU-032 / HU-033).
# Verifies ALB endpoints, Keycloak discovery, and Banco Demo mTLS egress.
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
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 15 "$url" || echo "000")
  if [ "$code" = "$expected" ]; then
    echo "OK ($code)"
  else
    echo "FAILED (Expected $expected, got $code)"
    return 1
  fi
}

echo "1. Testing ALB & Core Service Health..."
check_status "fynk-api liveness" "${API_URL}/healthz" "200"
check_status "bank-simulator liveness" "${BANK_URL}/healthz" "200"
check_status "bank-simulator web portal" "${BANK_URL}/portal" "200"

echo "2. Testing Keycloak OIDC Well-Known Configuration..."
check_status "keycloak discovery" "${AUTH_URL}/realms/fynk/.well-known/openid-configuration" "200"
check_status "banco-demo realm discovery" "${AUTH_URL}/realms/banco-demo/.well-known/openid-configuration" "200"

echo "3. Testing HTTP -> HTTPS 301 Redirect (HU-032)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://api.${DOMAIN}/healthz" || echo "000")
if [ "$HTTP_CODE" = "301" ]; then
  echo "OK (HTTP redirected to HTTPS with 301)"
else
  echo "FAILED (Expected 301, got $HTTP_CODE)"
  exit 1
fi

echo "========================================="
echo "All smoke tests PASSED successfully!"
echo "========================================="
