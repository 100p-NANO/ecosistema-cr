#!/bin/sh
# ============================================================
# CASA ROCA · SELLAR LA CACHÉ DEL PROTOTIPO
#
# Por qué existe, con fecha: el 11 de septiembre de 2026 Daniel vio
# «todas las pestañas activadas» en un panel al que solo se le había
# otorgado un módulo. El código era correcto: lo que corría en su
# navegador era una copia vieja de `pastor.html`, guardada antes de que
# naciera el puente de permisos. El HTML no llevaba sello de versión, así
# que el navegador lo dio por bueno y nunca volvió a pedirlo.
#
# Un permiso que no llega por caché es indistinguible de un permiso roto,
# y se diagnostica igual de caro. Este script pone a TODOS los `?v=` de
# todos los HTML el mismo número, sacado del fichero más reciente de
# `assets/`. Se corre después de tocar cualquier js o css.
# ============================================================
set -e
cd "$(dirname "$0")"

SELLO=$(find assets -type f \( -name '*.js' -o -name '*.css' \) -exec stat -f '%m' {} + | sort -n | tail -1)
[ -n "$SELLO" ] || { echo "No encontré assets que sellar."; exit 1; }

for f in *.html; do
  perl -pi -e "s/\?v=[0-9A-Za-z._-]+/?v=$SELLO/g" "$f"
done

echo "Sellado con v=$SELLO  ($(date -r "$SELLO" '+%Y-%m-%d %H:%M:%S'))"
echo "Recuerde: en el navegador, recarga dura (cmd+shift+R) la primera vez."
