export const meta = {
  name: 'poblar-red-casaroca',
  description: 'Inventar una red completa de demostración para CasaRoca: núcleo, seis módulos en paralelo e integración con pruebas',
  phases: [
    { title: 'Núcleo', detail: 'sedes, personas, familias, cuentas y roles' },
    { title: 'Módulos', detail: 'seis pobladores en paralelo, cada uno en su base' },
    { title: 'Integración', detail: 'todo junto, bancos sobre la red y plantilla para los auditores' },
  ],
}

const E2E = '/Users/danielgarzo-pc/Desktop/CasaRoca/ecosistema-cr/e2e'
const REPO = '/Users/danielgarzo-pc/Desktop/CasaRoca/ecosistema-cr'

const DEFECTO = {
  type: 'object',
  properties: {
    titulo: { type: 'string' },
    gravedad: { type: 'string', enum: ['critica', 'alta', 'media', 'baja'] },
    reproduccion: { type: 'string' },
    donde: { type: 'string' },
  },
  required: ['titulo', 'gravedad', 'reproduccion'],
}
const FILAS = { type: 'array', items: { type: 'object', properties: { tabla: { type: 'string' }, filas: { type: 'number' } }, required: ['tabla', 'filas'] } }

const NUCLEO = {
  type: 'object',
  properties: {
    archivos: { type: 'array', items: { type: 'string' } },
    plantilla_creada: { type: 'boolean' },
    filas_por_tabla: FILAS,
    segundos: { type: 'number' },
    helpers_de_comun: { type: 'string', description: 'La API de comun.js que usarán los pobladores de módulos: nombres, firmas y ejemplos' },
    como_elegir_personas: { type: 'string', description: 'Cómo encontrar en la base a las personas por sede, edad, familia y rol (consultas listas para usar)' },
    defectos_del_sistema: { type: 'array', items: DEFECTO },
    notas: { type: 'string' },
  },
  required: ['archivos', 'plantilla_creada', 'filas_por_tabla', 'helpers_de_comun', 'como_elegir_personas', 'defectos_del_sistema'],
}
const MODULO = {
  type: 'object',
  properties: {
    archivo: { type: 'string' },
    corrio_bien: { type: 'boolean' },
    filas_por_tabla: FILAS,
    segundos: { type: 'number' },
    reglas_respetadas: { type: 'array', items: { type: 'string' } },
    pantallas_revisadas: { type: 'array', items: { type: 'string' } },
    defectos_del_sistema: { type: 'array', items: DEFECTO },
    notas: { type: 'string' },
  },
  required: ['archivo', 'corrio_bien', 'filas_por_tabla', 'defectos_del_sistema'],
}
const INTEGRACION = {
  type: 'object',
  properties: {
    plantilla_e2e_base_creada: { type: 'boolean' },
    segundos_total: { type: 'number' },
    filas_por_tabla: FILAS,
    idempotente: { type: 'boolean' },
    guarda_probada: { type: 'boolean' },
    bancos_sobre_la_red: { type: 'string', description: 'Resultado de correr los 20 bancos sobre una copia de la red poblada, y qué se hizo con cada fallo' },
    directorio: { type: 'string', description: 'Ruta del directorio de roles para los auditores' },
    cambios_hechos: { type: 'array', items: { type: 'string' } },
    defectos_del_sistema: { type: 'array', items: DEFECTO },
    notas: { type: 'string' },
  },
  required: ['plantilla_e2e_base_creada', 'filas_por_tabla', 'idempotente', 'guarda_probada', 'bancos_sobre_la_red', 'directorio', 'defectos_del_sistema'],
}

const comun = `Lea primero ${E2E}/GUIA-POBLAR.md (reglas, arquitectura, qué no se hace) y ${E2E}/slot.sh (su puesto). ` +
  `Repositorio: ${REPO}. Carpeta e2e: ${E2E}. Escriba en español, con tildes y sin rayas largas en lo que se vea en pantalla.`

