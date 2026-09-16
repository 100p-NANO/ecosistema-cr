#!/usr/bin/env bash
# =====================================================================
# Prueba de humo de la API. Comprueba lo que de verdad importa:
# que el MISMO endpoint conteste distinto según quién pregunte, y que
# el dinero solo se mueva con firma válida.
#
# Requiere la API corriendo (scripts/arrancar-api.sh) y la base sembrada.
# =====================================================================
set -uo pipefail
source "$(dirname "$0")/entorno.sh"
A="${API:-http://127.0.0.1:3010}/api/v1"
ok=0; fallo=0
comprobar() { # nombre, esperado, obtenido
  if [ "$2" = "$3" ]; then printf '  ✅ %-52s %s\n' "$1" "$3"; ok=$((ok+1));
  else printf '  🔴 %-52s esperaba %s y dio %s\n' "$1" "$2" "$3"; fallo=$((fallo+1)); fi
}

DG=$(psql -d "$PGDATABASE" -qAt -c "SELECT persona_id FROM identidad.asignaciones WHERE alcance_tipo='organizacion' LIMIT 1")
LID=$(psql -d "$PGDATABASE" -qAt -c "SELECT persona_id FROM identidad.asignaciones WHERE rol='LIDER_GRUPO' AND (vigente_hasta IS NULL OR vigente_hasta>=CURRENT_DATE) LIMIT 1")

echo "── alcance: el mismo endpoint, dos personas"
comprobar "Dirección General ve toda la red" "true" \
  "$(curl -s -H "X-Persona-Id: $DG" $A/sesion/yo | python3 -c 'import json,sys;print(str(json.load(sys.stdin)["alcance"]["todaLaRed"]).lower())')"
if [ -n "$LID" ]; then
  comprobar "Un líder NO ve toda la red" "false" \
    "$(curl -s -H "X-Persona-Id: $LID" $A/sesion/yo | python3 -c 'import json,sys;print(str(json.load(sys.stdin)["alcance"]["todaLaRed"]).lower())')"
  comprobar "Un líder ve UNA iglesia" "1" \
    "$(curl -s -H "X-Persona-Id: $LID" $A/organizacion/sedes | python3 -c 'import json,sys;print(len(json.load(sys.stdin)))')"
fi
comprobar "Sin identidad la API no contesta" "401" \
  "$(curl -s -o /dev/null -w '%{http_code}' $A/sesion/yo)"

echo "── catálogos"
comprobar "Ministerios del catálogo" "27" \
  "$(curl -s -H "X-Persona-Id: $DG" $A/organizacion/ministerios | python3 -c 'import json,sys;print(len(json.load(sys.stdin)))')"

echo "── pasarela: el dinero solo se mueve con firma"
REF="HUMO-$(date +%s)"
psql -d "$PGDATABASE" -qAt -c "
INSERT INTO aportes.pasarela_transacciones (referencia,sede_id,tipo,fondo_id,monto,pagador_nombre)
SELECT '$REF',(SELECT id FROM org.sedes LIMIT 1),'diezmo',
       (SELECT id FROM aportes.fondos WHERE codigo='DIEZMOS'),100000,'Humo';" >/dev/null
CUERPO="{\"reference_sale\":\"$REF\",\"state_pol\":\"4\",\"TX_VALUE\":\"100000.00\",\"currency\":\"COP\",\"transaction_id\":\"HUMO-TX\",\"sign\":\"invalida\"}"
comprobar "Firma inválida NO mueve dinero" "firma_invalida" \
  "$(curl -s -X POST -H 'Content-Type: application/json' -d "$CUERPO" $A/aportes/pasarela/webhook | python3 -c 'import json,sys;print(json.load(sys.stdin).get("motivo",""))')"
comprobar "…pero el aviso queda guardado como prueba" "1" \
  "$(psql -d "$PGDATABASE" -qAt -c "SELECT count(*) FROM aportes.pasarela_eventos WHERE referencia='$REF'")"

echo
printf '  %s pasan · %s fallan\n' "$ok" "$fallo"
[ "$fallo" -eq 0 ] || exit 1
