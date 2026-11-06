#!/usr/bin/env bash
# Post-deploy smoke test: checks the running stack end to end through the
# public entry point (nginx), the way a browser reaches it.
#   scripts/smoke-test.sh [base-url]        default: http://localhost:8080
# Also checks sign-in when SMOKE_EMAIL and SMOKE_PASSWORD are set.
# Exits non-zero on the first failure, so it can gate a deploy or CI job.
set -euo pipefail

BASE="${1:-http://localhost:8080}"
BASE="${BASE%/}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass() { printf '  ok    %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1" >&2; exit 1; }

# get <path> [curl args...]: body -> $TMP/body, headers -> $TMP/headers, prints the status
get() {
  local path="$1"; shift
  curl -sS -o "$TMP/body" -D "$TMP/headers" -w '%{http_code}' "$@" "$BASE$path" || echo 000
}

echo "Smoke testing $BASE"

[ "$(get /api/health/live)" = 200 ] && pass "API is live" || fail "GET /api/health/live did not return 200"

[ "$(get /api/health/ready)" = 200 ] && grep -q '"status":"ready"' "$TMP/body" \
  && pass "API is ready (database reachable)" \
  || fail "GET /api/health/ready: $(cat "$TMP/body")"

[ "$(get /)" = 200 ] && grep -q '<div id="root">' "$TMP/body" \
  && pass "web app is served" || fail "GET / did not return the app shell"
grep -qi '^content-security-policy:' "$TMP/headers" \
  && pass "security headers are set" || fail "GET / has no Content-Security-Policy header"

[ "$(get /inventory/reorder)" = 200 ] && grep -q '<div id="root">' "$TMP/body" \
  && pass "deep links fall back to the app" || fail "GET /inventory/reorder did not return the app shell"

[ "$(get /api/auth/me)" = 401 ] \
  && pass "API enforces authentication" || fail "GET /api/auth/me without a session did not return 401"

if [ -n "${SMOKE_EMAIL:-}" ] && [ -n "${SMOKE_PASSWORD:-}" ]; then
  body=$(printf '{"email":"%s","password":"%s"}' "$SMOKE_EMAIL" "$SMOKE_PASSWORD")
  [ "$(get /api/auth/login -H 'Content-Type: application/json' --data "$body" -c "$TMP/jar")" = 200 ] \
    && grep -qi '^set-cookie: erp_session=' "$TMP/headers" \
    && pass "sign-in works" || fail "POST /api/auth/login as $SMOKE_EMAIL failed"
  [ "$(get /api/auth/me -b "$TMP/jar")" = 200 ] \
    && pass "session cookie is accepted" || fail "GET /api/auth/me with the session cookie failed"
else
  echo "  skip  sign-in (set SMOKE_EMAIL and SMOKE_PASSWORD to check it)"
fi

echo "All checks passed."