phase('Núcleo')
const nucleo = await agent(
  `${comun}

SU ENCARGO: el NÚCLEO de la red inventada de CasaRoca. Usted trabaja en el puesto 60: arranque con
\`${E2E}/slot.sh 60 start cr_pob_base\` (base limpia recién migrada: 6 sedes, 6 personas).

Escriba estos archivos (y solo estos):
- backend/db/demostracion/comun.js: azar con semilla (mulberry32), listas amplias de nombres y apellidos
  colombianos inventados, conexión como postgres por socket (/tmp, 5433, base de PGDATABASE), fijar el contexto
  de autor (app.persona_id, app.sede_ids, app.nivel_max, app.alcance_global) dentro de una transacción,
  inserción por lotes, la guarda de base permitida, la fecha de referencia 2026-09-21 y ayudas para elegir
  personas. Documente cada función exportada: la usarán seis agentes que NO pueden editar este archivo.
- backend/db/demostracion/00-red.js
- backend/scripts/poblar-demostracion.sh (corre en orden backend/db/demostracion/[0-9][0-9]-*.js; guarda de base;
  imprime tiempos y conteos; se niega a correr sobre una base no permitida)
- backend/db/demostracion/LEEME.md (qué es, cómo se corre, que es SOLO demostración y jamás producción).

Lo que 00-red.js deja en la base (respetando todas las reglas):
1. La red de 36 iglesias: conserve las sedes de la semilla y agregue las que faltan, inventadas pero verosímiles
   (ciudades de Colombia y algunas del exterior), con su tipo, su país, su ciudad y su zona horaria correcta, colgadas
   de la central y de sus regiones (org.unidades) como lo hace la base. Ministerios encendidos por sede
   (org.ministerios_sede) con criterio: las sedes grandes tienen casi todo, las plantaciones lo mínimo.
2. Unas 4.000 personas repartidas por tamaño de sede (grandes de 250 a 400, pequeñas de 40 a 80): familias con pareja,
   hijos menores (con acudiente principal y, a veces, un segundo acudiente que puede o no retirarlos), jóvenes,
   adultos mayores, algunos sin correo o sin teléfono, algunos trasladados de sede (membresías con historia),
   estados variados. Consentimientos por canal y finalidad con fechas pasadas y evidencia, no todos autorizan.
3. Roles con alcance por sede, respetando techos y la regla de los pastores en matrimonio: en cada sede el
   pastor y su esposa (PASTOR_CONGREGACIONAL), secretaría, tesorería, digitador de aportes, dos consejeros,
   coordinación de nuevos; en la central la dirección general (si la semilla tiene uno solo, agréguele su
   esposa) y los equipos corporativos con sus integrantes (org.unidad_miembros). Los roles de RocaKids y de
   líder de grupo NO son suyos: los ponen los pobladores de esos módulos, porque dependen de antecedentes y de
   grupos que todavía no existen.
4. Cuentas de acceso para quienes tienen rol, con la clave de laboratorio que usa backend/scripts/token-para.js
   (léalo y cree las cuentas de la misma forma), sin activar el segundo factor.

Pruebe: corra el poblador en su base, mida el tiempo, compruebe los conteos y que la base no rechazó nada que
debía aceptar. Abra la aplicación del puesto con ${E2E}/e2e.py como el pastor de una sede grande y como la
dirección, y mire que el Panel y Personas se vean vivos.

Al final, OBLIGATORIO para que sigan los demás: baje su puesto (\`${E2E}/slot.sh 60 stop\`), cierre toda
conexión a cr_e2e_60 y cree la plantilla para los pobladores de módulos:
  psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS cr_pob_nucleo" -c "CREATE DATABASE cr_pob_nucleo TEMPLATE cr_e2e_60"
(con PATH=$HOME/Applications/Postgres.app/Contents/Versions/16/bin:$PATH, socket /tmp, puerto 5433).
Devuelva plantilla_creada=true solo si la plantilla existe y tiene sus datos.`,
  { label: 'núcleo de la red', phase: 'Núcleo', schema: NUCLEO })

if (!nucleo || !nucleo.plantilla_creada) {
  log('El núcleo no dejó la plantilla cr_pob_nucleo: los módulos no pueden empezar.')
  return { nucleo, modulos: [], integracion: null }
}
log(`Núcleo listo: ${nucleo.archivos.length} archivos, ${(nucleo.filas_por_tabla || []).reduce((s, x) => s + (x.filas || 0), 0)} filas`)

