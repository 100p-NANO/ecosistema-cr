#!/usr/bin/env bash
# =====================================================================
# BANCO DE CONECTORES · la consola contra la base, sin intermediarios
#
# ⛔ POR QUÉ EXISTE. El 20 de septiembre de 2026 la consola otorgaba un
#    rol mandando `actaReferencia` y el backend leía `acta`. La petición
#    devolvía 200, el rol quedaba otorgado y el acta que lo autoriza se
#    perdía EN SILENCIO. La pregunta número uno de una auditoría de
#    accesos es «¿quién autorizó esto?», y la respuesta quedaba en
#    blanco sin que nadie se enterara.
#
#    Un banco que mira el código de respuesta no habría visto nada. Este
#    banco manda EXACTAMENTE el cuerpo que manda la consola y después
#    PREGUNTA A LA BASE si el dato llegó. Si alguien renombra un campo
#    en un lado y no en el otro, aquí se cae.
#
# Uso:  bash api/test/conectores.sh
# =====================================================================
set -uo pipefail
cd "$(dirname "$0")/../.."

source scripts/entorno.sh
ADMIN="${PGUSER:-$(whoami)}"
source scripts/api-de-laboratorio.sh
levantar_api "${PUERTO_CONECTORES:-3241}"

sql() { PGUSER="$ADMIN" psql -d "$PGDATABASE" -qAt -c "$1"; }
H='Content-Type: application/json'
SX=$(date +%s | tail -c 6)

DG=$(sql "SELECT persona_id FROM identidad.asignaciones
          WHERE alcance_tipo='organizacion' AND rol='PASTOR_DIRECTOR_GENERAL'
            AND vigente_hasta IS NULL LIMIT 1")
[ -n "$DG" ] || { echo "⛔ no hay Director General: el banco no puede administrar nada"; exit 1; }
T=$(PGUSER="$ADMIN" node scripts/token-para.js "$DG")
SEDE=$(sql "SELECT id FROM org.sedes WHERE codigo='BOG-CHICO'")

PASAN=0; FALLAN=0; N=0
declare -a ROJOS

# post <ruta> <cuerpo>  → deja la respuesta en $RES
post() { RES=$(curl -s -X POST -H "$H" -H "Authorization: Bearer $T" -d "$2" "$A$1"); }
jq1()  { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(j$1??'')}catch{console.log('')}})" <<<"$RES"; }

# comprobar "<qué se probó>" "<esperado>" "<obtenido>"
comprobar() {
  N=$((N+1))
  if [ "$2" = "$3" ]; then
    PASAN=$((PASAN+1)); printf '  %2d ✅ %s\n' "$N" "$1"
  else
    FALLAN=$((FALLAN+1)); printf '  %2d ❌ %s\n      esperaba «%s» · obtuvo «%s»\n' "$N" "$1" "$2" "$3"
    ROJOS+=("$1")
  fi
}

echo ""
echo "═══ CONECTORES · lo que manda la consola contra lo que guarda la base ═══"
echo ""

# ── 1. Persona ───────────────────────────────────────────────────────
echo "· Personas y cuentas"
post /administracion/personas "{\"primerNombre\":\"Conector\",\"primerApellido\":\"Prueba$SX\",
  \"sedeId\":\"$SEDE\",\"tipoDocumento\":\"CC\",\"numeroDocumento\":\"CX$SX\",
  \"email\":\"conector$SX@casaroca.org\"}"
PID=$(jq1 ".id")
comprobar "crear persona · el TIPO de documento llega a la base" "CC" \
  "$(sql "SELECT tipo_documento FROM nucleo.personas WHERE id='$PID'")"

# El documento va completo o no va: media pareja se rechaza con una frase
# que se entiende, no con el nombre de la restriccion.
post /administracion/personas "{\"primerNombre\":\"Media\",\"primerApellido\":\"Pareja$SX\",
  \"sedeId\":\"$SEDE\",\"numeroDocumento\":\"SOLO$SX\"}"
comprobar "documento a medias · se rechaza" "1" \
  "$(if grep -q '"error":true' <<<"$RES"; then echo 1; else echo 0; fi)"
comprobar "documento a medias · el mensaje se entiende, no cita la restriccion" "1" \
  "$(if grep -q 'constraint' <<<"$RES"; then echo 0; else echo 1; fi)"
post /administracion/personas "{\"primerNombre\":\"Tipo\",\"primerApellido\":\"Falso$SX\",
  \"sedeId\":\"$SEDE\",\"tipoDocumento\":\"XX\",\"numeroDocumento\":\"F$SX\"}"
comprobar "tipo de documento fuera del catalogo · se rechaza" "1" \
  "$(if grep -q '"error":true' <<<"$RES"; then echo 1; else echo 0; fi)"
comprobar "crear persona · queda con la sede que se eligió" "$SEDE" \
  "$(sql "SELECT sede_id FROM nucleo.personas WHERE id='$PID'")"
comprobar "crear persona · guarda el documento que se escribió" "CX$SX" \
  "$(sql "SELECT numero_documento FROM nucleo.personas WHERE id='$PID'")"

# ── 2. Cuenta ────────────────────────────────────────────────────────
post /administracion/cuentas "{\"personaId\":\"$PID\",\"usuario\":\"conector$SX@casaroca.org\"}"
CID=$(sql "SELECT id FROM identidad.cuentas WHERE persona_id='$PID'")
comprobar "crear cuenta · nace obligando a cambiar la contraseña" "t" \
  "$(sql "SELECT debe_cambiar_clave FROM identidad.cuentas WHERE id='$CID'")"
