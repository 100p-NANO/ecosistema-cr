#!/usr/bin/env bash
# =====================================================================
# BANCO DE CONECTORES · LOS DIEZ MÓDULOS NUEVOS (migración 0074)
#
# ⛔ La regla del banco de conectores: un 200 no prueba nada. Cada paso
#    manda el cuerpo que manda la pantalla y después le PREGUNTA A LA BASE
#    si llegó lo que tenía que llegar: la petición confidencial que el
#    intercesor no ve, el envío que su autor no aprueba, el freno que
#    frena, la lectura N3 que deja huella.
#
#    Las personas son las del laboratorio y tres tokens reales: la
#    dirección (red), el pastor de Chía y una intercesora creada aquí.
#    Al final se deja cada módulo como estaba.
#
# Uso:  bash api/test/modulos.sh
# =====================================================================
set -uo pipefail
cd "$(dirname "$0")/../.."

source scripts/entorno.sh
ADMIN="${PGUSER:-$(whoami)}"
source scripts/api-de-laboratorio.sh
levantar_api "${PUERTO_MODULOS:-3243}"

sql() { PGUSER="$ADMIN" psql -d "$PGDATABASE" -qAt -c "$1"; }
H='Content-Type: application/json'
SX=$(date +%s | tail -c 6)

DG=$(sql "SELECT persona_id FROM identidad.asignaciones WHERE alcance_tipo='organizacion'
          AND rol='PASTOR_DIRECTOR_GENERAL' AND revocada_en IS NULL AND vigente_hasta IS NULL LIMIT 1")
CHIA=$(sql "SELECT id FROM org.sedes WHERE codigo='CHIA'")
MED=$(sql "SELECT id FROM org.sedes WHERE codigo='MED'")
PCHIA=$(sql "SELECT a.persona_id FROM identidad.asignaciones a WHERE a.rol='PASTOR_CONGREGACIONAL' AND a.alcance_tipo='sede'
             AND a.alcance_id='$CHIA' AND a.revocada_en IS NULL AND a.nivel_max >= 3 LIMIT 1")
PMED=$(sql "SELECT a.persona_id FROM identidad.asignaciones a WHERE a.rol='PASTOR_CONGREGACIONAL' AND a.alcance_tipo='sede'
            AND a.alcance_id='$MED' AND a.revocada_en IS NULL AND a.nivel_max >= 3 LIMIT 1")
for v in DG CHIA MED PCHIA PMED; do
  [ -n "${!v}" ] || { echo "⛔ sujeto agotado: falta $v. El banco no puede probar nada."; exit 1; }
done

# Una intercesora de laboratorio, con su rol, y un grupo con dos miembros:
# uno autorizó comunicaciones por correo y el otro no.
INTER=$(sql "INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido) VALUES ('$CHIA','Intercesora','Lab$SX') RETURNING id" | head -1)
sql "INSERT INTO identidad.asignaciones (persona_id, rol, alcance_tipo, alcance_id, nivel_max, otorgado_por, acta_referencia)
     VALUES ('$INTER','PERSONA_QUE_ORA','sede','$CHIA',3,'$DG','Banco de modulos')" >/dev/null
M1=$(sql "INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, email_principal) VALUES ('$CHIA','Con','Permiso$SX','con.permiso$SX@example.org') RETURNING id" | head -1)
M2=$(sql "INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, email_principal) VALUES ('$CHIA','Sin','Permiso$SX','sin.permiso$SX@example.org') RETURNING id" | head -1)
sql "INSERT INTO plataforma.consentimientos (persona_id, sede_id, finalidad, canal, acto, ocurrido_en, evidencia_tipo)
     VALUES ('$M1','$CHIA','convocatoria','email','otorgado',now(),'formulario_web')" >/dev/null
GRUPO=$(sql "INSERT INTO grupos.grupos (sede_id, tipo, nombre) VALUES ('$CHIA',
              (SELECT codigo FROM sistema.catalogo_valores WHERE catalogo='tipo_grupo' AND vigente ORDER BY orden LIMIT 1),
              'Grupo banco modulos $SX') RETURNING id" | head -1)
sql "INSERT INTO grupos.membresias (grupo_id, persona_id, rol, fecha_ingreso)
     SELECT '$GRUPO', p, (SELECT codigo FROM sistema.catalogo_valores WHERE catalogo='rol_membresia' AND vigente ORDER BY orden LIMIT 1), CURRENT_DATE
       FROM unnest(ARRAY['$M1','$M2']::uuid[]) p" >/dev/null

TD=$(PGUSER="$ADMIN" node scripts/token-para.js "$DG")
TP=$(PGUSER="$ADMIN" node scripts/token-para.js "$PCHIA")
TI=$(PGUSER="$ADMIN" node scripts/token-para.js "$INTER")
TM=$(PGUSER="$ADMIN" node scripts/token-para.js "$PMED")

PASAN=0; FALLAN=0; N=0
declare -a ROJOS
# pedir <token> <método> <ruta> [cuerpo]  → $RES (cuerpo) y $COD (estado HTTP)
pedir() {
  local salida
  if [ -n "${4:-}" ]; then
    salida=$(curl -s -w $'\n%{http_code}' -X "$2" -H "$H" -H "Authorization: Bearer $1" -d "$4" "$A$3")
  else
    salida=$(curl -s -w $'\n%{http_code}' -X "$2" -H "Authorization: Bearer $1" "$A$3")
  fi
  COD="${salida##*$'\n'}"; RES="${salida%$'\n'*}"
}
publico() {
  local salida
  salida=$(curl -s -w $'\n%{http_code}' -X POST -H "$H" -d "$2" "$A$1")
  COD="${salida##*$'\n'}"; RES="${salida%$'\n'*}"
}
jq1() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);const v=(j$1);console.log(v===undefined||v===null?'':v)}catch{console.log('')}})" <<<"$RES"; }
comprobar() {
  N=$((N+1))
  if [ "$2" = "$3" ]; then PASAN=$((PASAN+1)); printf '  %2d ✅ %s\n' "$N" "$1"
  else FALLAN=$((FALLAN+1)); printf '  %2d ❌ %s\n      esperaba «%s» · obtuvo «%s»\n' "$N" "$1" "$2" "$3"; ROJOS+=("$1"); fi
}
tiene() { if grep -q "$1" <<<"$RES"; then echo 1; else echo 0; fi; }