const MODULOS = [
  { n: 61, archivo: '10-grupos-asistencia-nuevos.js', tema: `GRUPOS, ASISTENCIA y NUEVOS. Grupos de varios tipos por sede (del catálogo), con sus miembros, su líder (rol LIDER_GRUPO con alcance sobre SU grupo, y cuenta como en el núcleo), coordinadores y directores de segmento donde haya segmentos; reuniones reportadas (unos grupos al día, otros que llevan semanas sin reportar, alguno cerrado). Servicios de asistencia de los últimos 12 meses (domingos y alguno entre semana, del catálogo de tipos), con el conteo de la puerta; y personas marcadas en las últimas 8 semanas, con quienes venían seguido y dejaron de venir (para que «¿quién se nos está perdiendo?» tenga a quién mostrar). Nuevos del recorrido 4C: primeras visitas recientes, llamadas registradas con reacción y siguiente paso, algunos atrasados, algunos integrados como miembros.` },
  { n: 62, archivo: '20-rocakids-talento.js', tema: `ROCAKIDS y TALENTO. Salas por sede según edades, voluntariados de servidores en varios ministerios (con su función), antecedentes vigentes, por vencer y vencidos; los roles DIRECTOR_ROCAKIDS y MAESTRO_ROCAKIDS solo para quien tiene antecedentes vigentes y verificados (la base lo exige), con cuenta. Ingresos y entregas de niños de los últimos 8 domingos usando las funciones de la base (la de registrar el ingreso con 6 argumentos y la de entrega con código), con alguna entrega a un segundo acudiente autorizado y algún intento fallido que quede registrado; y algún niño hoy en sala.` },
  { n: 63, archivo: '30-cuidado-pastoral.js', tema: `CONSEJERÍA, ORACIÓN, PETICIONES INTERNAS, REQUERIMIENTOS y TAREAS. Casos de consejería por tópico (algunos que exigen profesional), con consejero asignado, sesiones y notas, abiertos y cerrados con su desenlace; peticiones de oración compartidas y confidenciales con las oraciones hechas por ellas; peticiones internas de las sedes a la dirección en todos sus estados (decididas por otra persona, nunca por quien pidió); requerimientos de mantenimiento con prioridades y plazos, algunos vencidos, asignados y resueltos; tareas asignadas, en curso, hechas y vencidas.` },
  { n: 64, archivo: '40-formacion-tematicas-calendario.js', tema: `FORMACIÓN, TEMÁTICAS y CALENDARIO. Cursos y cohortes (presenciales y virtuales, con y sin valor), inscripciones con estado de pago, notas finales y certificados de quienes terminaron; series de enseñanza con sus enseñanzas (pasaje, predicador, fecha); eventos del calendario de la red y de cada sede, pasados (hechos o cancelados) y próximos, en la zona horaria de cada sede.` },
  { n: 65, archivo: '50-aportes-construccion-legal.js', tema: `APORTES, CONSTRUCCIÓN y LEGAL. Aportes de los últimos 12 meses (diezmos, ofrendas y los tipos y fondos del catálogo) por medio de pago, con estacionalidad (diciembre sube), algunos por confirmar y alguno anulado con motivo; certificados de donación expedidos del año anterior por la función de la base; obras de construcción con presupuesto e hitos que mueven su avance y lo ejecutado (una atrasada, una terminada); asuntos legales con su tipo, términos y notas (alguno por vencer).` },
  { n: 66, archivo: '60-comunicaciones-cumplimiento-avisos.js', tema: `COMUNICACIONES, CUMPLIMIENTO (Habeas Data) y la trastienda. Comunicaciones en borrador, devueltas, aprobadas por otra persona y ENVIADAS por la función de la base (respetando el consentimiento por canal y finalidad y el freno), alguna cancelada; peticiones del titular en todos sus estados y tipos (consulta, rectificación, supresión, revocatoria), con plazos contados en días hábiles, alguna vencida y alguna prorrogada con motivo; avisos en la bandeja de salida en todos sus estados (pendientes, enviados, algunos muertos tras sus intentos) para que la consola tenga qué mostrar; recertificaciones: accesos al día y algunos vencidos.` },
]