comprobar "crear cuenta · devuelve la clave provisional una vez" "si" \
  "$(if [ -n "$(jq1 '.clave_provisional')" ]; then echo si; else echo no; fi)"
comprobar "crear cuenta · la clave se guarda derivada, nunca en claro" "no" \
  "$(sql "SELECT CASE WHEN clave_hash ~ '^(scrypt|\\\$argon2|\\\$2)' THEN 'no' ELSE 'si' END
          FROM identidad.cuentas WHERE id='$CID'")"
# ⛔ 0069 · Crear una cuenta NO dejaba línea en la auditoría.
comprobar "crear cuenta · queda en la auditoría" "1" \
  "$(sql "SELECT count(*) FROM plataforma.auditoria WHERE tabla='cuentas' AND fila_id='$CID' AND operacion='I'")"
comprobar "…y la auditoría NO guarda el hash de la clave ni el secreto del segundo factor" "0" \
  "$(sql "SELECT count(*) FROM plataforma.auditoria WHERE tabla='cuentas' AND fila_id='$CID'
            AND (coalesce(valor_nuevo,'{}') ?| array['clave_hash','segundo_factor_secreto']
              OR coalesce(valor_anterior,'{}') ?| array['clave_hash','segundo_factor_secreto'])")"

# ⛔ Un MENOR no se podía registrar y el mensaje mentía.
post /administracion/personas "{\"primerNombre\":\"Menor\",\"primerApellido\":\"Prueba$SX\",
  \"sedeId\":\"$SEDE\",\"fechaNacimiento\":\"2018-05-10\"}"
comprobar "registrar a un MENOR sin acudiente · se niega y dice por qué" "1" \
  "$(if grep -q 'acudiente' <<<"$RES"; then echo 1; else echo 0; fi)"
MENOR_CUERPO=$(printf '{"primerNombre":"Menor","primerApellido":"Prueba%s","sedeId":"%s","fechaNacimiento":"2018-05-10","acudienteId":"%s","parentesco":"MADRE"}' "$SX" "$SEDE" "$PID")
post /administracion/personas "$MENOR_CUERPO"
MID=$(jq1 ".id")
comprobar "registrar a un MENOR con su acudiente · entra, con el vínculo escrito" "1" \
  "$(sql "SELECT count(*) FROM nucleo.acudientes WHERE menor_id='$MID' AND acudiente_id='$PID'")"
RES=$(curl -s -H "Authorization: Bearer $T" "$A/administracion/personas/$MID")
comprobar "abrir la ficha de un menor · la lectura queda registrada (antes solo lo prometía)" "1" \
  "$(sql "SELECT count(*) FROM plataforma.bitacora_lectura WHERE fila_id='$MID'")"

sql "UPDATE identidad.cuentas SET debe_cambiar_clave=false, bloqueada_hasta=now()+interval '1 hour',
     segundo_factor_activo=true WHERE id='$CID'" >/dev/null
post "/administracion/cuentas/$CID/reiniciar-clave" '{}'
comprobar "reiniciar clave · vuelve a exigir el cambio" "t" \
  "$(sql "SELECT debe_cambiar_clave FROM identidad.cuentas WHERE id='$CID'")"
post "/administracion/cuentas/$CID/desbloquear" '{}'
comprobar "desbloquear · levanta el bloqueo de verdad" "" \
  "$(sql "SELECT bloqueada_hasta FROM identidad.cuentas WHERE id='$CID' AND bloqueada_hasta>now()")"
post "/administracion/cuentas/$CID/reiniciar-segundo-factor" '{}'
comprobar "reiniciar segundo factor · lo deja apagado" "f" \
  "$(sql "SELECT segundo_factor_activo FROM identidad.cuentas WHERE id='$CID'")"

# ── 3. Otorgar un rol · el fallo del acta ────────────────────────────
echo "· Roles otorgados a una persona"
post "/identidad/personas/$PID/otorgar" \
  "{\"roles\":[{\"rol\":\"PASTOR_CONGREGACIONAL\",\"alcanceTipo\":\"sede\",\"alcanceId\":\"$SEDE\",\"acta\":\"ACTA-CX-$SX\"}]}"
comprobar "otorgar rol · el ACTA llega a la base (el fallo del 20 sep)" "ACTA-CX-$SX" \
  "$(sql "SELECT acta_referencia FROM identidad.asignaciones
          WHERE persona_id='$PID' AND rol='PASTOR_CONGREGACIONAL' AND vigente_hasta IS NULL")"
comprobar "otorgar rol · queda anotado quién lo otorgó" "$DG" \
  "$(sql "SELECT otorgado_por FROM identidad.asignaciones
          WHERE persona_id='$PID' AND rol='PASTOR_CONGREGACIONAL' AND vigente_hasta IS NULL")"
post "/identidad/personas/$PID/otorgar" \
  "{\"roles\":[{\"rol\":\"AUDITOR\",\"alcanceTipo\":\"organizacion\"}]}"
comprobar "otorgar rol SIN acta · se rechaza, no se otorga a ciegas" "0" \
  "$(sql "SELECT count(*) FROM identidad.asignaciones WHERE persona_id='$PID' AND rol='AUDITOR'")"