# Cómo estaban los módulos, para dejarlos igual al final.
MODS="oracion peticiones requerimientos tareas calendario tematicas legal comunicaciones construccion analitica"
ANTES=$(sql "SELECT string_agg(s.codigo||':'||ms.modulo||':'||ms.activo, ' ')
               FROM sistema.modulos_sede ms JOIN org.sedes s ON s.id = ms.sede_id
              WHERE s.id IN ('$CHIA','$MED') AND ms.modulo IN ('oracion','peticiones','requerimientos','tareas','calendario',
                    'tematicas','legal','comunicaciones','construccion','analitica')")

echo ""
echo "═══ CONECTORES · LOS DIEZ MÓDULOS NUEVOS ═══"
echo ""
echo "· Encender los módulos en Chía (y oración en Medellín) desde la consola"
for m in $MODS; do
  pedir "$TD" POST "/administracion/sedes/$CHIA/modulos" "{\"modulo\":\"$m\",\"activo\":true,\"evidencia\":\"Acta de laboratorio $SX\"}"
done
pedir "$TD" POST "/administracion/sedes/$MED/modulos" "{\"modulo\":\"oracion\",\"activo\":true,\"evidencia\":\"Acta de laboratorio $SX\"}"
comprobar "los diez módulos quedan encendidos en Chía" "10" \
  "$(sql "SELECT count(*) FROM sistema.modulos_sede WHERE sede_id='$CHIA' AND activo AND modulo IN ('oracion','peticiones','requerimientos','tareas','calendario','tematicas','legal','comunicaciones','construccion','analitica')")"

echo "· Oración"
pedir "$TP" POST /oracion "{\"sedeId\":\"$CHIA\",\"nombreContacto\":\"Hermana Lab\",\"contacto\":\"300 000 0000\",\"categoria\":\"familia\",
  \"resumen\":\"Restauracion de su matrimonio $SX\",\"detalle\":\"Detalle que solo leen los pastores\",\"confidencial\":true}"
CONF=$(jq1 ".id")
comprobar "petición confidencial · llega a la base marcada y con su autor" "true|$PCHIA" \
  "$(sql "SELECT confidencial||'|'||creado_por FROM crm.peticiones_oracion WHERE id='$CONF'")"
pedir "$TP" POST /oracion "{\"sedeId\":\"$CHIA\",\"nombreContacto\":\"Hermano Lab\",\"categoria\":\"salud\",
  \"resumen\":\"Salud de su hija $SX\",\"compartir\":true}"
COMP=$(jq1 ".id")
pedir "$TI" GET "/oracion?limite=200"
comprobar "la intercesora NO ve la confidencial y SÍ la compartida" "0|1" \
  "$(tiene "$CONF")|$(tiene "$COMP")"
pedir "$TI" POST "/oracion/$COMP/orar" '{"nota":"Oramos en la vigilia"}'
comprobar "«oré por esto» · queda la oración con quien oró y su nota" "1" \
  "$(sql "SELECT count(*) FROM crm.oraciones_hechas WHERE peticion_id='$COMP' AND persona_id='$INTER' AND nota='Oramos en la vigilia'")"
pedir "$TP" GET "/oracion/$CONF"
comprobar "la ficha N3 deja huella en la bitácora de lectura" "1" \
  "$(sql "SELECT count(*) FROM plataforma.bitacora_lectura WHERE tabla='peticiones_oracion' AND fila_id='$CONF' AND actor_id='$PCHIA'")"
pedir "$TI" POST "/oracion/$COMP/estado" '{"estado":"respondida"}'
comprobar "respondida sin respuesta · se rechaza y dice qué falta" "400|1" "$COD|$(tiene 'testimonio')"
pedir "$TI" POST "/oracion/$COMP/estado" '{"estado":"respondida","respuesta":"La nina salio del hospital"}'
comprobar "respondida con respuesta · la respuesta y la fecha llegan" "respondida|true" \
  "$(sql "SELECT estado||'|'||(respondida_en IS NOT NULL) FROM crm.peticiones_oracion WHERE id='$COMP'")"
publico /oracion/publica "{\"sede\":\"CHIA\",\"nombre\":\"Visitante $SX\",\"contacto\":\"visitante$SX@example.org\",\"categoria\":\"duelo\",
  \"resumen\":\"Perdi a mi madre $SX\",\"recaptcha_token\":\"laboratorio\"}"
comprobar "formulario público · se guarda como público y NO devuelve la petición" "201|formulario_publico|0" \
  "$COD|$(sql "SELECT origen FROM crm.peticiones_oracion WHERE resumen='Perdi a mi madre $SX'")|$(tiene 'Perdi a mi madre')"
publico /oracion/publica "{\"sede\":\"BOG-NORTE\",\"nombre\":\"Visitante\",\"categoria\":\"duelo\",\"resumen\":\"Otra peticion $SX\"}"
comprobar "formulario público a una sede con oración apagada · 403" "403" "$COD"
pedir "$TM" GET "/oracion/$COMP"
comprobar "el pastor de Medellín no abre una petición de Chía" "404" "$COD"

echo "· Peticiones internas"
pedir "$TP" POST /peticiones "{\"sedeId\":\"$CHIA\",\"tipo\":\"presupuesto\",\"asunto\":\"Microfonos nuevos $SX\",
  \"detalle\":\"Se danaron dos microfonos inalambricos\",\"prioridad\":\"alta\"}"
PET=$(jq1 ".id")
comprobar "la petición llega con quién la pidió y su prioridad" "$PCHIA|alta" \
  "$(sql "SELECT solicitante_id||'|'||prioridad FROM sistema.peticiones_internas WHERE id='$PET'")"
pedir "$TP" POST "/peticiones/$PET/decidir" '{"estado":"aprobada","decision":"Me la apruebo"}'
comprobar "el pastor no decide peticiones (no tiene DECIDIR_PETICION)" "403" "$COD"
pedir "$TD" POST "/peticiones/$PET/decidir" '{"estado":"aprobada","decision":"Aprobado con cargo al fondo de la sede"}'
comprobar "la dirección aprueba · decisión, quién y cuándo llegan" "aprobada|$DG|true" \
  "$(sql "SELECT estado||'|'||decidida_por||'|'||(decidida_en IS NOT NULL) FROM sistema.peticiones_internas WHERE id='$PET'")"

echo "· Requerimientos"
pedir "$TP" POST /requerimientos "{\"sedeId\":\"$CHIA\",\"categoria\":\"sonido_video\",\"asunto\":\"Se cayo la consola $SX\",\"prioridad\":\"urgente\"}"
REQ=$(jq1 ".id")
comprobar "urgente · la base pone el plazo de 4 horas" "4" \
  "$(sql "SELECT round(extract(epoch FROM vence_en - creado_en)/3600) FROM sistema.requerimientos WHERE id='$REQ'")"
pedir "$TD" POST "/requerimientos/$REQ/atender" '{"estado":"resuelto"}'
comprobar "resolver sin decir qué se hizo · se rechaza" "400" "$COD"
pedir "$TD" POST "/requerimientos/$REQ/atender" '{"estado":"resuelto","solucion":"Se cambio la fuente de poder"}'
comprobar "resuelto · la solución y la fecha llegan" "resuelto|true" \
  "$(sql "SELECT estado||'|'||(resuelto_en IS NOT NULL) FROM sistema.requerimientos WHERE id='$REQ'")"

echo "· Tareas"
pedir "$TD" POST /tareas "{\"sedeId\":\"$CHIA\",\"titulo\":\"Llamar a los nuevos $SX\",\"asignadaA\":\"$PCHIA\",\"venceEn\":\"2026-12-01\"}"
TAR=$(jq1 ".id")
pedir "$TP" POST "/tareas/$TAR/estado" '{"estado":"hecha"}'
comprobar "quien tiene la tarea la marca hecha · la fecha la pone la base" "hecha|true" \
  "$(sql "SELECT estado||'|'||(hecha_en IS NOT NULL) FROM plataforma.tareas WHERE id='$TAR'")"

echo "· Calendario"
pedir "$TP" POST /calendario "{\"sedeId\":\"$CHIA\",\"tipo\":\"servicio\",\"titulo\":\"Culto de jovenes $SX\",
  \"inicia\":\"2026-10-04T10:00\",\"termina\":\"2026-10-04T12:00\"}"
EV=$(jq1 ".id")
comprobar "la hora se guarda en la zona de la sede (10:00 en Bogotá)" "10:00" \
  "$(sql "SELECT to_char(inicia AT TIME ZONE 'America/Bogota','HH24:MI') FROM org.eventos WHERE id='$EV'")"
pedir "$TP" POST /calendario "{\"sedeId\":\"$CHIA\",\"alcanceRed\":true,\"tipo\":\"conferencia\",\"titulo\":\"Conferencia de red $SX\",
  \"inicia\":\"2026-11-04T10:00\",\"termina\":\"2026-11-04T12:00\"}"
comprobar "una sede no publica para toda la red" "403" "$COD"

echo "· Temáticas"
pedir "$TP" POST /tematicas "{\"sedeId\":\"$CHIA\",\"titulo\":\"Serie Fundamentos $SX\"}"
SER=$(jq1 ".id")
pedir "$TP" POST "/tematicas/$SER/ensenanzas" '{"titulo":"La roca firme","fecha":"2026-09-27","pasaje":"Mateo 7:24-27"}'
comprobar "la enseñanza llega con su pasaje y la sede de la serie" "Mateo 7:24-27|$CHIA" \
  "$(sql "SELECT pasaje||'|'||sede_id FROM formacion.ensenanzas WHERE serie_id='$SER'")"

echo "· Legal"
pedir "$TP" GET /legal
comprobar "el pastor no entra a legal (solo la dirección)" "403" "$COD"
pedir "$TD" POST /legal "{\"sedeId\":\"$CHIA\",\"tipo\":\"arrendamiento\",\"titulo\":\"Renovacion del arriendo $SX\",\"venceEn\":\"2026-10-01\"}"
ASU=$(jq1 ".id")
pedir "$TD" POST "/legal/$ASU/actuaciones" '{"contenido":"Se envio la carta de renovacion al arrendador"}'
pedir "$TD" GET "/legal/$ASU"
comprobar "la actuación llega y la ficha deja huella de lectura" "1|1" \
  "$(sql "SELECT count(*) FROM plataforma.asuntos_legales_notas WHERE asunto_id='$ASU'")|$(sql "SELECT count(*) FROM plataforma.bitacora_lectura WHERE tabla='asuntos_legales' AND fila_id='$ASU'")"

echo "· Comunicaciones"
pedir "$TP" POST /comunicaciones "{\"sedeId\":\"$CHIA\",\"finalidad\":\"convocatoria\",\"asunto\":\"Retiro de grupos $SX\",
  \"cuerpo\":\"Los esperamos el sabado en el retiro de grupos de la sede.\",\"destinatarios\":\"grupo\",\"grupoId\":\"$GRUPO\"}"
COM=$(jq1 ".id")
comprobar "el borrador llega con su grupo y su autor" "borrador|$GRUPO|$PCHIA" \
  "$(sql "SELECT estado||'|'||grupo_id||'|'||creada_por FROM crm.comunicaciones WHERE id='$COM'")"
pedir "$TP" POST "/comunicaciones/$COM/aprobar"
comprobar "el autor no aprueba lo suyo · se dice en castellano" "400|1" "$COD|$(tiene 'lo aprueba otra persona')"
pedir "$TD" GET "/comunicaciones/$COM"
comprobar "antes de aprobar se ve el alcance: 2 personas, 1 recibiría, 1 sin autorización" "2|1|1" \
  "$(jq1 ".alcance.personas")|$(jq1 ".alcance.recibirian")|$(jq1 ".alcance.sin_autorizacion")"
pedir "$TD" POST "/comunicaciones/$COM/aprobar"
pedir "$TD" POST /comunicaciones/freno '{"activo":true,"motivo":"Prueba del freno en el banco"}'
pedir "$TP" POST "/comunicaciones/$COM/enviar"
comprobar "con el freno puesto no sale nada" "400|0" \
  "$COD|$(sql "SELECT count(*) FROM plataforma.notificaciones WHERE origen_id='$COM'")"
pedir "$TD" POST /comunicaciones/freno '{"activo":false,"motivo":"Fin de la prueba del freno"}'
pedir "$TP" POST "/comunicaciones/$COM/enviar"
comprobar "enviar · sale solo a quien autorizó, con la plantilla general" "1|1|Comunicacion_general|$M1" \
  "$(jq1 ".encolados")|$(jq1 ".omitidos_sin_consentimiento")|$(sql "SELECT plantilla||'|'||persona_id FROM plataforma.notificaciones WHERE origen_id='$COM'")"

echo "· Construcción"
pedir "$TD" POST /construccion "{\"sedeId\":\"$CHIA\",\"nombre\":\"Ampliacion del salon $SX\",\"tipo\":\"ampliacion\",\"presupuesto\":\"50000000\"}"
OBRA=$(jq1 ".id")
pedir "$TD" POST "/construccion/$OBRA/hitos" '{"fecha":"2026-09-20","descripcion":"Cimientos terminados","avancePct":40,"gasto":"18000000"}'
comprobar "el hito mueve la obra: avance, ejecutado y estado" "40|18000000.00|en_curso" \
  "$(sql "SELECT avance_pct||'|'||ejecutado||'|'||estado FROM org.obras WHERE id='$OBRA'")"

echo "· Analítica y CRM"
pedir "$TP" GET /analitica/tablero
comprobar "el tablero responde con su nota de supresión" "200|1" "$COD|$(tiene 'se muestran como')"
pedir "$TP" GET /crm/se-estan-perdiendo
comprobar "«quién se nos está perdiendo» responde con su criterio" "200|1" "$COD|$(tiene 'criterio')"

echo "· El interruptor de módulos"
pedir "$TD" POST "/administracion/sedes/$CHIA/modulos" '{"modulo":"tematicas","activo":false,"nota":"Prueba del interruptor"}'
pedir "$TP" GET /tematicas
comprobar "apagado en la sede · la ruta lo dice (403)" "403|1" "$COD|$(tiene 'apagado')"

echo "· El portal del congregante (/api/v1/yo)"
MIEMBRO=$(sql "INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, email_principal, telefono_movil)
               VALUES ('$CHIA','Miembro','Portal$SX','miembro.portal$SX@example.org','300 000 $SX') RETURNING id" | head -1)
sql "INSERT INTO identidad.asignaciones (persona_id, rol, alcance_tipo, alcance_id, nivel_max, otorgado_por, acta_referencia)
     VALUES ('$MIEMBRO','MIEMBRO','persona_propia',NULL,2,'$DG','Banco de modulos · portal')" >/dev/null
sql "INSERT INTO grupos.membresias (grupo_id, persona_id, rol, fecha_ingreso)
     SELECT '$GRUPO', '$MIEMBRO', (SELECT codigo FROM sistema.catalogo_valores WHERE catalogo='rol_membresia' AND vigente ORDER BY orden LIMIT 1), CURRENT_DATE" >/dev/null
TMB=$(PGUSER="$ADMIN" node scripts/token-para.js "$MIEMBRO")
pedir "$TMB" GET /yo/resumen
comprobar "el miembro entra sin sede y ve su grupo" "200|1" "$COD|$(tiene 'Grupo banco modulos')"
pedir "$TMB" POST /yo/consentimientos '{"canal":"email","finalidad":"convocatoria","otorgar":true}'
comprobar "autorizar desde el portal · llega como acto del titular" "t|titular|portal del congregante" \
  "$(sql "SELECT plataforma.puede_contactar('$MIEMBRO','email','convocatoria')")|$(sql "SELECT calidad||'|'||evidencia_ref FROM plataforma.consentimientos WHERE persona_id='$MIEMBRO' ORDER BY registrado_en DESC LIMIT 1")"
pedir "$TMB" POST /yo/peticiones '{"tipo":"consulta","detalle":"Quiero saber que datos mios tiene la iglesia y para que los usa."}'
comprobar "radicar desde el portal · a su nombre y por la web" "$MIEMBRO|web" \
  "$(sql "SELECT titular_id||'|'||canal FROM plataforma.peticiones_titular WHERE titular_id='$MIEMBRO' ORDER BY recibida_en DESC LIMIT 1")"
pedir "$TMB" POST /yo/datos '{"email":"no-es-un-correo"}'
comprobar "un correo mal escrito se rechaza y se dice en castellano" "400|1" "$COD|$(tiene 'forma de un correo')"
pedir "$TMB" GET /oracion
comprobar "el miembro no usa la API de las sedes (sin sede asignada)" "403" "$COD"

# ── Dejar todo como estaba ───────────────────────────────────────────
limpiar() { sql "$1" >/dev/null 2>&1 || true; }
for m in $MODS; do
  for s in CHIA MED; do
    id=$([ "$s" = CHIA ] && echo "$CHIA" || echo "$MED")
    if grep -q "$s:$m:true" <<<"$ANTES"; then
      limpiar "UPDATE sistema.modulos_sede SET activo=true WHERE sede_id='$id' AND modulo='$m'"
    elif grep -q "$s:$m:false" <<<"$ANTES"; then
      limpiar "UPDATE sistema.modulos_sede SET activo=false, desactivado_en=now(), desactivado_por='$DG' WHERE sede_id='$id' AND modulo='$m'"
    else
      limpiar "DELETE FROM sistema.modulos_sede WHERE sede_id='$id' AND modulo='$m'"
    fi
  done
done
limpiar "UPDATE identidad.asignaciones SET revocada_en=now(), vigente_hasta=CURRENT_DATE, motivo_revocacion='Fin del banco de modulos' WHERE persona_id='$INTER' AND revocada_en IS NULL"
limpiar "UPDATE identidad.cuentas SET estado='suspendida', motivo_estado='Fin del banco de modulos' WHERE persona_id='$INTER'"
limpiar "UPDATE grupos.grupos SET cerrado_en=CURRENT_DATE WHERE id='$GRUPO'"
limpiar "UPDATE sistema.frenos SET activo=false WHERE codigo='comunicaciones_masivas'"
limpiar "UPDATE identidad.asignaciones SET revocada_en=now(), vigente_hasta=CURRENT_DATE, motivo_revocacion='Fin del banco de modulos' WHERE persona_id='$MIEMBRO' AND revocada_en IS NULL"

echo ""
echo "═══ MÓDULOS: $PASAN de $N ═══"
if [ "$FALLAN" -gt 0 ]; then
  echo "⛔ $FALLAN conector(es) rotos:"; printf '   · %s\n' "${ROJOS[@]}"; exit 1
fi
echo "✅ Los diez módulos: lo que manda la pantalla llega a la base, y lo que no debe pasar no pasa."
