#!/usr/bin/env bash
# =====================================================================
# La migración desde 99-o (ADR-006), paso a paso y reanudable.
#
#   migrar-99o.sh cargar <carpeta> "<descripción>"   deja la exportación en `migracion`
#   migrar-99o.sh validar <lote>                     rechazos y avisos, con su regla
#   migrar-99o.sh aplicar <lote> [bloque=1000]       por bloques; se puede cortar y reanudar
#   migrar-99o.sh conciliar <lote>                   origen contra destino, por sede
#   migrar-99o.sh rechazos <lote>                    lo que no entró y por qué
#   migrar-99o.sh revertir <lote> [--forzar]         borra exactamente lo de ese lote
#   migrar-99o.sh ensayo [personas=25000]            TODO lo anterior sobre casaroca_test,
#                                                    con una exportación sintética y tiempos
#
# ⛔ Nada de esto toca producción por accidente: `ensayo` exige
#    casaroca_test y los demás pasos dicen contra qué base van.
# =====================================================================
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
q() { psql -X -v ON_ERROR_STOP=1 -qAt "$@"; }
reloj() { date +%s; }

cargar() {
  local carpeta="$1" descripcion="$2"
  for f in personas acudientes grupos membresias consentimientos; do
    [ -f "$carpeta/$f.csv" ] || { echo "✗ falta $carpeta/$f.csv" >&2; exit 1; }
  done
  local sql; sql="$(mktemp)"
  cat > "$sql" <<SQL
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE t_personas (fila int, id_origen text, church_id text, tipo_documento text, documento text, nombres text,
  apellidos text, fecha_nacimiento text, genero text, estado_civil text, email text, telefono text, direccion text, creado_en text);
CREATE TEMP TABLE t_acudientes (menor_id_origen text, acudiente_id_origen text, parentesco text, autoriza_retiro text);
CREATE TEMP TABLE t_grupos (id_origen text, church_id text, nombre text, tipo text, dia text, hora text);
CREATE TEMP TABLE t_membresias (grupo_id_origen text, persona_id_origen text, rol text, desde text, hasta text);
CREATE TEMP TABLE t_consentimientos (fila int, persona_id_origen text, canal text, acto text, ocurrido_en text);
\copy t_personas FROM '$carpeta/personas.csv' CSV HEADER
\copy t_acudientes FROM '$carpeta/acudientes.csv' CSV HEADER
\copy t_grupos FROM '$carpeta/grupos.csv' CSV HEADER
\copy t_membresias FROM '$carpeta/membresias.csv' CSV HEADER
\copy t_consentimientos FROM '$carpeta/consentimientos.csv' CSV HEADER
INSERT INTO migracion.lotes (descripcion) VALUES ('${descripcion//\'/\'\'}') RETURNING id \gset
INSERT INTO migracion.o99_personas SELECT :id, * FROM t_personas;
INSERT INTO migracion.o99_acudientes SELECT :id, * FROM t_acudientes ON CONFLICT DO NOTHING;
INSERT INTO migracion.o99_grupos SELECT :id, * FROM t_grupos;
INSERT INTO migracion.o99_membresias SELECT :id, * FROM t_membresias ON CONFLICT DO NOTHING;
INSERT INTO migracion.o99_consentimientos SELECT :id, * FROM t_consentimientos;
COMMIT;
\echo :id
SQL
  psql -X -qAt -f "$sql" | tail -1
  rm -f "$sql"
}

