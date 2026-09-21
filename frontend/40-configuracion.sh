#!/bin/sh
# Escribe la configuración de ejecución del frontend al arrancar el
# contenedor, desde las variables de entorno que pone Cloud Run.
# ⛔ Sin CASAROCA_API el contenedor NO arranca: un frontend que llama a
#    127.0.0.1 en producción parece vivo y no funciona para nadie.
set -eu
API="${CASAROCA_API:-}"
case "$API" in
  https://*|http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "⛔ CASAROCA_API vacía o sin https ('$API'): el frontend no sabría a qué API llamar." >&2; exit 1 ;;
esac
echo "$API" | grep -Eq '^https?://[A-Za-z0-9.:/_-]+$' || { echo "⛔ CASAROCA_API con caracteres raros: '$API'" >&2; exit 1; }
VERSION="$(printf '%s' "${CASAROCA_VERSION:-sin-version}" | tr -cd 'A-Za-z0-9._-')"
printf 'window.CASAROCA_API = "%s";\nwindow.CASAROCA_VERSION = "%s";\n' "$API" "$VERSION" > /tmp/casaroca-config.js
echo "· configuración escrita: API $API · versión $VERSION"
