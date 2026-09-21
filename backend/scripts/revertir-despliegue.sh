#!/usr/bin/env bash
# =====================================================================
# Reversión del CÓDIGO en menos de cinco minutos (caja 10, punto 9).
#
#   revertir-despliegue.sh <staging|produccion> [--plan] [--a <revisión>]
#
# Pasa el 100 % del tráfico a la revisión anterior de Cloud Run, comprueba
# que esa revisión esté SANA (/salud/detalle) y lo deja escrito. Con --plan
# solo dice qué haría.
#
# ⛔ Lo que NO revierte: el esquema. Las migraciones van hacia adelante y
#    se escriben compatibles con la versión anterior del código (primero se
#    agrega, después se usa, al final se quita). Si una migración rompió esa
#    regla, esto no basta: ver docs/RUNBOOK.md, «Reversión».
# =====================================================================
set -euo pipefail
AMBIENTE="${1:-}"; shift || true
case "$AMBIENTE" in staging|produccion) ;; *) sed -n '4,15p' "$0"; exit 2 ;; esac
PLAN=0; DESTINO=""
while [ $# -gt 0 ]; do
  case "$1" in --plan) PLAN=1 ;; --a) DESTINO="$2"; shift ;; *) echo "✗ opción desconocida: $1" >&2; exit 2 ;; esac
  shift
done
PROYECTO="casaroca-${AMBIENTE/produccion/prod}"
REGION="${CASAROCA_REGION:-us-east1}"
command -v gcloud >/dev/null || { echo "⛔ Falta gcloud: sin él no se toca el tráfico." >&2; exit 1; }

echo "· revisiones de casaroca-api en $PROYECTO ($REGION)"
REVISIONES=$(gcloud run revisions list --service casaroca-api --project "$PROYECTO" --region "$REGION" \
               --format='value(metadata.name)' --sort-by='~metadata.creationTimestamp' --limit 5)
ACTUAL=$(gcloud run services describe casaroca-api --project "$PROYECTO" --region "$REGION" \
           --format='value(status.traffic[0].revisionName)')
echo "$REVISIONES" | sed 's/^/    /'
echo "· hoy recibe el tráfico: ${ACTUAL:-desconocida}"
if [ -z "$DESTINO" ]; then
  DESTINO=$(echo "$REVISIONES" | grep -v "^${ACTUAL}\$" | head -1)
fi
[ -n "$DESTINO" ] || { echo "⛔ No hay una revisión anterior a la cual volver." >&2; exit 1; }
echo "· se volverá a: $DESTINO"
URL=$(gcloud run services describe casaroca-api --project "$PROYECTO" --region "$REGION" --format='value(status.url)')

if [ "$PLAN" = 1 ]; then
  echo "(plan) gcloud run services update-traffic casaroca-api --project $PROYECTO --region $REGION --to-revisions $DESTINO=100"
  exit 0
fi

INICIO=$(date +%s)
gcloud run services update-traffic casaroca-api --project "$PROYECTO" --region "$REGION" --to-revisions "$DESTINO=100"
echo "· comprobando que la revisión de destino está sana"
for i in 1 2 3 4 5 6; do
  if SALUD=$(curl -sf "$URL/salud/detalle") && echo "$SALUD" | grep -q '"estado":"sano"'; then break; fi
  sleep 10
done
echo "$SALUD" | grep -q '"estado":"sano"' || { echo "⛔ $DESTINO recibe el tráfico pero NO está sana: $SALUD" >&2; exit 1; }
FIN=$(date +%s)
REGISTRO="$(cd "$(dirname "$0")/.." && pwd)/docs/EVIDENCIA-reversiones.txt"
printf 'REVERSIÓN · %s · %s · de %s a %s · %ss · sana\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$AMBIENTE" \
  "${ACTUAL:-?}" "$DESTINO" "$((FIN - INICIO))" >> "$REGISTRO"
echo "✔ Tráfico en $DESTINO en $((FIN - INICIO)) s. Quedó escrito en docs/EVIDENCIA-reversiones.txt."
echo "  Ahora: abrir un incidente en docs/RUNBOOK.md y decir por qué se revirtió."