aplicar() {
  local lote="$1" bloque="${2:-1000}" max desde hecho
  q -c "SELECT migracion.preparar_aplicacion($lote)" >/dev/null
  max=$(q -c "SELECT COALESCE(max(fila), 0) FROM migracion.o99_personas WHERE lote_id = $lote")
  # Adultos primero, menores después (cada menor con sus acudientes, en su bloque).
  for paso in adultos menores; do
    local menores=false; [ "$paso" = menores ] && menores=true
    hecho=$(q -c "SELECT COALESCE((SELECT hecho FROM migracion.progreso WHERE lote_id = $lote AND paso = '$paso'), 0)")
    desde=$((hecho + 1))
    [ "$hecho" -gt 0 ] && echo "  ↻ $paso: se reanuda desde la fila $desde"
    while [ "$desde" -le "$max" ]; do
      hasta=$((desde + bloque - 1))
      n=$(q -c "SELECT migracion.aplicar_personas($lote, $desde, $hasta, $menores)")
      printf '  · %-8s filas %6d a %6d · %5d nuevas\n' "$paso" "$desde" "$hasta" "$n"
      desde=$((hasta + 1))
    done
  done
  # ⛔ Una sustitución dentro de `echo` se tragaba el error del paso: el
  #    ensayo siguió como si los grupos hubieran entrado (lo atrapó la
  #    conciliación). Cada resultado va primero a una variable: si falla, para.
  local r
  r=$(q -c "SELECT migracion.aplicar_grupos_y_membresias($lote)"); echo "  · grupos y membresías: $r"
  r=$(q -c "SELECT migracion.aplicar_consentimientos($lote)"); echo "  · consentimientos: $r"
  q -c "SELECT jsonb_pretty(migracion.cerrar_aplicacion($lote))"
}

conciliar() {
  local lote="$1"
  psql -X -q -c "SELECT * FROM migracion.conciliar($lote)"
  local malas; malas=$(q -c "SELECT count(*) FROM migracion.conciliar($lote) WHERE diferencia <> 0")
  if [ "$malas" -gt 0 ]; then echo "⛔ $malas fila(s) de la conciliación no cuadran: la ola NO se enciende."; return 1; fi
  echo "✔ La conciliación cuadra: lo que entró es lo que se esperaba, sede por sede."
}

