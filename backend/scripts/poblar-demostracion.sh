#!/usr/bin/env bash
# =====================================================================
# poblar-demostracion.sh · LA RED DE DEMOSTRACIÓN, EN UN COMANDO
#
# ⛔ SOLO DEMOSTRACIÓN. Inventa la red completa de Casa Sobre la Roca
#    (36 sedes, unas 4.100 personas y lo que hacen en cada módulo) para que
#    las pantallas se vean vivas y las pruebas de punta a punta tengan con
#    qué trabajar. Nada es real y nada de esto va a producción: el guion se
#    niega a correr sobre una base que no sea de desarrollo.
#
# Uso:
#   PGDATABASE=cr_e2e_60 backend/scripts/poblar-demostracion.sh          todos los archivos, en orden
#   PGDATABASE=casaroca_dev backend/scripts/poblar-demostracion.sh 00 10  solo esos números
#
# Corre en orden backend/db/demostracion/[0-9][0-9]-*.js. Cada archivo
# trabaja en su propia transacción y mira primero si su tema ya está
# poblado: si lo está, avisa y sale sin duplicar. Ver db/demostracion/LEEME.md.
#
# Bases permitidas: casaroca_dev, casaroca_test, cr_e2e_*, cr_pob_*.
# Conexión: postgres por el socket local (/tmp, puerto 5433).
# =====================================================================
set -o pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"          # backend/
DIR="$RAIZ/db/demostracion"
BASE="${PGDATABASE:-}"

# ── La guarda: primero el nombre, después la base misma ──────────────
if [ -z "$BASE" ]; then
  echo "⛔ Diga sobre qué base se puebla: PGDATABASE=cr_e2e_60 $0"
  exit 2
fi
case "$BASE" in
  casaroca_dev|casaroca_test|cr_e2e_*|cr_pob_*) ;;
  *)
    echo "⛔ La base «$BASE» no está permitida. Esta es una semilla de DEMOSTRACIÓN:"
    echo "   solo corre sobre casaroca_dev, casaroca_test, cr_e2e_* o cr_pob_*. Jamás sobre producción."
    exit 2 ;;
esac
if ! [[ "$BASE" =~ ^[a-z0-9_]+$ ]]; then
  echo "⛔ El nombre de base «$BASE» tiene caracteres que no se aceptan."
  exit 2
fi

export PGHOST=/tmp PGPORT=5433 PGDATABASE="$BASE"
export PATH="$HOME/Applications/Postgres.app/Contents/Versions/16/bin:$PATH"

if ! psql -U postgres -d "$BASE" -qAtc "SELECT 1" >/dev/null 2>&1; then
  echo "⛔ No hay conexión con la base «$BASE» (postgres, socket /tmp, puerto 5433)."
  exit 1
fi
if [ "$(psql -U postgres -d "$BASE" -qAtc "SELECT to_regclass('nucleo.personas') IS NOT NULL")" != "t" ]; then
  echo "⛔ La base «$BASE» no tiene el modelo de CasaRoca: migre primero (scripts/migrar.sh)."
  exit 1
fi
if [ ! -f "$RAIZ/api/dist/src/auth/clave.js" ]; then
  echo "⛔ Falta la API compilada (backend/api/dist): de ahí sale la derivación de la clave de laboratorio."
  echo "   Compílela una vez con: (cd backend/api && npm run build)"
  exit 1
fi
command -v node >/dev/null || { echo "⛔ Falta node en el PATH."; exit 1; }

ahora() { node -e 'process.stdout.write(String(Date.now()))'; }
segundos() { awk -v a="$1" -v b="$2" 'BEGIN { printf "%.1f", (b - a) / 1000 }'; }

