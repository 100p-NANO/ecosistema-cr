#!/usr/bin/env bash
# Despliegue a un ambiente. Aburrido y reversible, que es como tiene que ser.
#
# ⛔ NO despliega si la verificación no está en verde. Esa es la única razón
#    por la que este script existe en vez de un `gcloud run deploy` a mano.
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
AMBIENTE="${1:-}"

case "$AMBIENTE" in
  staging|produccion) ;;
  *) echo "Uso: $0 <staging|produccion>"; exit 2 ;;
esac

PROYECTO="casaroca-${AMBIENTE/produccion/prod}"
REGION="${CASAROCA_REGION:-us-east1}"
VERSION="$(git -C "$RAIZ/.." rev-parse --short HEAD 2>/dev/null || date +%Y%m%d-%H%M)"

echo "════════════════════════════════════════════════════"
echo "  DESPLIEGUE · $AMBIENTE · $PROYECTO · versión $VERSION"
echo "════════════════════════════════════════════════════"

echo "══ 1 · Verificación completa"
"$RAIZ/scripts/verificar.sh" || { echo "⛔ La verificación está en rojo. No se despliega."; exit 1; }

if [[ "$AMBIENTE" == "produccion" ]]; then
  DIA=$(date +%u)
  if [[ "$DIA" == "7" ]]; then
    echo "⛔ Es domingo. El domingo es el pico de uso de las 36 sedes: no se despliega."
    echo "   Si es una emergencia, exporte CASAROCA_FORZAR_DOMINGO=si y quede por escrito."
    [[ "${CASAROCA_FORZAR_DOMINGO:-no}" == "si" ]] || exit 1
  fi
  echo "══ 2 · Copia de seguridad antes de tocar producción"
  "$RAIZ/scripts/respaldar.sh"
fi

command -v gcloud >/dev/null || { echo "⛔ falta gcloud. Ver docs/INFRA.md"; exit 1; }

echo "══ 3 · Construir la imagen"
gcloud builds submit "$RAIZ/api" \
  --project "$PROYECTO" \
  --tag "$REGION-docker.pkg.dev/$PROYECTO/imagenes/api:$VERSION"

echo "══ 4 · Migrar la base (solo lo nuevo)"
"$RAIZ/scripts/migrar-produccion.sh" "$AMBIENTE"

echo "══ 5 · Desplegar la revisión SIN tráfico"
gcloud run deploy casaroca-api \
  --project "$PROYECTO" --region "$REGION" \
  --image "$REGION-docker.pkg.dev/$PROYECTO/imagenes/api:$VERSION" \
  --no-traffic --tag "v$VERSION" \
  --set-env-vars "NODE_ENV=production,APP_VERSION=$VERSION"

echo "══ 6 · Comprobar la revisión nueva antes de darle tráfico"
URL=$(gcloud run services describe casaroca-api --project "$PROYECTO" --region "$REGION" \
        --format='value(status.traffic[0].url)' 2>/dev/null || true)
if [[ -n "$URL" ]]; then
  curl -sf "$URL/salud" >/dev/null || { echo "⛔ la revisión nueva no responde en /salud"; exit 1; }
fi

echo "══ 7 · Pasar el tráfico"
gcloud run services update-traffic casaroca-api \
  --project "$PROYECTO" --region "$REGION" --to-latest

echo
echo "✔ Desplegado $VERSION en $AMBIENTE"
echo "⛔ REVERSIÓN, si algo sale mal (menos de 5 minutos):"
echo "   gcloud run services update-traffic casaroca-api --project $PROYECTO --region $REGION --to-revisions <revision-anterior>=100"
