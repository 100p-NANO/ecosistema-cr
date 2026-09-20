#!/usr/bin/env bash
# Prueba de punta a punta de la autenticación: levanta la API, crea una
# cuenta de laboratorio, corre el banco y baja todo. Base limpia por corrida.
set -uo pipefail
source "$(dirname "$0")/entorno.sh"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
export PGUSER_ADMIN="$PGUSER"

USUARIO="prueba.auth@casaroca.org"
CLAVE="una frase larga de prueba 2026"

echo "· compilando la API"
( cd "$RAIZ/api" && npm run build >/dev/null 2>&1 ) || { echo "⛔ no compila"; exit 1; }

echo "· creando la cuenta de laboratorio"
PGUSER=postgres node "$RAIZ/scripts/crear-cuenta.js" "Director General" "$USUARIO" "$CLAVE" >/dev/null 2>&1 || true

echo "· levantando la API"
export APP_JWT_SECRETO="${APP_JWT_SECRETO:-secreto-de-laboratorio-solo-para-esta-prueba-000}"
export APP_LLAVE_N4="${APP_LLAVE_N4:-llave-solo-de-desarrollo}"
export PGUSER=casaroca_api_dev
# ⛔ Puerto propio y comprobado. La primera version usaba el 3000 fijo: si
#    ya habia una API viva ahi, el proceso nuevo fallaba al abrir el puerto,
#    la comprobacion de salud respondia (la vieja), y el banco corria contra
#    OTRO proceso, con su propio limite de peticiones ya gastado y su propia
#    base. Diez pruebas en rojo y ninguna era un fallo del sistema.
export PORT="${PORT:-3210}"
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "⛔ PUERTO OCUPADO: ya hay algo escuchando en :$PORT."
  echo "   Cierrelo o exporte PORT con otro puerto. No se corre contra un proceso ajeno."
  exit 1
fi
node "$RAIZ/api/dist/src/main.js" > /tmp/casaroca-api-prueba.log 2>&1 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT

for i in $(seq 1 40); do
  curl -sf "http://127.0.0.1:$PORT/salud" >/dev/null 2>&1 && break
  sleep 0.25
done

if ! curl -sf "http://127.0.0.1:$PORT/salud" >/dev/null 2>&1; then
  echo "⛔ la API no levantó. Log:"; tail -20 /tmp/casaroca-api-prueba.log; exit 1
fi

echo "· corriendo el banco"
PRUEBA_USUARIO="$USUARIO" PRUEBA_CLAVE="$CLAVE" API_BASE="http://127.0.0.1:$PORT" \
  node "$RAIZ/api/dist/test/auth.e2e.js"
rc=$?
kill $API_PID 2>/dev/null
exit $rc
