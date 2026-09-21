#!/usr/bin/env bash
# ============================================================
# EMPAQUETAR EL SITIO DE DEMOSTRACIÓN (casaroca-system.netlify.app)
#
# Lleva el prototipo de la fase 0, tal cual se publica desde el 15 de
# septiembre, y el SISTEMA CONSTRUIDO en /sistema/: la aplicación de las
# sedes, la consola de la central (/sistema/master/) y el portal del
# congregante (/sistema/portal/), en modo demostración. Datos inventados
# (`frontend/src/demo.js`) y ningún servidor detrás, hasta que la
# infraestructura se aplique.
#
# ⛔ Sale de lo VERSIONADO (git archive), no de la carpeta de trabajo: el
#    paquete nunca lleva un archivo a medio editar, ni uno que no esté en
#    git, ni los `node_modules` de nadie.
# ⛔ No publica nada. Deja el zip; se sube por el navegador en
#    app.netlify.com/projects/casaroca-system/deploys («browse files to
#    upload»), con el visto bueno de quien responde por el sitio.
#
# Uso:  ./scripts/empaquetar-sitio-demo.sh [ruta/del/paquete.zip]
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/../.."
raiz="$PWD"
destino="${1:-$raiz/sitio-demo.zip}"
case "$destino" in /*) ;; *) destino="$raiz/$destino" ;; esac

if ! git diff --quiet HEAD -- fase0-prototipo frontend; then
  echo "⛔ Hay cambios sin confirmar en fase0-prototipo/ o frontend/."
  echo "   El paquete sale de lo versionado: confirme primero o no verá sus cambios."
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git archive HEAD fase0-prototipo frontend | tar -x -C "$tmp"

sitio="$tmp/sitio"
mv "$tmp/fase0-prototipo" "$sitio"
# Lo que sirve para trabajar en el Mac y no para publicar.
rm -f "$sitio"/*.command "$sitio/sellar.sh"

mkdir -p "$sitio/sistema"
cp -R "$tmp/frontend/index.html" "$tmp/frontend/src" "$tmp/frontend/master" "$tmp/frontend/portal" "$sitio/sistema/"
version="demostración · $(git rev-parse --short HEAD)"
cat > "$sitio/sistema/config.js" <<CONFIG
/* Sitio de demostración. Los datos salen de src/demo.js y NO hay API
   detrás: la aplicación lo avisa arriba, en rojo, siempre. Lo genera
   backend/scripts/empaquetar-sitio-demo.sh; no se edita a mano. */
window.CASAROCA_DEMO = true;
window.CASAROCA_API = 'demo';
window.CASAROCA_VERSION = '$version';
CONFIG

# Comprobaciones antes de empaquetar: si una falla, no sale el zip.
for f in index.html master/index.html portal/index.html; do
  [ -f "$sitio/sistema/$f" ] || { echo "⛔ falta sistema/$f"; exit 1; }
  grep -q 'config.js' "$sitio/sistema/$f" || { echo "⛔ sistema/$f no carga config.js"; exit 1; }
done
if grep -rIl --include='*.html' '<script>' "$sitio/sistema" >/dev/null; then
  echo "⛔ hay un <script> en línea en sistema/: la política de contenido lo bloquearía"; exit 1
fi
grep -q '/sistema/' "$sitio/hub.html" || { echo "⛔ el mapa del sistema (hub.html) no enlaza /sistema/"; exit 1; }
grep -q '/sistema/\*' "$sitio/netlify.toml" || { echo "⛔ netlify.toml no trae las cabeceras de /sistema/"; exit 1; }

rm -f "$destino"
(cd "$sitio" && zip -rq "$destino" . -x '*.DS_Store')
echo "Paquete listo: $destino"
echo "  $(unzip -l "$destino" | tail -1 | awk '{print $2}') archivos · $(du -h "$destino" | cut -f1) · versión: $version"
