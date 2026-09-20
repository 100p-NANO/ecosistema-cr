#!/usr/bin/env bash
# Restaura una copia EN UNA BASE APARTE y la verifica de verdad.
#
# ⛔ Restaurar sobre la base viva para "probar" es cómo se pierde una base.
#    Esto restaura en `casaroca_restaurada`, cuenta filas, corre el banco de
#    invariantes contra ella y deja el resultado con fecha y duración en
#    docs/EVIDENCIA-restauracion.txt. Eso es lo que pide la compuerta G7.
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DESTINO="${CASAROCA_RESPALDOS:-$HOME/.casaroca-respaldos}"
BASE_PRUEBA="casaroca_restaurada"

ARCHIVO="${1:-$(ls -t "$DESTINO"/casaroca-*.dump* 2>/dev/null | head -1)}"
[[ -f "${ARCHIVO:-}" ]] || { echo "⛔ No hay copia que restaurar en $DESTINO"; exit 1; }

INICIO=$(date +%s)
echo "· restaurando $(basename "$ARCHIVO") en $BASE_PRUEBA"

TRABAJO="$ARCHIVO"
if [[ "$ARCHIVO" == *.enc ]]; then
  [[ -n "${CASAROCA_LLAVE_RESPALDO:-}" ]] || { echo "⛔ La copia está cifrada y falta CASAROCA_LLAVE_RESPALDO"; exit 1; }
  TRABAJO="/tmp/casaroca-restaurar-$$.dump"
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in "$ARCHIVO" -out "$TRABAJO" -pass env:CASAROCA_LLAVE_RESPALDO
  trap 'rm -f "$TRABAJO"' EXIT
fi

psql -d postgres -q -c "DROP DATABASE IF EXISTS $BASE_PRUEBA;"
psql -d postgres -q -c "CREATE DATABASE $BASE_PRUEBA;"
pg_restore -d "$BASE_PRUEBA" --no-owner --no-privileges "$TRABAJO" 2>&1 | grep -v "^pg_restore: warning" || true

FIN_T=$(date +%s); DUR=$((FIN_T-INICIO))

echo "· verificando lo restaurado"
CONTEOS=$(psql -d "$BASE_PRUEBA" -qtA -c "
  SELECT 'personas='||(SELECT count(*) FROM nucleo.personas)
       ||' sedes='||(SELECT count(*) FROM org.sedes)
       ||' membresias='||(SELECT count(*) FROM nucleo.membresias_sede)
       ||' aportes='||(SELECT count(*) FROM aportes.aportes)
       ||' auditoria='||(SELECT count(*) FROM plataforma.auditoria);")

VEREDICTO="OK"
psql -d "$BASE_PRUEBA" -v ON_ERROR_STOP=1 -f "$RAIZ/db/tests/catalogos_no_vacios.sql" >/dev/null 2>&1 || VEREDICTO="CATALOGOS VACIOS"
FUGAS=$(psql -d "$BASE_PRUEBA" -qtA -c "SELECT count(*) FROM plataforma.v_control_rls WHERE veredicto LIKE 'FUGA%';" 2>/dev/null || echo "?")
[[ "$FUGAS" != "0" ]] && VEREDICTO="$VEREDICTO · FUGAS=$FUGAS"

EVID="$RAIZ/docs/EVIDENCIA-restauracion.txt"
{
  echo "════════════════════════════════════════════════════"
  echo "RESTAURACION EJECUTADA · $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "  archivo:   $(basename "$ARCHIVO")"
  echo "  duracion:  ${DUR}s"
  echo "  conteos:   $CONTEOS"
  echo "  fugas RLS: $FUGAS"
  echo "  veredicto: $VEREDICTO"
} | tee -a "$EVID"

psql -d postgres -q -c "DROP DATABASE IF EXISTS $BASE_PRUEBA;"
echo "✔ evidencia en docs/EVIDENCIA-restauracion.txt"
[[ "$VEREDICTO" == "OK" ]] || exit 1