phase('Módulos')
const modulos = await parallel(MODULOS.map(m => () => agent(
  `${comun}

SU ENCARGO: poblar ${m.tema}

Usted trabaja en el puesto ${m.n}: arranque con \`${E2E}/slot.sh ${m.n} start cr_pob_nucleo\` (el núcleo ya poblado:
36 sedes, personas, familias, cuentas y roles). Escriba UN SOLO archivo: backend/db/demostracion/${m.archivo}.
No edite comun.js ni 00-red.js ni ningún otro archivo: si le falta una ayuda, póngala dentro de su archivo.

Lo que dejó el agente del núcleo:
- Ayudas de comun.js: ${nucleo.helpers_de_comun}
- Cómo elegir personas: ${nucleo.como_elegir_personas}
${nucleo.notas ? '- Notas: ' + nucleo.notas : ''}

Pruebe su archivo sobre su base: que corre, que no duplica si se corre dos veces, que respeta las reglas y que
es rápido. Abra con ${E2E}/e2e.py las pantallas de sus módulos (app: index.html#/<módulo>; consola: master/#/...)
con el rol que las usa y mire que se vean vivas y creíbles; diga cuáles revisó. Al terminar: \`${E2E}/slot.sh ${m.n} stop\`.`,
  { label: m.archivo, phase: 'Módulos', schema: MODULO }))).then(r => r)

const hechos = modulos.filter(Boolean)
log(`Módulos: ${hechos.filter(x => x.corrio_bien).length} de ${MODULOS.length} corrieron bien`)

phase('Integración')
const integracion = await agent(
  `${comun}

SU ENCARGO: INTEGRAR la red de demostración y dejar la plantilla para los 43 auditores de pestañas.
Ya existen (escritos por otros agentes, que terminaron): backend/db/demostracion/comun.js, 00-red.js, LEEME.md,
los módulos ${MODULOS.map(m => m.archivo).join(', ')}, y backend/scripts/poblar-demostracion.sh.
Informes de los módulos: ${JSON.stringify(hechos.map(x => ({ archivo: x.archivo, corrio_bien: x.corrio_bien, notas: x.notas })))}

Ahora SÍ puede editar cualquier archivo de backend/db/demostracion/ y el script, para que todo corra junto.
Usted trabaja en el puesto 67:
1. \`${E2E}/slot.sh 67 start cr_pob_base\` (base limpia) y corra el poblador COMPLETO con el script, en orden.
   Arregle lo que choque entre archivos (orden, supuestos, duplicados). Mida el tiempo total.
2. Córralo otra vez: no debe duplicar nada (idempotente). Pruebe la guarda: sobre una base con nombre no permitido
   debe negarse sin tocar nada.
3. Con el puesto abajo, corra los 20 bancos de invariantes sobre una copia de la red poblada:
   cree cr_pob_bancos TEMPLATE cr_e2e_67 y ejecute \`cd ${REPO}/backend && PGDATABASE=cr_pob_bancos scripts/probar.sh --rapido\`.
   Si un banco falla, averigüe si es un defecto del poblador (arréglelo), un supuesto frágil del banco (anótelo, no
   lo edite) o un defecto real del sistema que la red destapó (repórtelo con su reproducción). Borre cr_pob_bancos al terminar.
4. Deje la plantilla de los auditores: baje el puesto, cierre conexiones y
   psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS cr_e2e_base" -c "CREATE DATABASE cr_e2e_base TEMPLATE cr_e2e_67"
5. Escriba ${E2E}/directorio.json: para cada rol, las personas que lo tienen (persona_id, nombre, sede, nivel, alcance),
   más ejemplos útiles para probar (un menor con acudiente, un miembro sin rol, una persona de otra sede, un
   líder con su grupo), consultados en cr_e2e_base. Los auditores lo usarán para pedir tokens.
6. Complete backend/db/demostracion/LEEME.md con los conteos finales y el tiempo.`,
  { label: 'integración y plantilla', phase: 'Integración', schema: INTEGRACION })

return { nucleo, modulos: hechos, integracion }
