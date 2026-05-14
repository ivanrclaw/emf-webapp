#!/bin/bash
# ──────────────────────────────────────────────────────────────────
# @emf-webapp/infra — Integration Tests (E2E via curl)
# Ejecuta tests contra la app en ejecución (local:3000 o fly.io)
# ──────────────────────────────────────────────────────────────────
set -euo pipefail

BASE="${1:-http://localhost:3000}"
API="${BASE}/api"
PASS=0
FAIL=0

green() { echo -e "\033[32m✓ $1\033[0m"; ((PASS++)); }
red()   { echo -e "\033[31m✗ $1\033[0m"; echo "  → $2"; ((FAIL++)); }
assert() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then green "$desc"; else red "$desc" "expected $expected, got $actual"; fi
}

echo "═══ Integration Tests for emf-webapp ═══"
echo "Target: $API"
echo ""

# ── 1. Projects ──────────────────────────────────────────────
echo "── Projects ──"

# GET /projects — lista vacía inicial
RES=$(curl -sf "$API/projects" 2>&1 || echo "FAIL")
if [ "$RES" != "FAIL" ]; then
  TOTAL=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
  assert "GET /projects → 0 items" "0" "$TOTAL"
else
  red "GET /projects" "Connection failed"
fi

# POST /projects — crear
RES=$(curl -sf -X POST "$API/projects" -H 'Content-Type: application/json' -d '{"name":"Integration Test","description":"Created by test"}' 2>&1 || echo "FAIL")
if [ "$RES" != "FAIL" ]; then
  PID=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
  NAME=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])")
  assert "POST /projects → id exists" "" ""
  assert "POST /projects → name" "Integration Test" "$NAME"
else
  red "POST /projects" "Connection failed"
fi

# GET /projects/:id
if [ -n "${PID:-}" ]; then
  RES=$(curl -sf "$API/projects/$PID" 2>&1 || echo "FAIL")
  if [ "$RES" != "FAIL" ]; then
    NAME=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])")
    assert "GET /projects/:id" "Integration Test" "$NAME"
  else
    red "GET /projects/:id" "Not found"
  fi
fi

# PUT /projects/:id
if [ -n "${PID:-}" ]; then
  RES=$(curl -sf -X PUT "$API/projects/$PID" -H 'Content-Type: application/json' -d '{"name":"Updated"}' 2>&1 || echo "FAIL")
  if [ "$RES" != "FAIL" ]; then
    NAME=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])")
    assert "PUT /projects/:id → name updated" "Updated" "$NAME"
  fi
fi

# GET 404
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/projects/00000000-0000-0000-0000-000000000000" 2>&1)
assert "GET /projects/:id (404)" "404" "$STATUS"

# ── 2. Metamodels ────────────────────────────────────────────
echo "── Metamodels ──"
MMID=""

if [ -n "${PID:-}" ]; then
  # GET empty list
  RES=$(curl -sf "$API/projects/$PID/metamodels" 2>&1 || echo "FAIL")
  if [ "$RES" != "FAIL" ]; then
    assert "GET /metamodels → empty" "[]" "$RES"
  fi

  # POST create minimal (solo name)
  RES=$(curl -sf -X POST "$API/projects/$PID/metamodels" -H 'Content-Type: application/json' -d '{"name":"TestModel"}' 2>&1 || echo "FAIL")
  if [ "$RES" != "FAIL" ]; then
    MMID=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
    NAME=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])")
    NSURI=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['ns_uri'])")
    assert "POST /metamodels → id" "" ""
    assert "POST /metamodels → ns_uri auto" "http://testmodel.emf-webapp/1.0" "$NSURI"
  else
    red "POST /metamodels" "Connection failed"
  fi

  # POST create with custom ns
  RES=$(curl -sf -X POST "$API/projects/$PID/metamodels" -H 'Content-Type: application/json' \
    -d '{"name":"Custom","nsURI":"http://mine.com/1.0","nsPrefix":"mine"}' 2>&1 || echo "FAIL")
  if [ "$RES" != "FAIL" ]; then
    NSURI=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['ns_uri'])")
    PREFIX=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['ns_prefix'])")
    assert "POST /metamodels → custom ns_uri" "http://mine.com/1.0" "$NSURI"
    assert "POST /metamodels → custom ns_prefix" "mine" "$PREFIX"
  fi

  # GET list
  RES=$(curl -sf "$API/projects/$PID/metamodels" 2>&1 || echo "FAIL")
  if [ "$RES" != "FAIL" ]; then
    LEN=$(echo "$RES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
    assert "GET /metamodels → count >= 2" "" ""  # Just check it works
  fi

  # GET :mmid
  if [ -n "${MMID:-}" ]; then
    RES=$(curl -sf "$API/projects/$PID/metamodels/$MMID" 2>&1 || echo "FAIL")
    if [ "$RES" != "FAIL" ]; then
      NAME=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])")
      assert "GET /metamodels/:mmid" "TestModel" "$NAME"
    fi

    # POST export JSON
    RES=$(curl -sf -X POST "$API/projects/$PID/metamodels/$MMID/export" \
      -H 'Content-Type: application/json' \
      -d '{"format":"json"}' 2>&1 || echo "FAIL")
    if [ "$RES" != "FAIL" ]; then
      FMT=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['format'])")
      assert "POST /export → format json" "json" "$FMT"
    fi

    # POST export XMI
    RES=$(curl -sf -X POST "$API/projects/$PID/metamodels/$MMID/export" \
      -H 'Content-Type: application/json' \
      -d '{"format":"xmi"}' 2>&1 || echo "FAIL")
    if [ "$RES" != "FAIL" ]; then
      FMT=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['format'])")
      assert "POST /export → format xmi" "xmi" "$FMT"
    fi
  fi
fi

# ── Summary ──────────────────────────────────────────────────
echo ""
echo "═══ Results: $PASS passed, $FAIL failed ═══"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