# ── Qué archivos corren ───────────────────────────────────────────────
ARCHIVOS=()
for f in "$DIR"/[0-9][0-9]-*.js; do
  [ -e "$f" ] || continue
  n="$(basename "$f" | cut -c1-2)"
  if [ $# -gt 0 ]; then
    incluido=no
    for x in "$@"; do [ "$x" = "$n" ] && incluido=si; done
    [ "$incluido" = si ] || continue
  fi
  ARCHIVOS+=("$f")
done
if [ ${#ARCHIVOS[@]} -eq 0 ]; then
  echo "⛔ No hay archivos que correr en $DIR${*:+ con el filtro $*}."
  exit 1
fi

echo "═══ Red de demostración de CasaRoca · base $BASE · ${#ARCHIVOS[@]} archivo(s) ═══"
echo "    ⛔ Datos inventados, solo para desarrollo y pruebas. Jamás en producción."
INICIO="$(ahora)"
TIEMPOS=""
for f in "${ARCHIVOS[@]}"; do
  t0="$(ahora)"
  if ! node "$f"; then
    echo "⛔ Falló $(basename "$f"). Ese archivo no dejó nada a medias (corre en una transacción);"
    echo "   los anteriores quedaron poblados. Corrija y vuelva a correr: lo ya poblado no se duplica."
    exit 1
  fi
  t1="$(ahora)"
  TIEMPOS="$TIEMPOS   $(basename "$f")  $(segundos "$t0" "$t1") s"$'\n'
done
FIN="$(ahora)"

echo ""
echo "═══ Tiempos ═══"
printf '%s' "$TIEMPOS"
echo "   total              $(segundos "$INICIO" "$FIN") s"

echo ""
echo "═══ Filas por tabla ═══"
# Una fila por tabla, agrupadas por el archivo que las puebla (el número es
# el del archivo). Lo transversal (historia, auditoría, avisos) lo escriben
# todos. Una tabla que no exista en la base se salta sin fallar.
psql -U postgres -d "$BASE" -q -P pager=off <<'SQL'
SELECT x.archivo, x.tabla,
       (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %s', x.tabla), false, true, '')))[1]::text::int AS filas
  FROM (VALUES
    ('00','org.sedes'),('00','org.unidades'),('00','org.unidad_miembros'),('00','org.ministerios_sede'),
    ('00','org.segmentos'),('00','sistema.modulos_sede'),('00','nucleo.personas'),('00','nucleo.membresias_sede'),
    ('00','nucleo.vinculos'),('00','nucleo.acudientes'),('00','nucleo.fusiones'),('00','nucleo.persona_atributos'),
    ('00','grupos.hogares'),('00','grupos.hogar_miembros'),('00','plataforma.politicas_tratamiento'),
    ('00','plataforma.consentimientos'),('00','identidad.asignaciones'),('00','identidad.asignaciones_unidad'),
    ('00','identidad.cuentas'),('00','identidad.recertificaciones'),
    ('10','grupos.grupos'),('10','grupos.membresias'),('10','grupos.reuniones'),('10','asistencia.servicios'),
    ('10','asistencia.conteos'),('10','asistencia.entradas'),('10','crm.nuevos_registros'),('10','crm.contactos_nuevos'),
    ('10','crm.notas_privadas_nuevos'),('10','crm.recorrido'),
    ('20','rocakids.salas'),('20','rocakids.servidores_sala'),('20','rocakids.inscripciones'),('20','rocakids.autorizaciones'),
    ('20','rocakids.condiciones_medicas'),('20','rocakids.checkins'),('20','rocakids.intentos_entrega'),
    ('20','talento.antecedentes'),('20','talento.voluntariados'),('20','talento.contratos'),
    ('30','consejeria.casos'),('30','consejeria.asignaciones'),('30','consejeria.sesiones'),('30','consejeria.notas'),
    ('30','crm.peticiones_oracion'),('30','crm.oraciones_hechas'),('30','sistema.peticiones_internas'),
    ('30','sistema.requerimientos'),('30','plataforma.tareas'),
    ('40','formacion.programas'),('40','formacion.cursos'),('40','formacion.cohortes'),('40','formacion.inscripciones'),
    ('40','formacion.certificados'),('40','formacion.series'),('40','formacion.ensenanzas'),('40','org.eventos'),
    ('50','aportes.aportes'),('50','aportes.certificados'),('50','aportes.cierres_control'),
    ('50','aportes.pasarela_transacciones'),('50','aportes.pasarela_eventos'),('50','aportes.desembolsos'),
    ('50','aportes.desembolso_items'),('50','org.obras'),('50','org.obras_hitos'),('50','plataforma.asuntos_legales'),
    ('50','plataforma.asuntos_legales_notas'),
    ('60','crm.comunicaciones'),('60','plataforma.peticiones_titular'),('60','plataforma.notificaciones'),
    ('todos','crm.linea_tiempo'),('todos','plataforma.auditoria'),('todos','plataforma.bitacora_lectura')
  ) AS x(archivo, tabla)
 WHERE to_regclass(x.tabla) IS NOT NULL;
SQL
echo "✔ Red de demostración lista en $BASE."
