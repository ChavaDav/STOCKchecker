#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Script de prueba completa de la Stock Market API
# ─────────────────────────────────────────────────────────────────────────────

BASE_URL="http://localhost:3001/api"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

pass=0
fail=0

test_endpoint() {
  local method=$1
  local url=$2
  local data=$3
  local expected_status=$4
  local description=$5
  local auth_header=$6

  local args="-s -w \n%{http_code}"
  args="$args -X $method"
  
  if [ -n "$auth_header" ]; then
    args="$args -H \"Authorization: Bearer $auth_header\""
  fi
  
  if [ -n "$data" ]; then
    args="$args -H \"Content-Type: application/json\" -d '$data'"
  fi

  local response
  response=$(eval curl $args "$url")
  local body=$(echo "$response" | head -n -1)
  local status=$(echo "$response" | tail -n 1)

  if [ "$status" = "$expected_status" ]; then
    echo -e "  ${GREEN}✓${NC} $description (HTTP $status)" >&2
    ((pass++))
  else
    echo -e "  ${RED}✗${NC} $description (esperado: $expected_status, recibido: $status)" >&2
    echo -e "    Response: $(echo $body | head -c 200)" >&2
    ((fail++))
  fi

  echo "$body"
}

echo -e "\n${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     📈 Stock Market API - Test Suite                 ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}\n"

# ─── 1. Health Check ──────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Health Check${NC}"
HEALTH=$(test_endpoint "GET" "$BASE_URL/health" "" "200" "Health check")
echo ""

# ─── 2. API Info ──────────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ API Info${NC}"
test_endpoint "GET" "$BASE_URL" "" "200" "API info" > /dev/null
echo ""

# ─── 3. Auth - Registro ──────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Autenticación - Registro${NC}"

# Limpiar usuario de prueba anterior si existe
REGISTER_RESP=$(test_endpoint "POST" "$BASE_URL/auth/register" \
  '{"username":"testuser","email":"test@test.com","password":"TestPass1!"}' \
  "201" "Registrar nuevo usuario")

# Validación de password débil
test_endpoint "POST" "$BASE_URL/auth/register" \
  '{"username":"weakuser","email":"weak@test.com","password":"123"}' \
  "400" "Rechazar password débil" > /dev/null

# Email duplicado
test_endpoint "POST" "$BASE_URL/auth/register" \
  '{"username":"testuser2","email":"test@test.com","password":"TestPass2!"}' \
  "409" "Rechazar email duplicado" > /dev/null

echo ""

# ─── 4. Auth - Login ─────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Autenticación - Login${NC}"

LOGIN_RESP=$(test_endpoint "POST" "$BASE_URL/auth/login" \
  '{"email":"test@test.com","password":"TestPass1!"}' \
  "200" "Login exitoso")

TOKEN=$(echo "$LOGIN_RESP" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null)
REFRESH=$(echo "$LOGIN_RESP" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['refreshToken'])" 2>/dev/null)

# Login con credenciales incorrectas
test_endpoint "POST" "$BASE_URL/auth/login" \
  '{"email":"test@test.com","password":"WrongPass1!"}' \
  "401" "Rechazar credenciales incorrectas" > /dev/null

echo ""

# ─── 5. Auth - Perfil ────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Perfil de usuario${NC}"

test_endpoint "GET" "$BASE_URL/auth/me" "" "200" "Obtener perfil" "$TOKEN" > /dev/null

# Sin token
test_endpoint "GET" "$BASE_URL/auth/me" "" "401" "Rechazar sin token" > /dev/null

# Token inválido  
test_endpoint "GET" "$BASE_URL/auth/me" "" "401" "Rechazar token inválido" "invalid_token" > /dev/null

echo ""

# ─── 6. Auth - Refresh Token ─────────────────────────────────────────────────
echo -e "${YELLOW}▸ Refresh Token${NC}"

REFRESH_RESP=$(test_endpoint "POST" "$BASE_URL/auth/refresh" \
  "{\"refreshToken\":\"$REFRESH\"}" \
  "200" "Renovar token")

NEW_TOKEN=$(echo "$REFRESH_RESP" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)
if [ -n "$NEW_TOKEN" ] && [ "$NEW_TOKEN" != "" ]; then
  TOKEN=$NEW_TOKEN
fi

# Reusar refresh token (debe fallar - rotación)
test_endpoint "POST" "$BASE_URL/auth/refresh" \
  "{\"refreshToken\":\"$REFRESH\"}" \
  "401" "Rechazar refresh token reutilizado" > /dev/null

echo ""

# ─── 7. Stocks - Búsqueda ────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Acciones - Búsqueda${NC}"

SEARCH_RESP=$(test_endpoint "GET" "$BASE_URL/stocks/search?q=apple" "" "200" "Buscar 'apple'" "$TOKEN")
echo ""

# ─── 8. Stocks - Cotización ──────────────────────────────────────────────────
echo -e "${YELLOW}▸ Acciones - Cotización${NC}"

QUOTE_RESP=$(test_endpoint "GET" "$BASE_URL/stocks/AAPL" "" "200" "Cotización AAPL" "$TOKEN")
echo ""

# ─── 9. Stocks - Historial ───────────────────────────────────────────────────
echo -e "${YELLOW}▸ Acciones - Historial${NC}"

test_endpoint "GET" "$BASE_URL/stocks/AAPL/history?period=5d&interval=1d" "" "200" \
  "Historial AAPL 5 días" "$TOKEN" > /dev/null

echo ""

# ─── 10. Stocks - Trending ───────────────────────────────────────────────────
echo -e "${YELLOW}▸ Acciones - Trending${NC}"

