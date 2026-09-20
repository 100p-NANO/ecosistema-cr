#!/usr/bin/env bash
# LA COMPUERTA. Lo que tiene que estar en verde para entregar, desplegar o
# fusionar. Es lo que corre la integración continua, y es lo mismo que puede
# correr cualquiera en su máquina antes de pedir revisión.
set -uo pipefail
source "$(dirname "$0")/entorno.sh"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

fallos=(); ok() { echo "  ✔ $1"; }; mal() { echo "  ✖ $1"; fallos+=("$1"); }

echo "══ 1 · La base se levanta desde cero"
"$RAIZ/scripts/arrancar.sh" >/dev/null 2>&1
if "$RAIZ/scripts/migrar.sh" >/tmp/cr-migrar.log 2>&1; then ok "migraciones y semillas aplicadas en base limpia"
else mal "la migración desde cero falla (ver /tmp/cr-migrar.log)"; fi

echo "══ 2 · Invariantes de la base"
if "$RAIZ/scripts/probar.sh" --rapido >/tmp/cr-probar.log 2>&1; then
  ok "$(grep -o 'TODOS LOS BANCOS EN VERDE.*' /tmp/cr-probar.log | head -1)"
else mal "hay bancos en rojo: $(grep -o 'BANCOS EN ROJO:.*' /tmp/cr-probar.log | head -1)"; fi

echo "══ 3 · La API compila"
if ( cd "$RAIZ/api" && npm run build >/tmp/cr-build.log 2>&1 ); then ok "compila sin errores de tipo"
else mal "la API no compila (ver /tmp/cr-build.log)"; fi

echo "══ 4 · Autenticación de punta a punta"
if "$RAIZ/scripts/probar-auth.sh" >/tmp/cr-auth.log 2>&1; then
  ok "$(grep -o 'pasan: [0-9]* · fallan: [0-9]*.*' /tmp/cr-auth.log | head -1)"
else mal "la autenticación tiene invariantes rotas (ver /tmp/cr-auth.log)"; fi

echo "══ 5 · La especificación no se ha quedado atrás"
cp "$RAIZ/api/openapi.yaml" /tmp/cr-openapi-antes.yaml 2>/dev/null || true
if node "$RAIZ/scripts/generar-openapi.js" >/tmp/cr-openapi.log 2>&1; then
  if diff -q /tmp/cr-openapi-antes.yaml "$RAIZ/api/openapi.yaml" >/dev/null 2>&1; then
    ok "openapi.yaml al día con las rutas reales"
  else mal "openapi.yaml desactualizado: corra scripts/generar-openapi.js y versione el resultado"; fi
  sin=$(grep -c 'no tiene descripcion' "$RAIZ/api/openapi.yaml" || true)
  [[ "$sin" == "0" ]] && ok "todas las rutas descritas" || mal "$sin ruta(s) sin descripción en la especificación"
else mal "no se pudo generar la especificación"; fi

echo "══ 6 · Secretos fuera del repositorio"
patron='(APP_JWT_SECRETO|APP_LLAVE_N4|PGPASSWORD|CASAROCA_LLAVE_RESPALDO)[[:space:]]*=[[:space:]]*["'"'"']?[A-Za-z0-9._-]{12,}'
if grep -rInE "$patron" "$RAIZ" --include='*.ts' --include='*.js' --include='*.sh' --include='*.yaml' --include='*.yml' \
     2>/dev/null | grep -v node_modules | grep -v '/dist/' | grep -viE 'desarrollo|laboratorio|ejemplo|no-usar|example' | head -5; then
  mal "hay algo que parece un secreto escrito en el repositorio"
else ok "ningún secreto con pinta de real versionado"; fi

echo "══ 7 · Ninguna tabla legible sin política"
FUGAS=$(psql -d "$PGDATABASE" -qtA -c "SELECT count(*) FROM plataforma.v_control_rls WHERE veredicto LIKE 'FUGA%';" 2>/dev/null || echo '?')
[[ "$FUGAS" == "0" ]] && ok "0 fugas de lectura" || mal "$FUGAS tabla(s) legibles sin política ni registro"

echo "══ 8 · Particiones con colchón"
EST=$(psql -d "$PGDATABASE" -qtA -c "SELECT string_agg(tabla||':'||estado,' ') FROM plataforma.v_salud_particiones;" 2>/dev/null || echo '?')
if [[ "$EST" == *"HUECO"* || "$EST" == *"CRITICO"* ]]; then mal "particiones: $EST"; else ok "particiones: $EST"; fi

echo "══ 9 · La restauración se ejecutó de verdad"
EVID="$RAIZ/docs/EVIDENCIA-restauracion.txt"
if [[ -f "$EVID" ]] && [[ -n "$(find "$EVID" -mtime -45 2>/dev/null)" ]]; then
  ok "última restauración: $(grep 'RESTAURACION EJECUTADA' "$EVID" | tail -1 | sed 's/^RESTAURACION EJECUTADA · //')"
else mal "no hay restauración ejecutada en los últimos 45 días (corra scripts/respaldar.sh y scripts/restaurar.sh)"; fi

echo
echo "════════════════════════════════════════════════════════"
if [[ ${#fallos[@]} -eq 0 ]]; then
  echo "  VERIFICACIÓN COMPLETA EN VERDE · se puede entregar"
  echo "════════════════════════════════════════════════════════"; exit 0
else
  echo "  ${#fallos[@]} COMPUERTA(S) EN ROJO:"
  for f in "${fallos[@]}"; do echo "    · $f"; done
  echo "  No se entrega, no se fusiona y no se despliega."
  echo "════════════════════════════════════════════════════════"; exit 1
fi