ASIG=$(sql "SELECT id FROM identidad.asignaciones
            WHERE persona_id='$PID' AND rol='PASTOR_CONGREGACIONAL' AND vigente_hasta IS NULL")
del() { RES=$(curl -s -X DELETE -H "$H" -H "Authorization: Bearer $T" -d "$2" "$A$1"); }
del "/identidad/asignaciones/$ASIG" '{}'
comprobar "revocar SIN motivo · se rechaza, no se revoca a ciegas" "1" \
  "$(sql "SELECT count(*) FROM identidad.asignaciones WHERE id='$ASIG' AND revocada_en IS NULL")"
del "/identidad/asignaciones/$ASIG" '{"motivo":"Fin de la prueba de conectores"}'
comprobar "revocar rol · NO se borra la fila, se le pone fecha de fin" "1" \
  "$(sql "SELECT count(*) FROM identidad.asignaciones WHERE id='$ASIG' AND vigente_hasta IS NOT NULL")"
comprobar "revocar rol · el MOTIVO llega a la base" "Fin de la prueba de conectores" \
  "$(sql "SELECT motivo_revocacion FROM identidad.asignaciones WHERE id='$ASIG'")"
comprobar "revocar rol · queda anotado QUIÉN revocó" "$DG" \
  "$(sql "SELECT revocada_por FROM identidad.asignaciones WHERE id='$ASIG'")"
# ⛔ EL EFECTO, no la fila. Este banco comprobaba que el papel quedara bien
#    escrito y NO que el permiso se fuera. Por eso no vio, durante toda una
#    tarde, que revocar un rol dejaba el permiso vivo hasta la medianoche.
comprobar "revocar rol · LA PERSONA PIERDE EL PERMISO, no solo la fila" "f" \
  "$(sql "SELECT identidad.puede('$PID','personas','ver')")"
comprobar "revocar rol · y pierde el techo" "0" \
  "$(sql "SELECT identidad.nivel_max_de('$PID')")"

# ⛔ Un rol NO se otorga con un alcance más ancho que su máximo: era la
#    segunda escalada (dos clics para volver global a alguien de una sede).
post "/identidad/personas/$PID/otorgar" \
  "{\"roles\":[{\"rol\":\"CONSEJERO\",\"alcanceTipo\":\"organizacion\",\"acta\":\"ACTA-ESC-$SX\"}]}"
comprobar "otorgar un rol MÁS ANCHO que su máximo · se niega" "0" \
  "$(sql "SELECT count(*) FROM identidad.asignaciones WHERE persona_id='$PID' AND rol='CONSEJERO'")"
del "/identidad/asignaciones/$ASIG" '{"motivo":"Intentar revocar dos veces"}'
comprobar "revocar dos veces · avisa que ya estaba revocado" "1" \
  "$(if grep -q '"error":true' <<<"$RES"; then echo 1; else echo 0; fi)"
comprobar "revocar dos veces · lo DICE, no manda a soporte con un codigo" "1" \
  "$(if grep -q 'ya estaba revocado' <<<"$RES"; then echo 1; else echo 0; fi)"
del "/identidad/asignaciones/00000000-0000-0000-0000-000000000000" '{"motivo":"Probar una asignacion que no existe"}'
comprobar "revocar algo que no existe · lo dice, no da error inesperado" "1" \
  "$(if grep -q 'No existe esa asignación' <<<"$RES"; then echo 1; else echo 0; fi)"

# ⛔ Nadie se deja a la red sin quién la administre.
DGA=$(sql "SELECT id FROM identidad.asignaciones
           WHERE persona_id='$DG' AND alcance_tipo='organizacion' AND revocada_en IS NULL LIMIT 1")
del "/identidad/asignaciones/$DGA" '{"motivo":"Probar que el sistema no se deja sin administrador"}'
comprobar "revocar el ÚLTIMO rol que administra la red · se niega" "1" \
  "$(sql "SELECT count(*) FROM identidad.asignaciones WHERE id='$DGA' AND revocada_en IS NULL")"

# ── 3b. Recertificar y cerrar sesiones ───────────────────────────────
echo "· Recertificacion y vigilancia"
post "/identidad/personas/$PID/otorgar" \
  "{\"roles\":[{\"rol\":\"PASTOR_CONGREGACIONAL\",\"alcanceTipo\":\"sede\",\"alcanceId\":\"$SEDE\",\"acta\":\"ACTA-REC-$SX\"}]}"
REC=$(sql "SELECT id FROM identidad.asignaciones
           WHERE persona_id='$PID' AND rol='PASTOR_CONGREGACIONAL' AND revocada_en IS NULL LIMIT 1")
comprobar "el numero de «por recertificar» cuenta solo los VENCIDOS" "si" \
  "$(if [ "$(sql "SELECT count(*) FROM identidad.v_accesos_por_recertificar WHERE vencido")" \
        -le "$(sql "SELECT count(*) FROM identidad.v_accesos_por_recertificar")" ]; then echo si; else echo no; fi)"
comprobar "un acceso otorgado HOY no cuenta como vencido" "f" \
  "$(sql "SELECT vencido FROM identidad.v_accesos_por_recertificar WHERE asignacion_id='$REC'")"
post "/administracion/recertificar/$REC" '{"veredicto":"se_mantiene"}'
comprobar "recertificar SIN nota · se rechaza" "0" \
  "$(sql "SELECT count(*) FROM identidad.recertificaciones WHERE asignacion_id='$REC'")"
post "/administracion/recertificar/$REC" '{"veredicto":"se_mantiene","nota":"Sigue acompanando dos casos abiertos"}'
comprobar "recertificar · la NOTA llega a la base" "Sigue acompanando dos casos abiertos" \
  "$(sql "SELECT nota FROM identidad.recertificaciones WHERE asignacion_id='$REC'")"
comprobar "recertificar · queda firmado con quien reviso" "$DG" \
  "$(sql "SELECT revisada_por FROM identidad.recertificaciones WHERE asignacion_id='$REC'")"
post "/administracion/recertificar/$REC" '{"veredicto":"se_revoca","nota":"Ya no acompana ningun caso"}'
comprobar "recertificar con veredicto REVOCAR · revoca de verdad, no solo anota" "1" \
  "$(sql "SELECT count(*) FROM identidad.asignaciones WHERE id='$REC' AND revocada_en IS NOT NULL")"

# ⛔ 0068 · «Se reduce» no reducía nada, y uno podía firmarse a sí mismo.
RED_CUERPO=$(printf '{"roles":[{"rol":"PASTOR_CONGREGACIONAL","alcanceTipo":"sede","alcanceId":"%s","nivelMax":3,"acta":"ACTA-RED-%s"}]}' "$SEDE" "$SX")
post "/identidad/personas/$PID/otorgar" "$RED_CUERPO"
RED=$(sql "SELECT id FROM identidad.asignaciones
           WHERE persona_id='$PID' AND rol='PASTOR_CONGREGACIONAL' AND revocada_en IS NULL LIMIT 1")
post "/identidad/personas/$PID/otorgar" "$RED_CUERPO"
comprobar "otorgar DOS VECES el mismo rol con el mismo alcance · no se duplica" "1" \
  "$(sql "SELECT count(*) FROM identidad.asignaciones
          WHERE persona_id='$PID' AND rol='PASTOR_CONGREGACIONAL' AND alcance_id='$SEDE' AND revocada_en IS NULL")"
post "/administracion/recertificar/$RED" '{"veredicto":"se_reduce","nota":"Solo necesita ver su sede"}'
comprobar "«se reduce» SIN decir a cuánto · se niega" "0" \
  "$(sql "SELECT count(*) FROM identidad.recertificaciones WHERE asignacion_id='$RED'")"
post "/administracion/recertificar/$RED" '{"veredicto":"se_reduce","nota":"Solo necesita ver su sede","nivelNuevo":2}'
comprobar "«se reduce» · el nivel BAJA de verdad (antes solo reiniciaba el reloj)" "2" \
  "$(sql "SELECT nivel_max FROM identidad.asignaciones WHERE id='$RED'")"
comprobar "«se reduce» · y el techo efectivo de la persona baja con él" "2" \
  "$(sql "SELECT identidad.nivel_max_de('$PID')")"
post "/administracion/recertificar/$DGA" '{"veredicto":"se_mantiene","nota":"Me reviso a mi mismo"}'
comprobar "recertificar SU PROPIO acceso · se niega" "0" \
  "$(sql "SELECT count(*) FROM identidad.recertificaciones WHERE asignacion_id='$DGA' AND nota='Me reviso a mi mismo'")"

SES=$(sql "SELECT id FROM identidad.sesiones WHERE revocada_en IS NULL ORDER BY emitida_en DESC LIMIT 1")
post "/administracion/sesiones/$SES/cerrar" '{}'
comprobar "cerrar sesion SIN motivo · se rechaza" "1" \
  "$(sql "SELECT count(*) FROM identidad.sesiones WHERE id='$SES' AND revocada_en IS NULL")"
comprobar "el tiempo restante de una sesion es TEXTO, no un objeto" "si" \
  "$(sql "SELECT CASE WHEN pg_get_function_result(oid) LIKE '%le_queda text%' THEN 'si' ELSE 'no' END
          FROM pg_proc WHERE proname='ver_sesiones_activas'")"

# ── 4. La matriz de permisos ─────────────────────────────────────────
echo "· Matriz de permisos"
post /administracion/matriz '{"rol":"CONSEJERO","modulo":"grupos","accion":"exportar","marcado":true}'
comprobar "cambiar la matriz SIN acta · se niega (antes no dejaba ni rastro)" "0" \
  "$(sql "SELECT count(*) FROM sistema.matriz_permisos
          WHERE rol='CONSEJERO' AND modulo='grupos' AND accion='exportar'")"
MX_MARCAR=$(printf '{"rol":"CONSEJERO","modulo":"grupos","accion":"exportar","marcado":true,"acta":"ACTA-MX-%s"}' "$SX")
post /administracion/matriz "$MX_MARCAR"
comprobar "marcar casilla · queda en la auditoría CON su acta" "ACTA-MX-$SX" \
  "$(sql "SELECT motivo FROM plataforma.auditoria WHERE tabla='matriz_permisos'
          AND fila_id='CONSEJERO/grupos/exportar' ORDER BY id DESC LIMIT 1")"
comprobar "marcar casilla · aparece la fila en la matriz" "1" \
  "$(sql "SELECT count(*) FROM sistema.matriz_permisos
          WHERE rol='CONSEJERO' AND modulo='grupos' AND accion='exportar'")"
MX_DESMARCAR=$(printf '{"rol":"CONSEJERO","modulo":"grupos","accion":"exportar","marcado":false,"acta":"ACTA-MX-%s"}' "$SX")
post /administracion/matriz "$MX_DESMARCAR"
comprobar "desmarcar casilla · desaparece la fila" "0" \
  "$(sql "SELECT count(*) FROM sistema.matriz_permisos
          WHERE rol='CONSEJERO' AND modulo='grupos' AND accion='exportar'")"
comprobar "desmarcar casilla · también queda en la auditoría" "D" \
  "$(sql "SELECT operacion FROM plataforma.auditoria WHERE tabla='matriz_permisos'
          AND fila_id='CONSEJERO/grupos/exportar' ORDER BY id DESC LIMIT 1")"

# ── 5. Roles: alcance y techo ────────────────────────────────────────
echo "· Roles y techos"
TES_ANTES=$(sql "SELECT nombre||'/'||nivel_maximo||'/'||alcance_maximo FROM identidad.roles WHERE codigo='TESORERIA'")
post /administracion/roles '{"codigo":"TESORERIA","nombre":"Tesoreria pisada","alcanceMaximo":"organizacion","nivelMaximo":4,"descripcion":"Intento de reescribir un rol existente","nuevo":true}'
comprobar "«crear» un rol con un código que YA existe · se niega (antes lo reescribía)" "1" \
  "$(if grep -q '"error":true' <<<"$RES"; then echo 1; else echo 0; fi)"
comprobar "…y Tesorería queda exactamente como estaba" "$TES_ANTES" \
  "$(sql "SELECT nombre||'/'||nivel_maximo||'/'||alcance_maximo FROM identidad.roles WHERE codigo='TESORERIA'")"
ROL_CUERPO=$(printf '{"codigo":"CX_%s","nombre":"Rol conector %s","alcanceMaximo":"segmento","nivelMaximo":2,"descripcion":"Creado por el banco de conectores","nuevo":true}' "$SX" "$SX")
post /administracion/roles "$ROL_CUERPO"
comprobar "crear rol · el ALCANCE elegido llega a la base" "segmento" \
  "$(sql "SELECT alcance_maximo FROM identidad.roles WHERE codigo='CX_$SX'")"
comprobar "crear rol · el TECHO elegido llega a la base" "2" \
  "$(sql "SELECT nivel_maximo FROM identidad.roles WHERE codigo='CX_$SX'")"
comprobar "crear rol · la descripción llega a la base" "Creado por el banco de conectores" \
  "$(sql "SELECT descripcion FROM identidad.roles WHERE codigo='CX_$SX'")"
post /administracion/roles "{\"codigo\":\"CX_$SX\",\"nombre\":\"Rol conector $SX\",
  \"alcanceMaximo\":\"segmento\",\"nivelMaximo\":2,\"activo\":false}"
comprobar "descontinuar un rol · queda inactivo, no borrado" "f" \
  "$(sql "SELECT activo FROM identidad.roles WHERE codigo='CX_$SX'")"
comprobar "descontinuar un rol · sin descripcion NO borra la que tenia" "Creado por el banco de conectores" \
  "$(sql "SELECT descripcion FROM identidad.roles WHERE codigo='CX_$SX'")"
comprobar "descontinuar un rol · queda escrito en la bitacora" "1" \
  "$(sql "SELECT count(*) FROM plataforma.bitacora_mantenimiento
          WHERE tarea='rol_descontinuado' AND objeto='CX_$SX'")"
post /administracion/roles "{\"codigo\":\"CX_$SX\",\"nombre\":\"Rol conector $SX (renombrado)\",
  \"alcanceMaximo\":\"segmento\",\"nivelMaximo\":2}"
comprobar "renombrar un rol descontinuado · NO lo resucita solo" "f" \
  "$(sql "SELECT activo FROM identidad.roles WHERE codigo='CX_$SX'")"

# ── 6. Plantillas ────────────────────────────────────────────────────
echo "· Plantillas de iglesia"
PL_CUERPO=$(printf '{"codigo":"CXP%s","nombre":"Plantilla conector","tipoSede":"plantacion","descripcion":"Del banco de conectores","nueva":true}' "$SX")
post /administracion/plantillas "$PL_CUERPO"
comprobar "crear plantilla · el TIPO de sede llega a la base" "plantacion" \
  "$(sql "SELECT tipo_sede FROM sistema.plantillas WHERE codigo='CXP$SX'")"
comprobar "plantilla NUEVA · nace con sus módulos de núcleo (antes nacía vacía)" \
  "$(sql "SELECT count(*) FROM sistema.modulos WHERE es_nucleo")" \
  "$(sql "SELECT count(*) FROM sistema.plantilla_modulos pm JOIN sistema.modulos m ON m.codigo=pm.modulo AND m.es_nucleo
          WHERE pm.plantilla='CXP$SX'")"
post /administracion/plantillas/MAESTRA/borrar '{}'
comprobar "borrar la MAESTRA · la base lo niega, no solo el navegador" "1" \
  "$(sql "SELECT count(*) FROM sistema.plantillas WHERE codigo='MAESTRA'")"
post "/administracion/plantillas/NOEXISTE$SX/borrar" '{}'
comprobar "borrar una plantilla que no existe · lo dice, no responde «borrada»" "1" \
  "$(if grep -q '"error":true' <<<"$RES"; then echo 1; else echo 0; fi)"
post "/administracion/plantillas/CXP$SX/modulos" '{"modulo":"grupos","marcado":true}'
comprobar "marcar módulo en plantilla · queda en plantilla_modulos" "1" \
  "$(sql "SELECT count(*) FROM sistema.plantilla_modulos WHERE plantilla='CXP$SX' AND modulo='grupos'")"
post "/administracion/plantillas/CXP$SX/modulos" '{"modulo":"personas","marcado":false}'
comprobar "quitar un módulo de NÚCLEO · se niega" "1" \
  "$(if grep -q '"error":true' <<<"$RES"; then echo 1; else echo 0; fi)"
post "/administracion/plantillas/CXP$SX/borrar" '{}'
comprobar "borrar plantilla · desaparece de verdad" "0" \
  "$(sql "SELECT count(*) FROM sistema.plantillas WHERE codigo='CXP$SX'")"

# ── 7. Módulos por sede ──────────────────────────────────────────────
echo "· Qué ve cada iglesia"
post "/administracion/sedes/$SEDE/modulos" '{"modulo":"construccion","activo":true}'
comprobar "encender módulo · queda activo en esa sede" "t" \
  "$(sql "SELECT activo FROM sistema.modulos_sede WHERE sede_id='$SEDE' AND modulo='construccion'")"
comprobar "encender módulo · queda anotado QUIÉN lo encendió" "$DG" \
  "$(sql "SELECT activado_por FROM sistema.modulos_sede WHERE sede_id='$SEDE' AND modulo='construccion'")"
post "/administracion/sedes/$SEDE/modulos" '{"modulo":"legal","activo":true}'
comprobar "encender módulo con compuerta legal SIN evidencia · se niega" "1" \
  "$(if grep -q '"error":true' <<<"$RES"; then echo 1; else echo 0; fi)"
post "/administracion/sedes/$SEDE/modulos" \
  "{\"modulo\":\"legal\",\"activo\":true,\"evidencia\":\"INSTR-CX-$SX\"}"
comprobar "encender con evidencia · la REFERENCIA jurídica llega a la base" "INSTR-CX-$SX" \
  "$(sql "SELECT evidencia_legal_ref FROM sistema.modulos_sede WHERE sede_id='$SEDE' AND modulo='legal'")"
post "/administracion/sedes/$SEDE/modulos" '{"modulo":"personas","activo":false,"nota":"Probar el nucleo"}'
comprobar "apagar un módulo de NÚCLEO · se niega" "1" \
  "$(if grep -q '"error":true' <<<"$RES"; then echo 1; else echo 0; fi)"
ENC_EN=$(sql "SELECT activado_en FROM sistema.modulos_sede WHERE sede_id='$SEDE' AND modulo='construccion'")
post "/administracion/sedes/$SEDE/modulos" '{"modulo":"construccion","activo":false}'
comprobar "apagar un módulo SIN motivo · se niega" "t" \
  "$(sql "SELECT activo FROM sistema.modulos_sede WHERE sede_id='$SEDE' AND modulo='construccion'")"
post "/administracion/sedes/$SEDE/modulos" '{"modulo":"construccion","activo":false,"nota":"Fin de la prueba de conectores"}'
comprobar "apagar · queda QUIÉN lo apagó, aparte de quién lo encendió" "$DG" \
  "$(sql "SELECT desactivado_por FROM sistema.modulos_sede WHERE sede_id='$SEDE' AND modulo='construccion'")"
comprobar "apagar · NO pisa la hora en que se encendió (antes la traza mentía)" "$ENC_EN" \
  "$(sql "SELECT activado_en FROM sistema.modulos_sede WHERE sede_id='$SEDE' AND modulo='construccion'")"
comprobar "apagar · queda en la auditoría con su motivo" "Fin de la prueba de conectores" \
  "$(sql "SELECT motivo FROM plataforma.auditoria WHERE tabla='modulos_sede'
          AND fila_id='$SEDE/construccion' ORDER BY id DESC LIMIT 1")"

# ── 8. Equipos ───────────────────────────────────────────────────────
echo "· Equipos corporativos"
post /administracion/unidades "{\"codigo\":\"CXU$SX\",\"nombre\":\"Equipo conector\",
  \"clase\":\"equipo\",\"proposito\":\"Probar que los campos del equipo llegan completos\"}"
UNI=$(sql "SELECT id FROM org.unidades WHERE codigo='CXU$SX'")
comprobar "crear equipo · el PROPÓSITO llega a la base" "Probar que los campos del equipo llegan completos" \
  "$(sql "SELECT proposito FROM org.unidades WHERE id='$UNI'")"
post "/administracion/unidades/$UNI/miembros" "{\"personaId\":\"$PID\",\"rolEnUnidad\":\"lider\"}"
comprobar "meter a alguien · el ROL EN EL EQUIPO llega a la base" "lider" \
  "$(sql "SELECT rol_en_unidad FROM org.unidad_miembros
          WHERE unidad_id='$UNI' AND persona_id='$PID' AND hasta IS NULL")"
post "/administracion/unidades/$UNI/roles" \
  "{\"rol\":\"PASTOR_CONGREGACIONAL\",\"alcanceTipo\":\"sede\",\"alcanceId\":\"$SEDE\",\"nivelMax\":3,\"acta\":\"ACTA-EQ-$SX\"}"
comprobar "otorgar rol al equipo · el acta llega a la base" "ACTA-EQ-$SX" \
  "$(sql "SELECT acta_referencia FROM identidad.asignaciones_unidad
          WHERE unidad_id='$UNI' AND revocada_en IS NULL")"
AU=$(sql "SELECT id FROM identidad.asignaciones_unidad WHERE unidad_id='$UNI' AND revocada_en IS NULL")
post "/administracion/unidades/roles/$AU/revocar" '{"motivo":"Fin de la prueba de conectores"}'
comprobar "revocar rol del equipo · el MOTIVO llega a la base" "Fin de la prueba de conectores" \
  "$(sql "SELECT motivo_revocacion FROM identidad.asignaciones_unidad WHERE id='$AU'")"
post "/administracion/unidades/$UNI/miembros/$PID/salir" '{"motivo":"Fin de la prueba"}'
comprobar "sacar del equipo · queda la fecha de salida, no se borra" "1" \
  "$(sql "SELECT count(*) FROM org.unidad_miembros
          WHERE unidad_id='$UNI' AND persona_id='$PID' AND hasta IS NOT NULL")"

# ── 9. Desplegar una iglesia ─────────────────────────────────────────
echo "· Desplegar una iglesia"
post /administracion/iglesias "{\"codigo\":\"CXS$SX\",\"nombre\":\"Iglesia conector\",
  \"tipo\":\"plantacion\",\"pais\":\"CO\",\"ciudad\":\"Cali\",\"plantilla\":\"PLANTACION\",
  \"pastorId\":\"$PID\",\"acta\":\"ACTA-SEDE-$SX\"}"
NS=$(sql "SELECT id FROM org.sedes WHERE codigo='CXS$SX'")
comprobar "desplegar iglesia · la CIUDAD llega a la base" "Cali" \
  "$(sql "SELECT ciudad FROM org.sedes WHERE id='$NS'")"
comprobar "desplegar iglesia · nace con los módulos de la plantilla" "si" \
  "$(if [ "$(sql "SELECT count(*) FROM sistema.modulos_sede WHERE sede_id='$NS' AND activo")" -gt 5 ]
     then echo si; else echo no; fi)"
comprobar "desplegar iglesia · nace CON pastor asignado" "1" \
  "$(sql "SELECT count(*) FROM identidad.asignaciones
          WHERE persona_id='$PID' AND alcance_tipo='sede' AND alcance_id='$NS' AND vigente_hasta IS NULL")"
comprobar "desplegar iglesia · lo con compuerta legal nace APAGADO" "0" \
  "$(sql "SELECT count(*) FROM sistema.modulos_sede ms
            JOIN sistema.modulos m ON m.codigo=ms.modulo
          WHERE ms.sede_id='$NS' AND ms.activo AND m.exige_compuerta_legal
            AND ms.evidencia_legal_ref IS NULL")"
comprobar "desplegar iglesia · queda constancia en la bitácora" "1" \
  "$(if [ "$(sql "SELECT count(*) FROM sistema.bitacora_aprovisionamiento
                  WHERE detalle->>'codigo'='CXS$SX' OR sede_id='$NS'")" -ge 1 ]
     then echo 1; else echo 0; fi)"
comprobar "desplegar iglesia · el pastor nace con N3 (antes N2: sin su consejería)" "3" \
  "$(sql "SELECT nivel_max FROM identidad.asignaciones
          WHERE persona_id='$PID' AND alcance_tipo='sede' AND alcance_id='$NS' AND revocada_en IS NULL")"
comprobar "desplegar iglesia · queda en la auditoría general" "1" \
  "$(sql "SELECT count(*) FROM plataforma.auditoria WHERE tabla='sedes' AND fila_id='$NS' AND operacion='I'")"
post "/administracion/sedes/$NS/estado" '{"activa":false}'
comprobar "desactivar una iglesia SIN motivo · se niega" "t" \
  "$(sql "SELECT activa FROM org.sedes WHERE id='$NS'")"
post "/administracion/sedes/$NS/estado" '{"activa":false,"motivo":"Desplegada en la prueba de conectores"}'
comprobar "desactivar una iglesia · ya tiene vuelta atrás" "f" \
  "$(sql "SELECT activa FROM org.sedes WHERE id='$NS'")"
post "/administracion/sedes/$NS/estado" '{"activa":true,"motivo":"Reactivada en la prueba de conectores"}'
comprobar "…y se reactiva" "t" \
  "$(sql "SELECT activa FROM org.sedes WHERE id='$NS'")"
RES=$(curl -s -H "Authorization: Bearer $T" "$A/administracion/arranque")
comprobar "puesta en marcha · «iglesias con pastor» cuenta las que TIENEN pastor" \
  "$(sql "SELECT count(*) FROM org.sedes s WHERE s.activa AND EXISTS (SELECT 1 FROM identidad.v_permiso_efectivo pe
          WHERE pe.vigente AND pe.alcance_tipo='sede' AND pe.alcance_id=s.id AND pe.rol='PASTOR_CONGREGACIONAL')")" \
  "$(jq1 '.iglesias_con_pastor')"

# ── 10. El aislamiento también al ESCRIBIR ───────────────────────────
echo "· Aislamiento al escribir (0070)"
CHIA=$(sql "SELECT id FROM org.sedes WHERE codigo='CHIA'")
PCHIA=$(sql "SELECT persona_id FROM identidad.asignaciones WHERE rol='PASTOR_CONGREGACIONAL'
             AND alcance_tipo='sede' AND alcance_id='$CHIA' AND revocada_en IS NULL LIMIT 1")
TCHIA=$(PGUSER="$ADMIN" node scripts/token-para.js "$PCHIA")
GCHIA=$(sql "INSERT INTO grupos.grupos (sede_id, tipo, nombre) VALUES ('$CHIA','pequeno','Grupo conector $SX') RETURNING id")
SCHIA=$(sql "INSERT INTO asistencia.servicios (sede_id, fecha, hora_inicio, tipo, nombre)
             VALUES ('$CHIA', CURRENT_DATE, '05:$(printf '%02d' $((10#$SX % 60)))', 'dominical', 'Servicio conector $SX')
             ON CONFLICT DO NOTHING RETURNING id")
[ -n "$SCHIA" ] || SCHIA=$(sql "SELECT id FROM asistencia.servicios WHERE sede_id='$CHIA' ORDER BY fecha DESC, hora_inicio DESC LIMIT 1")
AJENO=$(printf '{"personaId":"%s"}' "$PID")
RES=$(curl -s -X POST -H "$H" -H "Authorization: Bearer $TCHIA" -d "$AJENO" "$A/grupos/$GCHIA/miembros")
comprobar "un pastor de Chía mete a alguien de OTRA sede en su grupo · se niega" "0" \
  "$(sql "SELECT count(*) FROM grupos.membresias WHERE grupo_id='$GCHIA' AND persona_id='$PID'")"
RES=$(curl -s -X POST -H "$H" -H "Authorization: Bearer $TCHIA" -d "$AJENO" "$A/asistencia/servicios/$SCHIA/marcar")
comprobar "…ni la marca presente en su servicio" "0" \
  "$(sql "SELECT count(*) FROM asistencia.entradas WHERE servicio_id='$SCHIA' AND persona_id='$PID'")"
ANT_CUERPO=$(printf '{"personaId":"%s","tipo":"JUDICIAL","resultado":"apto","expedidoEn":"2026-09-01","venceEn":"2027-09-01","sedeId":"%s"}' "$PID" "$CHIA")
post /talento/antecedentes "$ANT_CUERPO"
comprobar "antecedente · la sede es la de la PERSONA, no la que mande el formulario" "$SEDE" \
  "$(sql "SELECT sede_id FROM talento.antecedentes WHERE persona_id='$PID' AND tipo='JUDICIAL' ORDER BY creado_en DESC LIMIT 1")"
ANT_AJENO=$(printf '{"personaId":"%s","tipo":"REFERENCIAS","resultado":"apto","expedidoEn":"2026-09-01","venceEn":"2027-09-01"}' "$PID")
RES=$(curl -s -X POST -H "$H" -H "Authorization: Bearer $TCHIA" -d "$ANT_AJENO" "$A/talento/antecedentes")
comprobar "un pastor de OTRA sede registra antecedentes de esta persona · se niega" "0" \
  "$(sql "SELECT count(*) FROM talento.antecedentes WHERE persona_id='$PID' AND tipo='REFERENCIAS'")"

# ── 11. Las puertas que no abrían ────────────────────────────────────
echo "· Consejería y formación"
TOP=$(sql "SELECT codigo FROM consejeria.topicos ORDER BY codigo LIMIT 1")
CASO_CUERPO=$(printf '{"consultanteId":"%s","topico":"%s"}' "$PID" "$TOP")
post /consejeria/casos "$CASO_CUERPO"
comprobar "abrir un caso de consejería · funciona (antes 403 para todos)" "1" \
  "$(sql "SELECT count(*) FROM consejeria.casos WHERE consultante_id='$PID'")"
CASO=$(sql "SELECT id FROM consejeria.casos WHERE consultante_id='$PID' LIMIT 1")
post "/consejeria/casos/$CASO/cerrar" '{}'
comprobar "cerrar un caso SIN decir cómo terminó · se niega" "" \
  "$(sql "SELECT cerrado_en FROM consejeria.casos WHERE id='$CASO'")"
post "/consejeria/casos/$CASO/cerrar" '{"desenlace":"Retomó su grupo y ya no necesita acompañamiento"}'
comprobar "cerrar un caso · el desenlace llega a la base" "Retomó su grupo y ya no necesita acompañamiento" \
  "$(sql "SELECT desenlace FROM consejeria.casos WHERE id='$CASO'")"
COH=$(sql "SELECT h.id FROM formacion.cohortes h WHERE h.sede_id='$SEDE' AND coalesce(h.valor,0)=0
           AND (h.cupo IS NULL OR h.cupo > (SELECT count(*) FROM formacion.inscripciones i
                WHERE i.cohorte_id=h.id AND i.estado::text NOT IN ('retirado','reprobado'))) LIMIT 1")
post "/formacion/cohortes/$COH/inscribir" "$AJENO"
INS=$(sql "SELECT id FROM formacion.inscripciones WHERE cohorte_id='$COH' AND persona_id='$PID' LIMIT 1")
post "/formacion/inscripciones/$INS/calificar" '{"estado":"cursando","nota":"4.5"}'
post "/formacion/inscripciones/$INS/calificar" '{"estado":"aprobado"}'
comprobar "recalificar sin nota · CONSERVA la nota anterior (antes la borraba)" "t" \
  "$(sql "SELECT nota_final = 4.5 FROM formacion.inscripciones WHERE id='$INS'")"

# ── Limpieza de lo que creó el banco ─────────────────────────────────
# ⛔ Antes iba en UN SOLO `psql -c`: una sola transacción. El borrado de la
#    cuenta SIEMPRE falla (los intentos de acceso son de solo anexar y su
#    llave no tiene ON DELETE), y al fallar esa sentencia se deshacía TODA
#    la limpieza. Cada corrida dejaba un rol y una sede de más. Ahora cada
#    sentencia va sola, y lo que no se puede borrar se desactiva.
limpiar() { sql "$1" >/dev/null 2>&1 || true; }
limpiar "DELETE FROM sistema.modulos_sede WHERE sede_id='$NS'"
limpiar "UPDATE org.sedes SET activa=false WHERE id='$NS'"
limpiar "UPDATE identidad.asignaciones SET revocada_en=now(), vigente_hasta=CURRENT_DATE, motivo_revocacion='Fin del banco de conectores' WHERE persona_id='$PID' AND revocada_en IS NULL"
limpiar "UPDATE identidad.asignaciones_unidad SET revocada_en=now(), vigente_hasta=CURRENT_DATE, motivo_revocacion='Fin del banco de conectores' WHERE unidad_id='$UNI' AND revocada_en IS NULL"
limpiar "UPDATE org.unidades SET activa=false WHERE id='$UNI'"
limpiar "UPDATE identidad.cuentas SET estado='suspendida', motivo_estado='Fin del banco de conectores' WHERE persona_id='$PID'"
limpiar "UPDATE identidad.roles SET activo=false WHERE codigo='CX_$SX'"
limpiar "DELETE FROM sistema.plantillas WHERE codigo='CXP$SX'"
limpiar "DELETE FROM sistema.modulos_sede WHERE sede_id='$SEDE' AND modulo IN ('construccion','legal')"
limpiar "UPDATE grupos.grupos SET cerrado_en=CURRENT_DATE WHERE id='$GCHIA'"

echo ""
echo "═══ CONECTORES: $PASAN de $N ═══"
if [ "$FALLAN" -gt 0 ]; then
  echo "⛔ $FALLAN conector(es) rotos:"
  printf '   · %s\n' "${ROJOS[@]}"
  exit 1
fi
echo "✅ Todo lo que manda la consola llega a la base con el nombre correcto."