test_endpoint "GET" "$BASE_URL/stocks/market/trending" "" "200" \
  "Acciones trending" "$TOKEN" > /dev/null

echo ""

# ─── 11. Favoritos ────────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Favoritos${NC}"

test_endpoint "POST" "$BASE_URL/favorites" \
  '{"symbol":"AAPL","name":"Apple Inc."}' \
  "201" "Añadir AAPL a favoritos" "$TOKEN" > /dev/null

test_endpoint "POST" "$BASE_URL/favorites" \
  '{"symbol":"MSFT","name":"Microsoft"}' \
  "201" "Añadir MSFT a favoritos" "$TOKEN" > /dev/null

test_endpoint "POST" "$BASE_URL/favorites" \
  '{"symbol":"AAPL"}' \
  "409" "Rechazar duplicado en favoritos" "$TOKEN" > /dev/null

test_endpoint "GET" "$BASE_URL/favorites" "" "200" \
  "Listar favoritos" "$TOKEN" > /dev/null

test_endpoint "GET" "$BASE_URL/favorites/prices" "" "200" \
  "Precios de favoritos" "$TOKEN" > /dev/null

test_endpoint "DELETE" "$BASE_URL/favorites/MSFT" "" "200" \
  "Eliminar MSFT de favoritos" "$TOKEN" > /dev/null

echo ""

# ─── 12. Alertas ──────────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Alertas${NC}"

ALERT_RESP=$(test_endpoint "POST" "$BASE_URL/alerts" \
  '{"symbol":"AAPL","alertType":"above","targetValue":250}' \
  "201" "Crear alerta AAPL > $250" "$TOKEN")

ALERT_ID=$(echo "$ALERT_RESP" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin).get('alert',{}).get('id',''))" 2>/dev/null)

test_endpoint "POST" "$BASE_URL/alerts" \
  '{"symbol":"AAPL","alertType":"below","targetValue":100}' \
  "201" "Crear alerta AAPL < $100" "$TOKEN" > /dev/null

test_endpoint "GET" "$BASE_URL/alerts" "" "200" \
  "Listar alertas" "$TOKEN" > /dev/null

test_endpoint "GET" "$BASE_URL/alerts?active=true" "" "200" \
  "Listar alertas activas" "$TOKEN" > /dev/null

if [ -n "$ALERT_ID" ] && [ "$ALERT_ID" != "" ]; then
  test_endpoint "PUT" "$BASE_URL/alerts/$ALERT_ID" \
    '{"targetValue":300}' \
    "200" "Modificar alerta" "$TOKEN" > /dev/null

  test_endpoint "DELETE" "$BASE_URL/alerts/$ALERT_ID" "" "200" \
    "Eliminar alerta" "$TOKEN" > /dev/null
fi

test_endpoint "GET" "$BASE_URL/alerts/triggered" "" "200" \
  "Alertas disparadas" "$TOKEN" > /dev/null

# Validación: tipo de alerta inválido
test_endpoint "POST" "$BASE_URL/alerts" \
  '{"symbol":"AAPL","alertType":"invalid","targetValue":100}' \
  "400" "Rechazar tipo de alerta inválido" "$TOKEN" > /dev/null

echo ""

# ─── 13. Auth - Cambio de contraseña ─────────────────────────────────────────
echo -e "${YELLOW}▸ Cambio de contraseña${NC}"

test_endpoint "PUT" "$BASE_URL/auth/me/password" \
  '{"currentPassword":"TestPass1!","newPassword":"NewPass2!"}' \
  "200" "Cambiar contraseña" "$TOKEN" > /dev/null

# Login con nueva contraseña
test_endpoint "POST" "$BASE_URL/auth/login" \
  '{"email":"test@test.com","password":"NewPass2!"}' \
  "200" "Login con nueva contraseña" > /dev/null

echo ""

# ─── 14. Seguridad ────────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Seguridad - Headers${NC}"

HEADERS=$(curl -s -I "$BASE_URL/health")
if echo "$HEADERS" | grep -qi "x-content-type-options: nosniff"; then
  echo -e "  ${GREEN}✓${NC} X-Content-Type-Options: nosniff"
  ((pass++))
else
  echo -e "  ${RED}✗${NC} X-Content-Type-Options header faltante"
  ((fail++))
fi

if echo "$HEADERS" | grep -qi "x-frame-options"; then
  echo -e "  ${GREEN}✓${NC} X-Frame-Options presente"
  ((pass++))
else
  echo -e "  ${RED}✗${NC} X-Frame-Options header faltante"
  ((fail++))
fi

if echo "$HEADERS" | grep -qi "strict-transport-security"; then
  echo -e "  ${GREEN}✓${NC} Strict-Transport-Security presente"
  ((pass++))
else
  echo -e "  ${RED}✗${NC} Strict-Transport-Security header faltante"
  ((fail++))
fi

if ! echo "$HEADERS" | grep -qi "x-powered-by"; then
  echo -e "  ${GREEN}✓${NC} X-Powered-By oculto"
  ((pass++))
else
  echo -e "  ${RED}✗${NC} X-Powered-By visible (debería estar oculto)"
  ((fail++))
fi

echo ""

# ─── Resumen ──────────────────────────────────────────────────────────────────
total=$((pass + fail))
echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
echo -e "  Tests: ${GREEN}$pass pasados${NC} / ${RED}$fail fallidos${NC} / $total total"
echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"

if [ $fail -eq 0 ]; then
  echo -e "\n  ${GREEN}✅ Todos los tests pasaron!${NC}\n"
else
  echo -e "\n  ${YELLOW}⚠️  Algunos tests fallaron (puede ser rate limit de Yahoo)${NC}\n"
fi