ensayo() {
  local personas="${1:-25000}"
  [ "${PGDATABASE}" = "casaroca_test" ] || { echo "⛔ El ensayo corre SOLO sobre casaroca_test (PGDATABASE=casaroca_test)." >&2; exit 2; }
  local dir; dir="$(mktemp -d)/exportacion-99o"
  local t0 t1
  echo "══ Ensayo de migración con $personas personas sintéticas · base $PGDATABASE"
  echo "· base limpia"
  "$RAIZ/scripts/migrar.sh" >/tmp/cr-ensayo-migrar.log 2>&1 || { echo "✗ la base no se levantó (ver /tmp/cr-ensayo-migrar.log)" >&2; exit 1; }
  echo "· exportación sintética"; node "$RAIZ/db/migracion/generar-99o-sintetico.js" "$dir" "$personas" 21
  echo "· mapa de iglesias (ensayo: las 36 de 99-o repartidas en las sedes de prueba)"
  q -c "INSERT INTO migracion.mapa_sedes (church_id, sede_id, nombre_99o, confirmado_por, confirmado_en)
        SELECT g::text, (SELECT id FROM org.sedes WHERE activa ORDER BY codigo OFFSET ((g - 1) % (SELECT count(*) FROM org.sedes WHERE activa)) LIMIT 1),
               'Iglesia sintética ' || g, 'ensayo automático', now()
          FROM generate_series(1, 33) g" >/dev/null
  echo "  (las iglesias 34 a 36 quedan SIN mapear a propósito: la validación tiene que atraparlas)"
  t0=$(reloj); lote=$(cargar "$dir" "Ensayo sintético de $personas personas"); t1=$(reloj)
  echo "· carga en el área de aterrizaje: lote $lote · $((t1 - t0)) s"
  t0=$(reloj); q -c "SELECT jsonb_pretty(migracion.validar($lote))"; t1=$(reloj)
  echo "· validación: $((t1 - t0)) s"
  t0=$(reloj); aplicar "$lote" 2000; t1=$(reloj)
  echo "· aplicación: $((t1 - t0)) s"
  echo "· reaplicar el mismo lote NO duplica nada (idempotencia):"
  antes=$(q -c "SELECT count(*) FROM nucleo.personas WHERE source_system = '99o'")
  q -c "UPDATE migracion.lotes SET estado = 'validado' WHERE id = $lote; DELETE FROM migracion.progreso WHERE lote_id = $lote" >/dev/null
  aplicar "$lote" 5000 >/dev/null
  despues=$(q -c "SELECT count(*) FROM nucleo.personas WHERE source_system = '99o'")
  [ "$antes" = "$despues" ] && echo "  ✔ $antes personas antes y después" || { echo "  ✖ $antes antes, $despues después"; exit 1; }
  conciliar "$lote"
  echo "· un menor sin acudiente no entra:"
  q -c "SELECT '  ' || regla || ' · ' || count(*) FROM migracion.rechazos WHERE lote_id = $lote GROUP BY regla ORDER BY 1"
  echo "· consentimientos con su fecha de origen:"
  q -c "SELECT '  ' || count(*) || ' migrados · ' || count(*) FILTER (WHERE ocurrido_en::date < CURRENT_DATE) || ' con fecha anterior a hoy'
          FROM plataforma.consentimientos WHERE source_system = '99o'"
  echo "$lote" > "${ENSAYO_LOTE_ARCHIVO:-/tmp/cr-ensayo-lote}"
  if [ "${ENSAYO_SIN_REVERTIR:-0}" != "1" ]; then
    t0=$(reloj); q -c "SELECT migracion.revertir($lote)" >/dev/null; t1=$(reloj)
    echo "· reversión: $((t1 - t0)) s"
    residuo=$(q -c "SELECT (SELECT count(*) FROM nucleo.personas WHERE source_system = '99o' AND eliminado_en IS NULL)
                        + (SELECT count(*) FROM grupos.grupos WHERE source_system = '99o')
                        + (SELECT count(*) FROM nucleo.acudientes a JOIN nucleo.personas m ON m.id = a.menor_id
                            WHERE m.source_system LIKE '99o%')
                        + (SELECT count(*) FROM plataforma.consentimientos c JOIN nucleo.personas p ON p.id = c.persona_id
                            WHERE c.source_system = '99o' AND p.eliminado_en IS NULL)")
    [ "$residuo" = "0" ] && echo "  ✔ cero residuo activo: nadie de la ola queda vivo ni contactable (los consentimientos quedan como evidencia)" \
      || { echo "  ✖ quedaron $residuo filas activas"; exit 1; }
    echo "· la ola se puede reintentar después de revertida:"
    q -c "SELECT migracion.validar($lote)" >/dev/null
    aplicar "$lote" 5000 >/dev/null
    reintento=$(q -c "SELECT count(*) FROM nucleo.personas WHERE source_system = '99o' AND eliminado_en IS NULL")
    [ "$reintento" = "$antes" ] && echo "  ✔ $reintento personas otra vez, sin choques de linaje" || { echo "  ✖ $reintento en el reintento, $antes antes"; exit 1; }
  fi
  echo "══ Ensayo completo."
}

accion="${1:-}"; shift || true
case "$accion" in
  cargar)    cargar "$1" "${2:-Exportación de 99-o}" ;;
  validar)   q -c "SELECT jsonb_pretty(migracion.validar($1))" ;;
  aplicar)   aplicar "$1" "${2:-1000}" ;;
  conciliar) conciliar "$1" ;;
  rechazos)  psql -X -q -c "SELECT tabla, id_origen, regla, detalle FROM migracion.rechazos WHERE lote_id = $1 ORDER BY tabla, regla, id_origen" ;;
  revertir)  q -c "SELECT migracion.revertir($1, $([ "${2:-}" = --forzar ] && echo true || echo false))" ;;
  ensayo)    ensayo "${1:-25000}" ;;
  *) sed -n '2,17p' "$0"; exit 2 ;;
esac
