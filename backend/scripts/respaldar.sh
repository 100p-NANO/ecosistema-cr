#!/usr/bin/env bash
# Copia de seguridad cifrada, con retención.
#
# ⛔ Una copia que nunca se restauró no es una copia: es un archivo. Por eso
#    este script tiene un hermano, `restaurar.sh`, y la verificación de
#    entrega exige que la restauración se haya EJECUTADO, con fecha.
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
DESTINO="${CASAROCA_RESPALDOS:-$HOME/.casaroca-respaldos}"
RETENCION_DIAS="${CASAROCA_RETENCION_DIAS:-30}"
mkdir -p "$DESTINO"

SELLO="$(date +%Y%m%d-%H%M%S)"
ARCHIVO="$DESTINO/casaroca-$SELLO.dump"

echo "· volcando $PGDATABASE"
pg_dump -d "$PGDATABASE" -Fc -Z 6 -f "$ARCHIVO"

# ⛔ El volcado lleva datos N3 y N4 en claro: se cifra SIEMPRE antes de
#    salir de la máquina. La llave no vive aquí.
if [[ -n "${CASAROCA_LLAVE_RESPALDO:-}" ]]; then
  echo "· cifrando"
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
    -in "$ARCHIVO" -out "$ARCHIVO.enc" -pass env:CASAROCA_LLAVE_RESPALDO
  rm -f "$ARCHIVO"
  ARCHIVO="$ARCHIVO.enc"
else
  echo "⚠️  CASAROCA_LLAVE_RESPALDO no está definida: la copia queda SIN CIFRAR."
  echo "    En producción esto no se permite (ver docs/RUNBOOK.md)."
  [[ "${NODE_ENV:-}" == "production" ]] && { echo "⛔ producción sin llave: se aborta"; rm -f "$ARCHIVO"; exit 1; }
fi

TAM=$(du -h "$ARCHIVO" | cut -f1)
echo "· $ARCHIVO ($TAM)"

echo "· limpiando copias de más de $RETENCION_DIAS días"
find "$DESTINO" -name 'casaroca-*.dump*' -mtime +"$RETENCION_DIAS" -print -delete || true

psql -d "$PGDATABASE" -q -c "INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
  VALUES ('respaldo', '$PGDATABASE', jsonb_build_object('archivo','$(basename "$ARCHIVO")','tamano','$TAM'));" || true

echo "✔ copia tomada. ⛔ Una copia sin restauración probada no cuenta: corra restaurar.sh al menos una vez al mes."
