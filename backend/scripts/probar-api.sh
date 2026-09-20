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
# ⛔ levantar_api exporta PGUSER=casaroca_api_dev (el rol de la aplicacion, con
#    RLS). Las consultas de PREPARACION del banco (buscar a quien suplantar,
#    sembrar un caso) son de administrador: se guarda el usuario de antes.
ADMIN="${PGUSER:-$(whoami)}"
psql_admin() { PGUSER="$ADMIN" psql "$@"; }
source "$(dirname "$0")/api-de-laboratorio.sh"
levantar_api "${PORT:-3211}"

# ⛔ 19 sep 2026 · ESTE BANCO ESTABA MUERTO. Se identificaba con la cabecera
#    `X-Persona-Id`, que se elimino al cerrar el hallazgo H-01, y NO estaba
#    en verificar.sh: si hubiera corrido habria fallado entero, y los README
#    seguian afirmando su resultado. Ahora entra por la puerta de verdad.
tok() { PGUSER="$ADMIN" node "$(dirname "$0")/token-para.js" "$1"; }


ok=0; fallo=0
comprobar() { # nombre, esperado, obtenido
  if [ "$2" = "$3" ]; then printf '  ✅ %-52s %s\n' "$1" "$3"; ok=$((ok+1));
  else printf '  🔴 %-52s esperaba %s y dio %s\n' "$1" "$2" "$3"; fallo=$((fallo+1)); fi
}

DG=$(psql_admin -d "$PGDATABASE" -qAt -c "SELECT persona_id FROM identidad.asignaciones WHERE alcance_tipo='organizacion' LIMIT 1")
# ⛔ 19 sep 2026 · Aqui habia un `if [ -n "$LID" ]` que se saltaba en
#    silencio las DOS comprobaciones de alcance restringido si no existia
#    ningun LIDER_GRUPO: el banco imprimia verde sin haber probado lo unico
#    que de verdad importa (que un lider NO ve toda la red). Y no existia
#    ninguno. Ahora el lider de laboratorio SE CREA, y si no se puede crear
#    el banco se para.
psql_admin -d "$PGDATABASE" -qAt >/dev/null <<'SQL'
DO $lab$
DECLARE v_grupo uuid; v_sede uuid; v_persona uuid;
BEGIN
  SELECT g.id, g.sede_id INTO v_grupo, v_sede FROM grupos.grupos g
   WHERE g.sede_id IS NOT NULL ORDER BY g.id LIMIT 1;
  IF v_grupo IS NULL THEN
    RAISE EXCEPTION 'No hay grupos sembrados: el banco no puede probar el alcance de un lider';
  END IF;
  SELECT p.id INTO v_persona FROM nucleo.personas p
   WHERE p.sede_id = v_sede AND p.eliminado_en IS NULL
     AND NOT EXISTS (SELECT 1 FROM identidad.asignaciones a
                      WHERE a.persona_id = p.id AND a.alcance_tipo = 'organizacion')
   ORDER BY p.id LIMIT 1;
  IF v_persona IS NULL THEN
    RAISE EXCEPTION 'No hay una persona sin alcance de red en la sede del grupo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM identidad.asignaciones
                  WHERE persona_id = v_persona AND rol = 'LIDER_GRUPO'
                    AND alcance_id = v_grupo AND revocada_en IS NULL) THEN
    INSERT INTO identidad.asignaciones
      (persona_id, rol, alcance_tipo, alcance_id, nivel_max, acta_referencia)
    VALUES (v_persona,'LIDER_GRUPO','grupo',v_grupo,2,'laboratorio: banco probar-api.sh');
  END IF;
END $lab$;
SQL

LID=$(psql_admin -d "$PGDATABASE" -qAt -c "SELECT persona_id FROM identidad.asignaciones WHERE rol='LIDER_GRUPO' AND revocada_en IS NULL AND (vigente_hasta IS NULL OR vigente_hasta>=CURRENT_DATE) LIMIT 1")
if [ -z "$LID" ]; then echo "⛔ sin lider de laboratorio: el banco NO puede probar el alcance restringido"; exit 1; fi

# Un token por persona de prueba (DESPUES de resolver las personas).
TOK_DG="$(tok "$DG")"
TOK_LID="$(tok "$LID")"

echo "── alcance: el mismo endpoint, dos personas"
comprobar "Dirección General ve toda la red" "true" \
  "$(curl -s -H "Authorization: Bearer $TOK_DG" $A/sesion/yo | python3 -c 'import json,sys;print(str(json.load(sys.stdin)["alcance"]["todaLaRed"]).lower())')"
  comprobar "Un líder NO ve toda la red" "false" \
    "$(curl -s -H "Authorization: Bearer $TOK_LID" $A/sesion/yo | python3 -c 'import json,sys;print(str(json.load(sys.stdin)["alcance"]["todaLaRed"]).lower())')"
  comprobar "Un líder ve UNA iglesia" "1" \
  "$(curl -s -H "Authorization: Bearer $TOK_LID" $A/organizacion/sedes | python3 -c 'import json,sys;print(len(json.load(sys.stdin)))')"
comprobar "Sin identidad la API no contesta" "401" \
  "$(curl -s -o /dev/null -w '%{http_code}' $A/sesion/yo)"

echo "── catálogos"
comprobar "Ministerios del catálogo" "27" \
  "$(curl -s -H "Authorization: Bearer $TOK_DG" $A/organizacion/ministerios | python3 -c 'import json,sys;print(len(json.load(sys.stdin)))')"

echo "── pasarela: el dinero solo se mueve con firma"
REF="HUMO-$(date +%s)"
psql_admin -d "$PGDATABASE" -qAt -c "
INSERT INTO aportes.pasarela_transacciones (referencia,sede_id,tipo,fondo_id,monto,pagador_nombre)
SELECT '$REF',(SELECT id FROM org.sedes LIMIT 1),'diezmo',
       (SELECT id FROM aportes.fondos WHERE codigo='DIEZMOS'),100000,'Humo';" >/dev/null
CUERPO="{\"reference_sale\":\"$REF\",\"state_pol\":\"4\",\"TX_VALUE\":\"100000.00\",\"currency\":\"COP\",\"transaction_id\":\"HUMO-TX\",\"sign\":\"invalida\"}"
comprobar "Firma inválida NO mueve dinero" "firma_invalida" \
  "$(curl -s -X POST -H 'Content-Type: application/json' -d "$CUERPO" $A/aportes/pasarela/webhook | python3 -c 'import json,sys;print(json.load(sys.stdin).get("motivo",""))')"
comprobar "…pero el aviso queda guardado como prueba" "1" \
  "$(psql_admin -d "$PGDATABASE" -qAt -c "SELECT count(*) FROM aportes.pasarela_eventos WHERE referencia='$REF'")"

echo
printf '  %s pasan · %s fallan\n' "$ok" "$fallo"
[ "$fallo" -eq 0 ] || exit 1
