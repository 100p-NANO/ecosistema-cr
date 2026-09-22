#!/usr/bin/env bash
# =====================================================================
# PUESTO AISLADO DE UN AGENTE · su base, su API y sus pantallas
#
# Cada agente trabaja en su propio puesto <n>: la base cr_e2e_<nn> (copia de
# una plantilla), la API en el puerto 3500+n y las pantallas en 5500+n. Así
# ninguno pisa los datos ni el limitador de otro.
#
#   slot.sh <n> start [plantilla]   copia la plantilla (cr_e2e_base) si la base no existe y levanta API y pantallas
#   slot.sh <n> stop                baja API y pantallas; la base queda
#   slot.sh <n> reset [plantilla]   baja todo, borra la base y la vuelve a copiar
#   slot.sh <n> token <persona>     token de acceso de esa persona contra la API del puesto
#   slot.sh <n> sql "<consulta>"    SQL como administrador en la base del puesto (salida -At)
#   slot.sh <n> env                 puertos, base y direcciones
#
# ⛔ No compila la API ni toca casaroca_dev: la API compilada la deja lista
#    quien organiza, antes de lanzar a los agentes.
# =====================================================================
set -uo pipefail
E2E="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$HOME/Desktop/CasaRoca/ecosistema-cr"
[ $# -ge 1 ] || { sed -n 2,17p "$0"; exit 1; }
n=$((10#$1)); N=$(printf '%02d' "$n"); ACC="${2:-env}"; [ $# -ge 2 ] && shift 2 || shift 1
DB="cr_e2e_$N"; API_PORT=$((3500+n)); FRONT_PORT=$((5500+n)); DIR="$E2E/slots/$N"
export PGHOST=/tmp PGPORT=5433
export PATH="$HOME/Applications/Postgres.app/Contents/Versions/16/bin:$PATH"
mkdir -p "$DIR"

adm() { local base="$1"; shift; psql -U postgres -d "$base" -v ON_ERROR_STOP=1 -qAt "$@"; }
existe() { adm postgres -c "SELECT 1 FROM pg_database WHERE datname='$1'" | grep -q 1; }

bajar() {
  for f in api front; do
    [ -f "$DIR/$f.pid" ] && kill "$(cat "$DIR/$f.pid")" 2>/dev/null
    rm -f "$DIR/$f.pid"
  done
  for p in $API_PORT $FRONT_PORT; do
    pid=$(lsof -nP -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)
    [ -n "$pid" ] && kill $pid 2>/dev/null
  done
  true
}

copiar() {
  local plantilla="${1:-cr_e2e_base}"
  existe "$plantilla" || { echo "⛔ no existe la plantilla $plantilla"; exit 1; }
  if ! existe "$DB"; then
    for intento in 1 2 3 4 5; do
      adm postgres -c "CREATE DATABASE $DB TEMPLATE $plantilla" 2>"$DIR/copia.err" && break
      # Dos puestos copiando la misma plantilla a la vez: se reintenta.
      python3 -c 'import time; time.sleep(1.5)'
    done
    existe "$DB" || { echo "⛔ no se pudo copiar $plantilla: $(cat "$DIR/copia.err")"; exit 1; }
  fi
}

subir() {
  copiar "${1:-cr_e2e_base}"
  bajar
  ( cd "$RAIZ/backend/api" && \
    PGDATABASE=$DB PGUSER=casaroca_api_dev PGPASSWORD=dev PORT=$API_PORT \
    APP_JWT_SECRETO=secreto-de-laboratorio-solo-para-esta-prueba-000 APP_LLAVE_N4=llave-solo-de-desarrollo \
    PG_POZO_NEGOCIO=4 PG_POZO_AUTH=2 PG_POZO_SALUD=1 \
    CORS_ORIGENES="http://127.0.0.1:$FRONT_PORT,http://localhost:$FRONT_PORT" \
    nohup node dist/src/main.js > "$DIR/api.log" 2>&1 & echo $! > "$DIR/api.pid" )
  nohup python3 "$E2E/servir-front.py" "$FRONT_PORT" "$API_PORT" "$RAIZ/frontend" > "$DIR/front.log" 2>&1 &
  echo $! > "$DIR/front.pid"
  if curl -s -o /dev/null --retry 40 --retry-delay 1 --retry-connrefused "http://127.0.0.1:$API_PORT/salud"; then
    ambiente
  else
    echo "⛔ la API del puesto $N no respondió. Últimas líneas del registro:"; tail -20 "$DIR/api.log"; exit 1
  fi
}

ambiente() {
  echo "PUESTO=$N BASE=$DB"
  echo "API=http://127.0.0.1:$API_PORT"
  echo "PANTALLAS=http://127.0.0.1:$FRONT_PORT   (app: /index.html · consola: /master/ · portal: /portal/)"
  echo "REGISTROS=$DIR/api.log"
}

case "$ACC" in
  start) subir "${1:-}" ;;
  stop)  bajar; echo "puesto $N abajo (la base $DB queda)" ;;
  reset) bajar; adm postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB'" >/dev/null
         adm postgres -c "DROP DATABASE IF EXISTS $DB"; subir "${1:-}" ;;
  token) [ -n "${1:-}" ] || { echo "uso: slot.sh $N token <persona_id>"; exit 1; }
         API="http://127.0.0.1:$API_PORT" PGDATABASE=$DB node "$RAIZ/backend/scripts/token-para.js" "$1" | tail -1 ;;
  sql)   adm "$DB" -c "$1" ;;
  env)   ambiente ;;
  *) sed -n 2,17p "$0"; exit 1 ;;
esac
