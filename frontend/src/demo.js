/**
 * MODO DEMOSTRACIÓN.
 *
 * ⛔ LÉASE ESTO ANTES DE TOCAR NADA DE AQUÍ.
 *
 * Este archivo devuelve datos INVENTADOS. Existe por una razón concreta y
 * limitada: que se pueda ver y recorrer la aplicación desde un teléfono
 * mientras la infraestructura no está aplicada y la API solo corre en un
 * portátil. Nada de lo que hay aquí sale de la base real, y nada de lo que
 * se escriba aquí llega a ninguna parte: vive en la memoria de la pestaña
 * y muere al cerrarla.
 *
 * ⛔ NO se enciende solo. Hace falta `?demo=1` en la dirección o
 *    `window.CASAROCA_DEMO = true`. Y cuando está encendido, la aplicación
 *    lo dice ARRIBA, en rojo, en todas las pantallas. Un sistema que
 *    guarda datos de menores no puede parecerse a su demostración sin que
 *    se note: la peor confusión posible es creer que se está mirando la
 *    realidad.
 *
 * Los nombres son inventados a propósito y las sedes llevan «(demo)».
 */

const hoy = new Date();
const d = (dias = 0) => new Date(hoy.getTime() + dias * 86400000).toISOString().slice(0, 10);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/* ⛔ Faltaban `tipo`, `ciudad`, `pais` y `activa`, que la API real sí
   devuelve: tres pantallas pintaban esas columnas EN BLANCO (el Tablero
   de la red, Iglesias y sedes, y el Panel). */
const SEDES = [
  { id: id(1), codigo: 'BOG-NORTE', nombre: 'Bogotá Norte (demo)', tipo: 'sede_madre',
    pais: 'CO', ciudad: 'Bogotá', activa: true, ministerios_activos: 6 },
  { id: id(2), codigo: 'MED', nombre: 'Medellín (demo)', tipo: 'filial_nacional',
    pais: 'CO', ciudad: 'Medellín', activa: true, ministerios_activos: 4 },
  { id: id(3), codigo: 'CHIA', nombre: 'Chía (demo)', tipo: 'plantacion',
    pais: 'CO', ciudad: 'Chía', activa: true, ministerios_activos: 2 },
];

const PERSONAS = [
  'Marta Quiroga Peña', 'Andrés Beltrán Ruiz', 'Lucía Naranjo Díaz', 'Tomás Ibarra Cano',
  'Elena Vargas Toro', 'Julián Espinosa Mora', 'Rosa Cifuentes Lara', 'Damián Rueda Silva',
].map((nombre, i) => ({
  id: id(100 + i), nombre, nombre_completo: nombre,
  numero_documento: String(1020304050 + i * 7), documento: String(1020304050 + i * 7),
  sede: SEDES[i % 3].codigo, sede_codigo: SEDES[i % 3].codigo, estado: 'activa',
}));


/* ═══════════════════════════════════════════════════════════════════
   GOBIERNO DE LA RED · el estado que SÍ cambia
   Lo que se marca en la consola de demostración tiene que quedarse
   marcado mientras dure la pestaña. No llega a ninguna base: vive aquí.
   ═══════════════════════════════════════════════════════════════════ */
const MODULOS_DEMO = [
  { codigo: 'personas',   nombre: 'Personas',              esquema: 'nucleo',    nivel_dato: 2, es_nucleo: true,  exige_compuerta_legal: false, depende_de: null,       orden: 1 },
  { codigo: 'organizacion', nombre: 'Organización y sedes', esquema: 'org',      nivel_dato: 1, es_nucleo: true,  exige_compuerta_legal: false, depende_de: null,       orden: 2 },
  { codigo: 'identidad',  nombre: 'Identidad y accesos',   esquema: 'identidad', nivel_dato: 2, es_nucleo: true,  exige_compuerta_legal: false, depende_de: null,       orden: 3 },
  { codigo: 'auditoria',  nombre: 'Auditoría y cumplimiento', esquema: 'plataforma', nivel_dato: 2, es_nucleo: true, exige_compuerta_legal: false, depende_de: null,   orden: 4 },
  { codigo: 'crm',        nombre: 'CRM Pastoral · 4C',     esquema: 'crm',       nivel_dato: 2, es_nucleo: false, exige_compuerta_legal: false, depende_de: 'personas', orden: 5 },
  { codigo: 'grupos',     nombre: 'Grupos y hogares',      esquema: 'grupos',    nivel_dato: 2, es_nucleo: false, exige_compuerta_legal: false, depende_de: 'personas', orden: 6 },
  { codigo: 'asistencia', nombre: 'Asistencia',            esquema: 'asistencia',nivel_dato: 2, es_nucleo: false, exige_compuerta_legal: false, depende_de: 'personas', orden: 7 },
  { codigo: 'formacion',  nombre: 'Formación e Instituto', esquema: 'formacion', nivel_dato: 2, es_nucleo: false, exige_compuerta_legal: false, depende_de: 'personas', orden: 8 },
  { codigo: 'talento',    nombre: 'Talento y voluntariado',esquema: 'talento',   nivel_dato: 3, es_nucleo: false, exige_compuerta_legal: true,  depende_de: 'personas', orden: 9 },
  { codigo: 'consejeria', nombre: 'Consejería',            esquema: 'consejeria',nivel_dato: 3, es_nucleo: false, exige_compuerta_legal: true,  depende_de: 'personas', orden: 10 },
  { codigo: 'aportes',    nombre: 'Aportes',               esquema: 'aportes',   nivel_dato: 3, es_nucleo: false, exige_compuerta_legal: true,  depende_de: 'personas', orden: 11 },
  { codigo: 'rocakids',   nombre: 'RocaKids',              esquema: 'rocakids',  nivel_dato: 4, es_nucleo: false, exige_compuerta_legal: true,  depende_de: 'personas', orden: 12 },
  { codigo: 'analitica',  nombre: 'Analítica y tableros',  esquema: 'analitica', nivel_dato: 2, es_nucleo: false, exige_compuerta_legal: false, depende_de: null,       orden: 13 },
  { codigo: 'tareas',     nombre: 'Tareas',                esquema: 'tareas',    nivel_dato: 1, es_nucleo: false, exige_compuerta_legal: false, depende_de: null,       orden: 14 },
  { codigo: 'calendario', nombre: 'Calendario',            esquema: 'calendario',nivel_dato: 1, es_nucleo: false, exige_compuerta_legal: false, depende_de: null,       orden: 15 },
  { codigo: 'oracion',    nombre: 'Peticiones de oración', esquema: 'oracion',   nivel_dato: 3, es_nucleo: false, exige_compuerta_legal: true,  depende_de: 'personas', orden: 16 },
  { codigo: 'comunicaciones', nombre: 'Comunicaciones',    esquema: 'notificaciones', nivel_dato: 2, es_nucleo: false, exige_compuerta_legal: false, depende_de: null, orden: 17 },
  { codigo: 'construccion', nombre: 'Construcción',        esquema: 'construccion', nivel_dato: 1, es_nucleo: false, exige_compuerta_legal: false, depende_de: null,   orden: 18 },
  { codigo: 'peticiones', nombre: 'Peticiones internas',   esquema: 'sistema',   nivel_dato: 2, es_nucleo: false, exige_compuerta_legal: false, depende_de: null,       orden: 19 },
  { codigo: 'requerimientos', nombre: 'Requerimientos',    esquema: 'sistema',   nivel_dato: 1, es_nucleo: false, exige_compuerta_legal: false, depende_de: null,       orden: 20 },
  { codigo: 'tematicas',  nombre: 'Temáticas y enseñanza', esquema: 'formacion', nivel_dato: 1, es_nucleo: false, exige_compuerta_legal: false, depende_de: null,       orden: 21 },
  { codigo: 'legal',      nombre: 'Legal',                 esquema: 'plataforma',nivel_dato: 3, es_nucleo: false, exige_compuerta_legal: true,  depende_de: null,       orden: 22 },
  { codigo: 'cumplimiento', nombre: 'Habeas Data',         esquema: 'plataforma',nivel_dato: 2, es_nucleo: false, exige_compuerta_legal: false, depende_de: 'personas', orden: 23 },
];

const ACCIONES_DEMO = [
  { codigo: 'ver', nombre: 'Ver', orden: 1, es_sensible: false, modulo: null },
  { codigo: 'crear', nombre: 'Crear', orden: 2, es_sensible: false, modulo: null },
  { codigo: 'editar', nombre: 'Editar', orden: 3, es_sensible: false, modulo: null },
  { codigo: 'anular', nombre: 'Anular', orden: 4, es_sensible: true, modulo: null },
  { codigo: 'exportar', nombre: 'Exportar', orden: 5, es_sensible: true, modulo: null },
  { codigo: 'administrar', nombre: 'Administrar', orden: 6, es_sensible: true, modulo: null },
  { codigo: 'REGISTRAR_APORTE', nombre: 'Registrar un aporte', orden: 10, es_sensible: false, modulo: 'aportes' },
  { codigo: 'EXPEDIR_CERTIFICADO', nombre: 'Expedir certificado', orden: 11, es_sensible: true, modulo: 'aportes' },
  { codigo: 'VER_REPORTES_FINANCIEROS', nombre: 'Ver reportes financieros', orden: 12, es_sensible: true, modulo: 'aportes' },
  { codigo: 'TOMAR_ASISTENCIA', nombre: 'Tomar asistencia', orden: 13, es_sensible: false, modulo: 'asistencia' },
  { codigo: 'VER_NOTAS_CONFIDENCIALES', nombre: 'Ver notas de consejería', orden: 14, es_sensible: true, modulo: 'consejeria' },
  { codigo: 'ENTREGAR_MENOR', nombre: 'Entregar un menor', orden: 15, es_sensible: true, modulo: 'rocakids' },
  { codigo: 'REGISTRAR_CONTACTO', nombre: 'Registrar contacto', orden: 16, es_sensible: false, modulo: 'crm' },
];

const ROLES_DEMO = [
  { codigo: 'PASTOR_DIRECTOR_GENERAL', nombre: 'Pastor Director General', alcance_maximo: 'organizacion', nivel_maximo: 4, descripcion: 'Dirige la red entera: despliega iglesias y otorga accesos.', activo: true },
  { codigo: 'PASTOR_CONGREGACIONAL', nombre: 'Pastor congregacional', alcance_maximo: 'sede', nivel_maximo: 3, descripcion: 'Pastorea una iglesia y responde por su gente.', activo: true },
  { codigo: 'TESORERIA', nombre: 'Tesorería', alcance_maximo: 'organizacion', nivel_maximo: 3, descripcion: 'Diezmos, ofrendas y certificados de toda la red.', activo: true },
  { codigo: 'CONTABILIDAD', nombre: 'Contabilidad', alcance_maximo: 'organizacion', nivel_maximo: 3, descripcion: 'Contabilidad consolidada de las 36 sedes.', activo: true },
  { codigo: 'SECRETARIA', nombre: 'Secretaría de sede', alcance_maximo: 'sede', nivel_maximo: 2, descripcion: 'Registra personas y lleva la agenda de la sede.', activo: true },
  { codigo: 'MAESTRO_ROCAKIDS', nombre: 'Maestro de RocaKids', alcance_maximo: 'ministerio', nivel_maximo: 4, descripcion: 'Atiende a los menores en su sala.', activo: true },
  { codigo: 'CONSEJERO', nombre: 'Consejero', alcance_maximo: 'caso_propio', nivel_maximo: 3, descripcion: 'Acompaña casos de consejería, solo los suyos.', activo: true },
  { codigo: 'AUDITOR', nombre: 'Auditor', alcance_maximo: 'organizacion', nivel_maximo: 3, descripcion: 'Mira y no toca: revisa sin poder cambiar nada.', activo: true },
];

const NIVELES_DEMO = [
  { nivel: 0, codigo: 'N0', descripcion: 'Público. Puede salir del sistema sin control.', exige_cifrado: false, exige_bitacora_lect: false },
  { nivel: 1, codigo: 'N1', descripcion: 'Interno. Lo ve quien trabaja en la iglesia.', exige_cifrado: false, exige_bitacora_lect: false },
  { nivel: 2, codigo: 'N2', descripcion: 'Personal. Datos de identificación de una persona.', exige_cifrado: false, exige_bitacora_lect: false },
  { nivel: 3, codigo: 'N3', descripcion: 'Sensible. Salud, finanzas, consejería.', exige_cifrado: true, exige_bitacora_lect: true },
  { nivel: 4, codigo: 'N4', descripcion: 'Menores y lo más delicado. Toda lectura queda registrada.', exige_cifrado: true, exige_bitacora_lect: true },
];

const TIPOS_DOC_DEMO = [
  { codigo: 'CC', etiqueta: 'Cédula de ciudadanía', descripcion: 'Mayores de edad colombianos.' },
  { codigo: 'TI', etiqueta: 'Tarjeta de identidad', descripcion: 'De 7 a 17 años.' },
  { codigo: 'RC', etiqueta: 'Registro civil', descripcion: 'Menores de 7 años.' },
  { codigo: 'CE', etiqueta: 'Cédula de extranjería', descripcion: 'Extranjeros residentes.' },
  { codigo: 'PA', etiqueta: 'Pasaporte', descripcion: 'Extranjeros sin cédula de extranjería.' },
];

/* Lo que cambia mientras la pestaña esté abierta. */
const G = {
  roles: ROLES_DEMO.map(r => ({ ...r })),
  /* «ROL|modulo|accion» de lo que está marcado. */
  matriz: new Set([
    'PASTOR_DIRECTOR_GENERAL|personas|ver', 'PASTOR_DIRECTOR_GENERAL|personas|crear',
    'PASTOR_DIRECTOR_GENERAL|personas|editar', 'PASTOR_DIRECTOR_GENERAL|identidad|administrar',
    'PASTOR_CONGREGACIONAL|personas|ver', 'PASTOR_CONGREGACIONAL|personas|crear',
    'PASTOR_CONGREGACIONAL|grupos|ver', 'PASTOR_CONGREGACIONAL|asistencia|ver',
    'PASTOR_CONGREGACIONAL|asistencia|TOMAR_ASISTENCIA',
    'TESORERIA|aportes|ver', 'TESORERIA|aportes|REGISTRAR_APORTE',
    'TESORERIA|aportes|EXPEDIR_CERTIFICADO', 'TESORERIA|aportes|VER_REPORTES_FINANCIEROS',
    'TESORERIA|personas|ver',
    'CONTABILIDAD|aportes|ver', 'CONTABILIDAD|aportes|VER_REPORTES_FINANCIEROS',
    'SECRETARIA|personas|ver', 'SECRETARIA|personas|crear', 'SECRETARIA|calendario|ver',
    'MAESTRO_ROCAKIDS|rocakids|ver', 'MAESTRO_ROCAKIDS|rocakids|ENTREGAR_MENOR',
    'CONSEJERO|consejeria|ver', 'CONSEJERO|consejeria|VER_NOTAS_CONFIDENCIALES',
    'AUDITOR|auditoria|ver', 'AUDITOR|personas|ver', 'AUDITOR|aportes|ver',
  ]),
  plantillas: [
    { codigo: 'PLANTACION', nombre: 'Plantación', tipo_sede: 'plantacion',
      descripcion: 'Lo mínimo para arrancar una iglesia nueva.',
      modulos: new Set(['personas','organizacion','identidad','auditoria','crm','grupos','asistencia','calendario','tareas','comunicaciones']) },
    { codigo: 'FILIAL', nombre: 'Filial nacional', tipo_sede: 'filial_nacional',
      descripcion: 'Una iglesia completa, con aportes y RocaKids.',
      modulos: new Set(MODULOS_DEMO.filter(m => m.codigo !== 'construccion').map(m => m.codigo)) },
  ],
  /* sedeId → { modulo: { activo, evidencia } } */
  modulosSede: {},
  /* Roles otorgados a personas: personaId → [{ id, rol, ... }] */
  asignaciones: {},
};

/* La primera sede nace completa y las otras con la plantilla de plantación. */
for (const [i, sede] of SEDES.entries()) {
  const trae = i === 0 ? G.plantillas[1].modulos : G.plantillas[0].modulos;
  G.modulosSede[sede.id] = {};
  for (const m of MODULOS_DEMO) {
    const dentro = trae.has(m.codigo);
    G.modulosSede[sede.id][m.codigo] = {
      activo: dentro && !m.exige_compuerta_legal,
      evidencia: null,
    };
  }
}
G.modulosSede[SEDES[0].id].aportes = { activo: true, evidencia: 'ACTA-DIAN-2026-03' };

const rolDe = (c) => G.roles.find(r => r.codigo === c);
const accionesDe = (mod) => ACCIONES_DEMO.filter(a => !a.modulo || a.modulo === mod);
const noEnDemo = (m) => { const e = new Error(m); e.demo = true; throw e; };

const ACU_NOMBRES = ['Marta Quiroga Peña', 'Andrés Beltrán Ruiz', 'Rosa Cifuentes Lara', 'Julián Espinosa Mora'];

/* ── RocaKids, Catálogos y las sedes completas ─────────────────────
   Con la forma EXACTA de la API real: un arreglo plano y los mismos
   nombres de campo. Una demostración que devuelve otra forma no enseña
   el sistema: enseña un error de JavaScript. */
const SALAS = [
  { id: id(960), codigo: 'CUNA', nombre: 'Cuna (0 a 2)', sede_id: id(1), sede_codigo: 'BOG-NORTE',
    edad_min: 0, edad_max: 2, capacidad: 20, ninos_dentro: 12, adultos: 3, regla_dos_adultos: true },
  { id: id(961), codigo: 'EXPLO', nombre: 'Exploradores (6 a 8)', sede_id: id(1), sede_codigo: 'BOG-NORTE',
    edad_min: 6, edad_max: 8, capacidad: 30, ninos_dentro: 21, adultos: 1, regla_dos_adultos: false },
  { id: id(962), codigo: 'AVENT', nombre: 'Aventureros (9 a 11)', sede_id: id(2), sede_codigo: 'MED',
    edad_min: 9, edad_max: 11, capacidad: 25, ninos_dentro: 8, adultos: 2, regla_dos_adultos: true },
];

const MENORES = [
  'Sara Quiroga', 'Matías Beltrán', 'Emilia Naranjo', 'Tomás Ibarra',
  'Valentina Vargas', 'Samuel Espinosa', 'Antonia Cifuentes', 'Martín Rueda',
].map((menor, i) => ({
  menor_id: id(820 + i), menor, edad: 1 + (i % 10),
  sala_id: SALAS[i % 3].id, esta_dentro: i < 3, codigo: null,
  alergias: i === 2 ? 'Maní' : null, acudiente_principal: ACU_NOMBRES[i % 4],
}));

const ACUDIENTES = [
  { acudiente: 'Marta Quiroga Peña', parentesco: 'madre', autoriza_retiro: true, telefono: '300 000 0001' },
  { acudiente: 'Andrés Beltrán Ruiz', parentesco: 'padre', autoriza_retiro: true, telefono: '300 000 0002' },
  { acudiente: 'Rosa Cifuentes Lara', parentesco: 'abuela', autoriza_retiro: false, telefono: '300 000 0003' },
];

/* Lo que mira el comité trimestral y la vigilancia de accesos. */
const RECERT = [
  { asignacion_id: id(770), persona_id: id(100), persona: 'Marta Quiroga Peña', rol: 'TESORERIA',
    alcance_tipo: 'organizacion', nivel_max: 3, vigente_desde: d(-260),
    ultima_revision: null, dias_sin_revisar: 260, tope_dias: 90, vencido: true },
  { asignacion_id: id(771), persona_id: id(101), persona: 'Andrés Beltrán Ruiz', rol: 'PASTOR_CONGREGACIONAL',
    alcance_tipo: 'sede', nivel_max: 3, vigente_desde: d(-400),
    ultima_revision: d(-120), dias_sin_revisar: 120, tope_dias: 90, vencido: true },
  { asignacion_id: id(772), persona_id: id(102), persona: 'Lucía Naranjo Díaz', rol: 'SECRETARIA',
    alcance_tipo: 'sede', nivel_max: 2, vigente_desde: d(-40),
    ultima_revision: null, dias_sin_revisar: 40, tope_dias: 180, vencido: false },
];

const SESIONES = [
  { sesion: id(780), usuario: 'marta@casaroca.org', persona_id: id(100), persona: 'Marta Quiroga Peña',
    emitida_en: new Date(Date.now() - 42 * 60000).toISOString(),
    expira_en: new Date(Date.now() + 18 * 60000).toISOString(),
    ip: '190.0.0.2', agente: 'Safari · iPhone', le_queda: '18 min' },
  { sesion: id(781), usuario: 'andrés@casaroca.org', persona_id: id(101), persona: 'Andrés Beltrán Ruiz',
    emitida_en: new Date(Date.now() - 6 * 3600000).toISOString(),
    expira_en: new Date(Date.now() + 2 * 3600000).toISOString(),
    ip: '190.0.0.7', agente: 'Chrome · Windows', le_queda: '2 h 4 min' },
];

const UNIDADES = [
  { id: id(700), codigo: 'CENTRAL', nombre: 'Casa Sobre la Roca · Central', clase: 'central', padre_id: null,
    proposito: 'Administra la red completa: da servicios a las sedes y no las reemplaza.',
    activa: true, padre: null, lider: null, integrantes: '6', roles: '2' },
  { id: id(701), codigo: 'TESORERIA', nombre: 'Tesorería de la red', clase: 'equipo', padre_id: id(700),
    proposito: 'Administra diezmos, ofrendas y certificados de toda la red.',
    activa: true, padre: 'Casa Sobre la Roca · Central', lider: null, integrantes: '3', roles: '1' },
  { id: id(702), codigo: 'CONTA', nombre: 'Contabilidad', clase: 'equipo', padre_id: id(700),
    proposito: 'Lleva la contabilidad consolidada de las 36 sedes.',
    activa: true, padre: 'Casa Sobre la Roca · Central', lider: null, integrantes: '2', roles: '1' },
  { id: id(703), codigo: 'REG-ANDINA', nombre: 'Región Andina', clase: 'region', padre_id: id(700),
    proposito: 'Acompaña a las sedes de la región.',
    activa: true, padre: 'Casa Sobre la Roca · Central', lider: null, integrantes: '1', roles: '0' },
];

const CATALOGOS = [
  { codigo: 'estado_civil', nombre: 'Estado civil',
    descripcion: 'Lista abierta: cambia con la ley y con la realidad de la gente.',
    editable_por_sede: false, cerrado: false, motivo_cerrado: null,
    valores_vigentes: 6, valores_retirados: 1,
    valores: [
      { codigo: 'soltero', etiqueta: 'Soltero o soltera' }, { codigo: 'casado', etiqueta: 'Casado o casada' },
      { codigo: 'union', etiqueta: 'Unión libre' }, { codigo: 'separado', etiqueta: 'Separado o separada' },
      { codigo: 'divorciado', etiqueta: 'Divorciado o divorciada' }, { codigo: 'viudo', etiqueta: 'Viudo o viuda' }] },
  { codigo: 'medio_pago', nombre: 'Medio de pago',
    descripcion: 'Aparecen medios nuevos cada año: se agregan sin tocar código.',
    editable_por_sede: true, cerrado: false, motivo_cerrado: null,
    valores_vigentes: 4, valores_retirados: 0,
    valores: [
      { codigo: 'efectivo', etiqueta: 'Efectivo' }, { codigo: 'transferencia', etiqueta: 'Transferencia' },
      { codigo: 'tarjeta', etiqueta: 'Tarjeta' }, { codigo: 'nequi', etiqueta: 'Nequi' }] },
  { codigo: 'nivel_sensibilidad', nombre: 'Nivel de sensibilidad',
    descripcion: 'Qué tan delicado es un dato.',
    editable_por_sede: false, cerrado: true,
    motivo_cerrado: 'Lo fija la política de datos, no la operación.',
    valores_vigentes: 5, valores_retirados: 0,
    valores: [
      { codigo: 'N0', etiqueta: 'Público' }, { codigo: 'N1', etiqueta: 'Interno' },
      { codigo: 'N2', etiqueta: 'Personal' }, { codigo: 'N3', etiqueta: 'Sensible' },
      { codigo: 'N4', etiqueta: 'Menores y lo más delicado' }] },
  { codigo: 'tipo_grupo', nombre: 'Tipos de grupo', descripcion: 'Cómo se reúne la gente.',
    editable_por_sede: false, cerrado: false, motivo_cerrado: null, valores_vigentes: 4, valores_retirados: 0,
    valores: [{ codigo: 'familiar', etiqueta: 'Familiar' }, { codigo: 'pequeno', etiqueta: 'Grupo pequeño' }, { codigo: 'discipulado', etiqueta: 'Discipulado' }, { codigo: 'ministerial', etiqueta: 'Ministerial' }] },
  { codigo: 'tipo_servicio', nombre: 'Tipos de servicio', descripcion: 'Qué clase de reunión se abre para marcar asistencia.',
    editable_por_sede: false, cerrado: false, motivo_cerrado: null, valores_vigentes: 5, valores_retirados: 0,
    valores: [{ codigo: 'dominical', etiqueta: 'Dominical' }, { codigo: 'entre_semana', etiqueta: 'Entre semana' }, { codigo: 'oracion', etiqueta: 'Oración' }, { codigo: 'especial', etiqueta: 'Especial' }, { codigo: 'celula', etiqueta: 'Célula' }] },
  { codigo: 'modalidad_formacion', nombre: 'Modalidades de formación', descripcion: 'Presencial, virtual o mixta.',
    editable_por_sede: false, cerrado: false, motivo_cerrado: null, valores_vigentes: 3, valores_retirados: 0,
    valores: [{ codigo: 'presencial', etiqueta: 'Presencial' }, { codigo: 'virtual', etiqueta: 'Virtual' }, { codigo: 'mixta', etiqueta: 'Mixta' }] },
  { codigo: 'tipo_aporte', nombre: 'Tipos de aporte', descripcion: 'Diezmo, ofrenda y los demás.',
    editable_por_sede: false, cerrado: false, motivo_cerrado: null, valores_vigentes: 5, valores_retirados: 0,
    valores: [{ codigo: 'diezmo', etiqueta: 'Diezmo' }, { codigo: 'ofrenda', etiqueta: 'Ofrenda' }, { codigo: 'primicia', etiqueta: 'Primicia' }, { codigo: 'proyecto', etiqueta: 'Proyecto' }, { codigo: 'donacion', etiqueta: 'Donación' }] },
  { codigo: 'categoria_oracion', nombre: 'Categorías de oración', descripcion: 'Para dirigir la petición a quien intercede por ese tema.',
    editable_por_sede: false, cerrado: false, motivo_cerrado: null, valores_vigentes: 6, valores_retirados: 0,
    valores: [{ codigo: 'salud', etiqueta: 'Salud' }, { codigo: 'familia', etiqueta: 'Familia y hogar' }, { codigo: 'duelo', etiqueta: 'Duelo' }, { codigo: 'trabajo', etiqueta: 'Trabajo y finanzas' }, { codigo: 'espiritual', etiqueta: 'Vida espiritual' }, { codigo: 'gratitud', etiqueta: 'Gratitud' }] },
  { codigo: 'tipo_evento', nombre: 'Tipos de evento', descripcion: 'Qué clase de cosa se agenda.',
    editable_por_sede: false, cerrado: false, motivo_cerrado: null, valores_vigentes: 5, valores_retirados: 0,
    valores: [{ codigo: 'servicio', etiqueta: 'Servicio' }, { codigo: 'reunion', etiqueta: 'Reunión' }, { codigo: 'retiro', etiqueta: 'Retiro' }, { codigo: 'conferencia', etiqueta: 'Conferencia' }, { codigo: 'capacitacion', etiqueta: 'Capacitación' }] },
  { codigo: 'categoria_requerimiento', nombre: 'Categorías de requerimiento', descripcion: 'Las áreas de la mesa de servicio.',
    editable_por_sede: false, cerrado: false, motivo_cerrado: null, valores_vigentes: 5, valores_retirados: 0,
    valores: [{ codigo: 'mantenimiento', etiqueta: 'Mantenimiento' }, { codigo: 'tecnologia', etiqueta: 'Tecnología' }, { codigo: 'sonido_video', etiqueta: 'Sonido y video' }, { codigo: 'compras', etiqueta: 'Compras' }, { codigo: 'logistica', etiqueta: 'Logística' }] },
  { codigo: 'tipo_peticion_interna', nombre: 'Tipos de petición interna', descripcion: 'Lo que se le pide a la dirección.',
    editable_por_sede: false, cerrado: false, motivo_cerrado: null, valores_vigentes: 4, valores_retirados: 0,
    valores: [{ codigo: 'permiso', etiqueta: 'Permiso' }, { codigo: 'presupuesto', etiqueta: 'Presupuesto' }, { codigo: 'compra', etiqueta: 'Compra' }, { codigo: 'autorizacion', etiqueta: 'Autorización' }] },
  { codigo: 'tipo_asunto_legal', nombre: 'Tipos de asunto legal', descripcion: 'La clase de asunto jurídico.',
    editable_por_sede: false, cerrado: false, motivo_cerrado: null, valores_vigentes: 5, valores_retirados: 0,
    valores: [{ codigo: 'contrato', etiqueta: 'Contrato' }, { codigo: 'arrendamiento', etiqueta: 'Arrendamiento' }, { codigo: 'laboral', etiqueta: 'Laboral' }, { codigo: 'derecho_peticion', etiqueta: 'Derecho de petición' }, { codigo: 'tutela', etiqueta: 'Tutela' }] },
  { codigo: 'tipo_obra', nombre: 'Tipos de obra', descripcion: 'La clase de obra física.',
    editable_por_sede: false, cerrado: false, motivo_cerrado: null, valores_vigentes: 4, valores_retirados: 0,
    valores: [{ codigo: 'construccion', etiqueta: 'Construcción' }, { codigo: 'ampliacion', etiqueta: 'Ampliación' }, { codigo: 'remodelacion', etiqueta: 'Remodelación' }, { codigo: 'mantenimiento_mayor', etiqueta: 'Mantenimiento mayor' }] },
];

const SERVICIOS = [
  { id: id(200), sede: 'BOG-NORTE', fecha: d(0), hora: '09:00', tipo: 'dominical', nombre: 'Primera reunión', marcados: 3, contados: 412, adultos: 280, jovenes: 70, ninos: 62, primera_vez: 9 },
  { id: id(201), sede: 'BOG-NORTE', fecha: d(-7), hora: '09:00', tipo: 'dominical', nombre: 'Primera reunión', marcados: 5, contados: 398, adultos: 270, jovenes: 66, ninos: 62, primera_vez: 6 },
  { id: id(202), sede: 'MED', fecha: d(0), hora: '10:30', tipo: 'dominical', nombre: null, marcados: 0, contados: null },
];

const GRUPOS = [
  { id: id(300), nombre: 'Hogar Los Rosales', tipo: 'hogar', sede: 'BOG-NORTE', dia_reunion: 'jueves', hora: '19:30', cupo: 14, miembros: 11, ultima_reunion: d(-4), dias_sin_reunirse: 4 },
  { id: id(301), nombre: 'Crecimiento Chapinero', tipo: 'pequeno', sede: 'BOG-NORTE', dia_reunion: 'martes', hora: '19:00', cupo: 12, miembros: 9, ultima_reunion: d(-52), dias_sin_reunirse: 52 },
  { id: id(302), nombre: 'Jóvenes Medellín', tipo: 'pequeno', sede: 'MED', dia_reunion: 'viernes', hora: '18:00', cupo: 20, miembros: 17, ultima_reunion: null, dias_sin_reunirse: null },
];

const CASOS = [
  { id: id(400), estado: 'en_proceso', topico: 'FAM', topico_nombre: 'Familia y matrimonio', requiere_profesional: false, sede: 'BOG-NORTE', consultante: 'Marta Quiroga Peña', dias_abierto: 23, sesiones: 3, ultima_sesion: d(-5), consejeros: 'Rosa Cifuentes Lara' },
  { id: id(401), estado: 'abierto', topico: 'DUELO', topico_nombre: 'Duelo', requiere_profesional: false, sede: 'MED', consultante: 'Tomás Ibarra Cano', dias_abierto: 2, sesiones: 0, ultima_sesion: null, consejeros: null },
];

const COHORTES = [
  { id: id(500), codigo: '2026-2', modalidad: 'presencial', inicia: d(-30), termina: d(60), cupo: 25, valor: '180000.00', moneda: 'COP', sede: 'BOG-NORTE', curso: 'Fundamentos de la fe', programa: 'Instituto Bíblico', docente: 'Julián Espinosa Mora', inscritos: 22, otorga_certificado: true },
  { id: id(501), codigo: 'KID-2026', modalidad: 'mixta', inicia: d(-10), termina: null, cupo: 12, valor: null, moneda: 'COP', sede: 'MED', curso: 'Enseñar a niños', programa: 'Formación de maestros', docente: null, inscritos: 14, otorga_certificado: true },
];

const VOLUNTARIADOS = [
  { id: id(600), persona_id: id(105), nombre_completo: 'Julián Espinosa Mora', funcion: 'Maestro de sala', estado: 'activo', desde: d(-400), hasta: null, trabaja_con_menores: true, apto_para_menores: true, ministerio: 'RocaKids', sede: 'BOG-NORTE' },
  { id: id(601), persona_id: id(107), nombre_completo: 'Damián Rueda Silva', funcion: 'Apoyo de sala', estado: 'activo', desde: d(-30), hasta: null, trabaja_con_menores: true, apto_para_menores: false, ministerio: 'RocaKids', sede: 'MED' },
  { id: id(602), persona_id: id(104), nombre_completo: 'Elena Vargas Toro', funcion: 'Ujier', estado: 'activo', desde: d(-90), hasta: null, trabaja_con_menores: false, apto_para_menores: false, ministerio: 'Servicio', sede: 'CHIA' },
];


/* ── 21 sep 2026 · Datos de ejemplo de los trece módulos que estrenan
   pantalla. Inventados, en la memoria de esta pestaña, y reaccionan: lo
   que se registra aparece en la lista hasta cerrar la pestaña. ── */
const hace = (h) => new Date(hoy.getTime() - h * 3600000).toISOString();
const N = {
  oracion: [
    { id: id(800), sede: 'BOG-NORTE', categoria: 'salud', categoria_nombre: 'Salud', resumen: 'Cirugía de su hija el jueves', quien: 'Marta Quiroga Peña',
      confidencial: false, compartida: true, estado: 'en_oracion', origen: 'interno', fecha: d(-3), veces_orada: 4, ultima_oracion: d(-1),
      detalle: 'La operan el jueves a las 7 a. m. Pide oración por los médicos y por la calma de la familia.', contacto: '300 000 0000' },
    { id: id(801), sede: 'MED', categoria: 'familia', categoria_nombre: 'Familia y hogar', resumen: 'Restauración de su matrimonio', quien: 'Hermana de Medellín',
      confidencial: true, compartida: false, estado: 'abierta', origen: 'formulario_publico', fecha: d(-1), veces_orada: 0, ultima_oracion: null,
      detalle: 'Solo para los pastores.', contacto: null },
    { id: id(802), sede: 'CHIA', categoria: 'trabajo', categoria_nombre: 'Trabajo y finanzas', resumen: 'Entrevista de trabajo el lunes', quien: 'Tomás Ibarra Cano',
      confidencial: false, compartida: true, estado: 'respondida', origen: 'interno', fecha: d(-12), veces_orada: 7, ultima_oracion: d(-6),
      detalle: 'Lleva ocho meses sin empleo.', contacto: null, respuesta: 'Lo contrataron. Empieza el 1 de octubre.' },
  ],
  oraciones: { [id(800)]: [{ cuando: d(-1) + ' 21:10', quien: 'Rosa Cifuentes Lara', nota: 'Oramos en la vigilia del jueves' }] },
  peticiones: [
    { id: id(810), sede: 'MED', tipo: 'presupuesto', tipo_nombre: 'Presupuesto', asunto: 'Dos micrófonos inalámbricos', prioridad: 'alta', estado: 'enviada',
      solicitante: 'Pastor de Medellín', fecha: d(-9), dias: 9, detalle: 'Se dañaron dos micrófonos del culto de jóvenes.', es_mia: false },
    { id: id(811), sede: 'CHIA', tipo: 'permiso', tipo_nombre: 'Permiso', asunto: 'Usar el salón para un retiro de parejas', prioridad: 'normal', estado: 'aprobada',
      solicitante: 'Pastores de Chía', fecha: d(-20), dias: 20, detalle: 'Retiro de un día el 18 de octubre.', decision: 'Aprobado. Coordinar el aseo con logística.',
      decidida_por: 'Director General', decidida_en: d(-15), es_mia: false },
  ],
  requerimientos: [
    { id: id(820), sede: 'BOG-NORTE', categoria: 'sonido_video', categoria_nombre: 'Sonido y video', asunto: 'Se cayó la consola de sonido', prioridad: 'urgente',
      estado: 'en_curso', asignado: 'Andrés Beltrán Ruiz', reportado: d(0) + ' 08:10', vence: d(0) + ' 12:10', vencido: false },
    { id: id(821), sede: 'MED', categoria: 'mantenimiento', categoria_nombre: 'Mantenimiento', asunto: 'Gotera en el salón infantil', prioridad: 'alta',
      estado: 'nuevo', asignado: null, reportado: d(-2) + ' 10:00', vence: d(-1) + ' 10:00', vencido: true },
  ],
  tareas: [
    { id: id(830), sede: 'BOG-NORTE', titulo: 'Llamar a los 12 nuevos del domingo', prioridad: 'alta', estado: 'pendiente', asignada: 'Visitante de la demostración', es_mia: true, vence: d(1), vencida: false },
    { id: id(831), sede: 'CHIA', titulo: 'Enviar el informe de asistencia de septiembre', prioridad: 'normal', estado: 'pendiente', asignada: 'Elena Vargas Toro', es_mia: false, vence: d(-2), vencida: true },
  ],
  eventos: [
    { id: id(840), sede: 'BOG-NORTE', alcance_red: true, tipo: 'conferencia', tipo_nombre: 'Conferencia', titulo: 'Conferencia anual de la red', lugar: 'Sede principal',
      inicia: d(20) + ' 09:00', termina: d(20) + ' 17:00', estado: 'programado', responsable: 'Director General' },
    { id: id(841), sede: 'MED', alcance_red: false, tipo: 'servicio', tipo_nombre: 'Servicio', titulo: 'Culto de jóvenes', lugar: 'Auditorio',
      inicia: d(5) + ' 18:00', termina: d(5) + ' 20:00', estado: 'programado', responsable: 'Julián Espinosa Mora' },
  ],
  series: [
    { id: id(850), sede: 'BOG-NORTE', alcance_red: true, titulo: 'Fundamentos', descripcion: 'Ocho semanas sobre la roca firme.', estado: 'en_curso',
      inicia: d(-21), termina: d(35), ensenanzas: 3, ultima: d(-7) },
  ],
  ensenanzas: { [id(850)]: [
    { titulo: 'La roca firme', fecha: d(-21), predicador: 'Pastor principal', pasaje: 'Mateo 7:24-27', resumen: 'Oír y hacer.' },
    { titulo: 'La casa en orden', fecha: d(-14), predicador: 'Pastora principal', pasaje: 'Josué 24:15', resumen: '' },
    { titulo: 'Servir con gozo', fecha: d(-7), predicador: 'Pastor invitado', pasaje: 'Gálatas 5:13', resumen: '' },
  ] },
  legal: [
    { id: id(860), sede: 'MED', tipo: 'arrendamiento', tipo_nombre: 'Arrendamiento', titulo: 'Renovación del arriendo del local', estado: 'en_tramite',
      responsable: 'Director General', vence: d(10), vence_pronto: true, actuaciones: 2, contraparte: 'Inmobiliaria del ejemplo' },
  ],
  actuaciones: { [id(860)]: [
    { cuando: d(-10) + ' 09:00', autor: 'Director General', contenido: 'Se pidió la propuesta de renovación.' },
    { cuando: d(-3) + ' 16:30', autor: 'Director General', contenido: 'Llegó la propuesta: incremento del IPC.' },
  ] },
  comunicaciones: [
    { id: id(870), sede: 'BOG-NORTE', asunto: 'Retiro de grupos del 18 de octubre', finalidad: 'convocatoria', destinatarios: 'miembros_sede', grupo: null,
      estado: 'borrador', autor: 'Andrés Beltrán Ruiz', aprobo: null, es_mia: false, creada: d(-1), encolados: null, omitidos_sin_consentimiento: null,
      cuerpo: 'Los esperamos el sábado 18 de octubre en el retiro de grupos.\n\nInscripciones con su líder.' },
  ],
  obras: [
    { id: id(880), sede: 'MED', nombre: 'Ampliación del salón infantil', tipo: 'ampliacion', tipo_nombre: 'Ampliación', estado: 'en_curso', avance_pct: 40,
      presupuesto: 80000000, ejecutado: 44000000, moneda: 'COP', ejecutado_pct: 55, termina_estimado: d(90), responsable: 'Damián Rueda Silva' },
  ],
  hitos: { [id(880)]: [
    { fecha: d(-40), descripcion: 'Cimientos terminados', avance_pct: 20, gasto: 24000000, registro: 'Damián Rueda Silva' },
    { fecha: d(-10), descripcion: 'Muros levantados', avance_pct: 40, gasto: 20000000, registro: 'Damián Rueda Silva' },
  ] },
  nuevos: [
    { id: id(890), nombre: 'Camila Rojas', telefono: '300 111 2233', email: null, estado: 'nuevo', prioridad: 'alta', proxima_accion: 'ATRASADO',
      contactos: 0, ultimo_contacto: null, registrado_en: d(-4), como_supo: 'Un amigo' },
    { id: id(891), nombre: 'Felipe Duarte', telefono: '310 222 3344', email: 'felipe@example.org', estado: 'contactado', prioridad: 'media',
      proxima_accion: 'Invitarlo a un grupo', contactos: 1, ultimo_contacto: d(-2), registrado_en: d(-9), como_supo: 'Redes sociales' },
  ],
  aportes: [
    { id: id(900), nombre_completo: 'Marta Quiroga Peña', tipo_aporte: 'DIEZMO', monto: '350000.00', moneda: 'COP', fecha_aporte: d(-2), metodo_pago: 'TRANSFERENCIA', estado: 'REGISTRADO', inmutable: false, referencia: 'TRX-4471' },
    { id: id(901), nombre_completo: null, tipo_aporte: 'OFRENDA', monto: '1250000.00', moneda: 'COP', fecha_aporte: d(-2), metodo_pago: 'EFECTIVO', estado: 'CONFIRMADO', inmutable: true, referencia: 'Sobre 12' },
  ],
  titulares: [
    { id: id(910), radicado: 'HD-2026-0007', tipo: 'consulta', estado: 'recibida', titular_nombre: 'Titular del ejemplo', titular_contacto: 'titular@example.org',
      recibida_en: d(-3), vence_en: d(11), vencida: false, dias_restantes: 11 },
  ],
};
const buscar = (lista, x) => lista.find(e => e.id === x);
const demoGuarda = (mensaje) => ({ mensaje: mensaje + ' (demostración: vive solo en esta pestaña)' });

/** Respuestas por ruta. La clave es «MÉTODO ruta» con los identificadores
    sustituidos por `:id`, igual que las declara el servidor. */
function responder(metodo, ruta, cuerpo = null) {
  const u = new URL(ruta, 'http://demo');
  const p = u.pathname.replace(/\/api\/v1/, '');
  const trozos = p.split('/').filter(Boolean);
  const q = u.searchParams;

  const M = {
    'POST /auth/entrar': () => ({ acceso: 'demo', refresco: 'demo', debeCambiarClave: false }),
    'POST /auth/salir': () => ({ ok: true }),
    'GET /sesion/yo': () => ({
      persona: { id: id(999), nombre: 'Visitante de la demostración', correo: null, documento: null },
      alcance: { sedes: SEDES.map(s => s.id), todaLaRed: true, nivelMax: 4 },
      asignaciones: [{ rol: 'PASTOR_DIRECTOR_GENERAL', rol_nombre: 'Pastor Director General',
                       alcance_tipo: 'organizacion', nivel_max: 4, vigente_desde: d(-900), vigente_hasta: null }],
      /* ⛔ Pintaba el CÓDIGO en minúscula («rocakids») en vez del nombre
         («RocaKids»), metía un módulo llamado 'sistemas' que NO EXISTE, y
         daba a Aportes un nivel de dato 2 cuando es 3. Los nombres y los
         niveles ya están en `MODULOS_DEMO`, en este mismo fichero. */
      modulos: MODULOS_DEMO
        .map(m => ({ modulo: m.codigo, nombre: m.nombre, nivel_dato: m.nivel_dato })),
    }),
    // ── Los trece módulos con pantalla nueva ────────────────────────
    'GET /oracion': () => ({ total_filas: N.oracion.length, desde: 0, puede_registrar: true,
      peticiones: N.oracion.filter(x => !q.get('estado') || x.estado === q.get('estado')) }),
    'POST /oracion': () => { const n = { id: id(800 + N.oracion.length + 10), sede: 'BOG-NORTE', categoria: cuerpo?.categoria, categoria_nombre: cuerpo?.categoria,
        resumen: cuerpo?.resumen, quien: cuerpo?.nombreContacto ?? 'Persona registrada', confidencial: !!cuerpo?.confidencial, compartida: !!cuerpo?.compartir,
        estado: 'abierta', origen: 'interno', fecha: d(0), veces_orada: 0, detalle: cuerpo?.detalle ?? '', contacto: cuerpo?.contacto ?? null };
      N.oracion.unshift(n); return { id: n.id, ...demoGuarda('Petición registrada.') }; },
    'GET /oracion/:id': () => { const p = buscar(N.oracion, trozos[1]); if (!p) throw Object.assign(new Error('Esa petición no existe.'), { estado: 404 });
      return { peticion: { ...p, creada: p.fecha, registrada_por: 'Equipo de oración' },
               oraciones: N.oraciones[p.id] ?? [], puede_responder: true }; },
    'POST /oracion/:id/orar': () => { (N.oraciones[trozos[1]] ??= []).unshift({ cuando: d(0) + ' ahora', quien: 'Visitante de la demostración', nota: cuerpo?.nota ?? null });
      const p = buscar(N.oracion, trozos[1]); if (p) { p.veces_orada++; p.ultima_oracion = d(0); if (p.estado === 'abierta') p.estado = 'en_oracion'; }
      return demoGuarda('Quedó registrado que oró por esta petición.'); },
    'POST /oracion/:id/estado': () => { const p = buscar(N.oracion, trozos[1]); if (p) { p.estado = cuerpo?.estado; if (cuerpo?.respuesta) { p.respuesta = cuerpo.respuesta; p.respondida_en = d(0); } }
      return demoGuarda('Estado actualizado.'); },
    'GET /peticiones': () => ({ total_filas: N.peticiones.length, desde: 0, peticiones: N.peticiones, puede_decidir: true }),
    'POST /peticiones': () => { N.peticiones.unshift({ id: id(815 + N.peticiones.length), sede: 'BOG-NORTE', tipo: cuerpo?.tipo, tipo_nombre: cuerpo?.tipo, asunto: cuerpo?.asunto,
        prioridad: cuerpo?.prioridad ?? 'normal', estado: 'enviada', solicitante: 'Visitante de la demostración', fecha: d(0), dias: 0, detalle: cuerpo?.detalle, es_mia: true });
      return demoGuarda('Petición enviada a la dirección.'); },
    'GET /peticiones/:id': () => { const p = buscar(N.peticiones, trozos[1]);
      return { peticion: { ...p, decidida_por_nombre: p?.decidida_por }, es_mia: !!p?.es_mia, puede_decidir: true }; },
    'POST /peticiones/:id/decidir': () => { const p = buscar(N.peticiones, trozos[1]); if (p) { p.estado = cuerpo?.estado; p.decision = cuerpo?.decision ?? p.decision; p.decidida_por = 'Visitante de la demostración'; p.decidida_en = d(0); }
      return demoGuarda('Petición ' + (cuerpo?.estado ?? '') + '.'); },
    'POST /peticiones/:id/cancelar': () => { const p = buscar(N.peticiones, trozos[1]); if (p) p.estado = 'cancelada'; return demoGuarda('Petición retirada.'); },
    'GET /requerimientos': () => ({ total_filas: N.requerimientos.length, desde: 0, puede_atender: true,
      requerimientos: N.requerimientos.filter(r => q.get('abiertos') !== 'si' || !['resuelto', 'cerrado', 'cancelado'].includes(r.estado)),
      aviso: N.requerimientos.some(r => r.vencido) ? '1 requerimiento(s) vencidos sin resolver.' : null }),
    'POST /requerimientos': () => { N.requerimientos.unshift({ id: id(825 + N.requerimientos.length), sede: 'BOG-NORTE', categoria: cuerpo?.categoria, categoria_nombre: cuerpo?.categoria,
        asunto: cuerpo?.asunto, prioridad: cuerpo?.prioridad ?? 'media', estado: 'nuevo', asignado: null, reportado: d(0), vence: d(3), vencido: false });
      return demoGuarda('Requerimiento reportado.'); },
    'GET /requerimientos/:id': () => { const r = buscar(N.requerimientos, trozos[1]);
      return { requerimiento: { ...r, reportado_por_nombre: 'Secretaría', vence_en: new Date().toISOString() }, puede_atender: true }; },
    'POST /requerimientos/:id/atender': () => { const r = buscar(N.requerimientos, trozos[1]); if (r) { r.estado = cuerpo?.estado; if (cuerpo?.solucion) r.solucion = cuerpo.solucion; }
      return demoGuarda('Requerimiento actualizado.'); },
    'GET /tareas': () => ({ total_filas: N.tareas.length, desde: 0,
      tareas: N.tareas.filter(t => (q.get('mias') !== 'si' || t.es_mia) && (q.get('abiertas') !== 'si' || ['pendiente', 'en_curso'].includes(t.estado))) }),
    'POST /tareas': () => { N.tareas.unshift({ id: id(835 + N.tareas.length), sede: 'BOG-NORTE', titulo: cuerpo?.titulo, prioridad: cuerpo?.prioridad ?? 'normal',
        estado: 'pendiente', asignada: 'Visitante de la demostración', es_mia: true, vence: cuerpo?.venceEn ?? null, vencida: false });
      return demoGuarda('Tarea creada.'); },
    'POST /tareas/:id/estado': () => { const t = buscar(N.tareas, trozos[1]); if (t) t.estado = cuerpo?.estado; return demoGuarda('Tarea actualizada.'); },
    'GET /calendario': () => ({ total_filas: N.eventos.length, desde: 0, eventos: N.eventos, puede_crear: true }),
    'POST /calendario': () => { N.eventos.push({ id: id(845 + N.eventos.length), sede: 'BOG-NORTE', alcance_red: !!cuerpo?.alcanceRed, tipo: cuerpo?.tipo, tipo_nombre: cuerpo?.tipo,
        titulo: cuerpo?.titulo, lugar: cuerpo?.lugar ?? null, inicia: String(cuerpo?.inicia ?? '').replace('T', ' '), termina: String(cuerpo?.termina ?? '').replace('T', ' '),
        estado: 'programado', responsable: null }); return demoGuarda('Evento agendado.'); },
    'POST /calendario/:id/cancelar': () => { const e = buscar(N.eventos, trozos[1]); if (e) { e.estado = 'cancelado'; e.motivo_cancelacion = cuerpo?.motivo; } return demoGuarda('Evento cancelado.'); },
    'POST /calendario/:id/realizado': () => { const e = buscar(N.eventos, trozos[1]); if (e) e.estado = 'realizado'; return demoGuarda('Evento marcado como realizado.'); },
    'GET /tematicas': () => ({ total_filas: N.series.length, desde: 0, series: N.series, puede_crear: true }),
    'POST /tematicas': () => { N.series.unshift({ id: id(855 + N.series.length), sede: 'BOG-NORTE', alcance_red: !!cuerpo?.alcanceRed, titulo: cuerpo?.titulo,
        descripcion: cuerpo?.descripcion ?? '', estado: 'planeada', inicia: cuerpo?.inicia ?? null, termina: cuerpo?.termina ?? null, ensenanzas: 0, ultima: null });
      return demoGuarda('Serie creada.'); },
    'GET /tematicas/:id': () => ({ serie: buscar(N.series, trozos[1]), ensenanzas: N.ensenanzas[trozos[1]] ?? [], puede_editar: true }),
    'POST /tematicas/:id/ensenanzas': () => { (N.ensenanzas[trozos[1]] ??= []).push({ titulo: cuerpo?.titulo, fecha: cuerpo?.fecha, predicador: cuerpo?.predicador ?? null,
        pasaje: cuerpo?.pasaje ?? null, resumen: cuerpo?.resumen ?? '' }); return demoGuarda('Enseñanza agregada a la serie.'); },
    'POST /tematicas/:id/estado': () => { const x = buscar(N.series, trozos[1]); if (x) x.estado = cuerpo?.estado; return demoGuarda('Serie actualizada.'); },
    'GET /legal': () => ({ total_filas: N.legal.length, desde: 0, asuntos: N.legal, puede_crear: true,
      aviso: '1 asunto(s) con término en los próximos 15 días o ya vencido.' }),
    'POST /legal': () => { N.legal.unshift({ id: id(865 + N.legal.length), sede: 'BOG-NORTE', tipo: cuerpo?.tipo, tipo_nombre: cuerpo?.tipo, titulo: cuerpo?.titulo,
        estado: 'abierto', responsable: null, vence: cuerpo?.venceEn ?? null, vence_pronto: false, actuaciones: 0, contraparte: cuerpo?.contraparte ?? null });
      return demoGuarda('Asunto legal abierto.'); },
    'GET /legal/:id': () => { const a = buscar(N.legal, trozos[1]);
      return { asunto: { ...a, vence_en: a?.vence }, actuaciones: N.actuaciones[trozos[1]] ?? [], puede_editar: true }; },
    'POST /legal/:id/actuaciones': () => { (N.actuaciones[trozos[1]] ??= []).push({ cuando: d(0) + ' ahora', autor: 'Visitante de la demostración', contenido: cuerpo?.contenido });
      const a = buscar(N.legal, trozos[1]); if (a) a.actuaciones++; return demoGuarda('Actuación registrada. No se puede editar después.'); },
    'POST /legal/:id/estado': () => { const a = buscar(N.legal, trozos[1]); if (a) { a.estado = cuerpo?.estado; if (cuerpo?.resultado) a.resultado = cuerpo.resultado; }
      return demoGuarda('Asunto actualizado.'); },
    'GET /comunicaciones': () => ({ total_filas: N.comunicaciones.length, desde: 0, comunicaciones: N.comunicaciones,
      freno: { activo: !!N.freno, motivo: N.freno ?? null }, puede_aprobar: true,
      aviso: N.freno ? `El freno de envíos masivos está puesto: ${N.freno}. No sale nada.` : null }),
    'POST /comunicaciones': () => { N.comunicaciones.unshift({ id: id(875 + N.comunicaciones.length), sede: 'BOG-NORTE', asunto: cuerpo?.asunto, finalidad: cuerpo?.finalidad,
        destinatarios: cuerpo?.destinatarios, grupo: null, estado: 'borrador', autor: 'Visitante de la demostración', aprobo: null, es_mia: true, creada: d(0),
        cuerpo: cuerpo?.cuerpo }); return demoGuarda('Borrador guardado. Para enviarlo, lo aprueba otra persona.'); },
    'GET /comunicaciones/:id': () => { const k = buscar(N.comunicaciones, trozos[1]);
      return { comunicacion: k, alcance: { personas: 214, recibirian: 171, sin_correo: 12, sin_autorizacion: 31 },
               puede_aprobar: !k?.es_mia, es_mia: !!k?.es_mia }; },
    'POST /comunicaciones/:id/aprobar': () => { const k = buscar(N.comunicaciones, trozos[1]);
      if (k?.es_mia) throw Object.assign(new Error('Quien escribe un envío masivo no se lo aprueba: lo aprueba otra persona.'), { estado: 400 });
      if (k) { k.estado = 'aprobada'; k.aprobo = 'Visitante de la demostración'; } return demoGuarda('Aprobada. Ya se puede enviar.'); },
    'POST /comunicaciones/:id/enviar': () => { if (N.freno) throw Object.assign(new Error('El freno de envíos masivos está puesto: no sale nada hasta que la central lo quite.'), { estado: 400 });
      const k = buscar(N.comunicaciones, trozos[1]); if (k) { k.estado = 'enviada'; k.encolados = 171; k.omitidos_sin_consentimiento = 31; k.enviada_en = d(0); }
      return { encolados: 171, omitidos_sin_consentimiento: 31, sin_correo: 12,
               mensaje: 'En cola para 171 persona(s). 31 no autorizaron este tipo de comunicación y no la reciben. (demostración)' }; },
    'POST /comunicaciones/:id/devolver': () => { const k = buscar(N.comunicaciones, trozos[1]); if (k) { k.estado = 'borrador'; k.aprobo = null; } return demoGuarda('Devuelta a borrador.'); },
    'POST /comunicaciones/:id/editar': () => { const k = buscar(N.comunicaciones, trozos[1]); if (k) { k.asunto = cuerpo?.asunto; k.cuerpo = cuerpo?.cuerpo; } return demoGuarda('Borrador actualizado.'); },
    'POST /comunicaciones/:id/cancelar': () => { const k = buscar(N.comunicaciones, trozos[1]); if (k) k.estado = 'cancelada'; return demoGuarda('Comunicación cancelada.'); },
    'POST /comunicaciones/freno': () => { N.freno = cuerpo?.activo ? cuerpo?.motivo : null; return demoGuarda(cuerpo?.activo ? 'Freno puesto.' : 'Freno quitado.'); },
    'GET /construccion': () => ({ total_filas: N.obras.length, desde: 0, obras: N.obras, puede_crear: true,
      aviso: '1 obra(s) gastan más de lo que avanzan (más de 15 puntos de diferencia).' }),
    'POST /construccion': () => { N.obras.unshift({ id: id(885 + N.obras.length), sede: 'BOG-NORTE', nombre: cuerpo?.nombre, tipo: cuerpo?.tipo, tipo_nombre: cuerpo?.tipo,
        estado: 'planeada', avance_pct: 0, presupuesto: Number(cuerpo?.presupuesto ?? 0), ejecutado: 0, moneda: cuerpo?.moneda ?? 'COP', ejecutado_pct: 0,
        termina_estimado: cuerpo?.terminaEstimado ?? null, responsable: null }); return demoGuarda('Obra registrada.'); },
    'GET /construccion/:id': () => ({ obra: buscar(N.obras, trozos[1]), hitos: N.hitos[trozos[1]] ?? [], puede_editar: true }),
    'POST /construccion/:id/hitos': () => { const o = buscar(N.obras, trozos[1]);
      (N.hitos[trozos[1]] ??= []).push({ fecha: cuerpo?.fecha, descripcion: cuerpo?.descripcion, avance_pct: cuerpo?.avancePct ?? null, gasto: cuerpo?.gasto ?? null, registro: 'Visitante de la demostración' });
      if (o) { o.avance_pct = Math.max(o.avance_pct, Number(cuerpo?.avancePct ?? 0)); o.ejecutado += Number(cuerpo?.gasto ?? 0); o.estado = o.estado === 'planeada' ? 'en_curso' : o.estado; }
      return { ...demoGuarda('Hito registrado.'), obra: o }; },
    'POST /construccion/:id/estado': () => { const o = buscar(N.obras, trozos[1]); if (o) { o.estado = cuerpo?.estado; if (o.estado === 'terminada') o.avance_pct = 100; } return demoGuarda('Obra actualizada.'); },
    'GET /analitica/tablero': () => ({
      asistencia_por_semana: Array.from({ length: 12 }, (_, k) => ({ semana: d(-7 * (11 - k)), contados: 380 + Math.round(40 * Math.sin(k)) + k * 6 })),
      personas_activas: '1284', grupos_activos: '86', grupos_sin_reunion_45_dias: '7', peticiones_oracion_abiertas: '<5',
      requerimientos_vencidos: '<5', tareas_vencidas: '0',
      ninos_por_domingo: [0, 1, 2, 3].map(k => ({ fecha: d(-7 * (3 - k)), ninos: String(88 + k * 3) })),
      generado_en: new Date().toISOString(), nota: 'Las cifras menores de 5 se muestran como «<5»: un conteo pequeño identifica a las personas.' }),
    'GET /crm/se-estan-perdiendo': () => ({ total_filas: 2, criterio: 'Vino al menos 3 veces entre hace 12 y hace 5 semanas, y ninguna en las últimas 4.',
      personas: [
        { persona_id: id(103), nombre: 'Tomás Ibarra Cano', sede: 'CHIA', veces_antes: 6, ultima_vez: d(-33), dias_sin_venir: 33, telefono: '300 555 0101' },
        { persona_id: id(106), nombre: 'Rosa Cifuentes Lara', sede: 'MED', veces_antes: 4, ultima_vez: d(-40), dias_sin_venir: 40, telefono: null }],
      aviso: '2 persona(s) dejaron de venir. Una llamada esta semana cambia la historia.' }),
    'GET /nuevos/dashboard': () => ({ total: N.nuevos.length, nuevos: N.nuevos.filter(n => !q.get('estado') || n.estado === q.get('estado')) }),
    'GET /nuevos/:id/historial': () => { const n = buscar(N.nuevos, trozos[1]);
      return { ...n, comentarios: 'Llenó el formulario después del culto.', historial_contactos: n?.historial ?? [], linea_tiempo: [] }; },
    'POST /nuevos/:id/registrar-contacto': () => { const n = buscar(N.nuevos, trozos[1]);
      if (n) { (n.historial ??= []).unshift({ ocurrido_en: new Date().toISOString(), tipo: cuerpo?.tipo_contacto, reaccion: cuerpo?.reaccion, resumen: cuerpo?.resumen,
        siguiente_paso: cuerpo?.siguiente_paso ?? null }); n.contactos++; n.estado = 'contactado'; n.proxima_accion = cuerpo?.siguiente_paso ?? 'Seguimiento'; }
      return demoGuarda('Contacto registrado.'); },
    'POST /nuevos/:id/convertir-miembro': () => { const n = buscar(N.nuevos, trozos[1]); if (n) n.estado = 'convertido'; return demoGuarda('Integrado como miembro.'); },
    'GET /aportes': () => ({ total_filas: N.aportes.length, total_monto: N.aportes.reduce((a, x) => a + Number(x.monto), 0), donaciones: N.aportes }),
    'POST /aportes': () => { N.aportes.unshift({ id: id(905 + N.aportes.length), nombre_completo: cuerpo?.es_anonimo ? null : 'Persona elegida', tipo_aporte: String(cuerpo?.tipo_aporte ?? '').toUpperCase(),
        monto: String(cuerpo?.monto ?? 0), moneda: cuerpo?.moneda ?? 'COP', fecha_aporte: cuerpo?.fecha_aporte ?? d(0), metodo_pago: String(cuerpo?.metodo_pago ?? 'efectivo').toUpperCase(),
        estado: 'REGISTRADO', inmutable: false, referencia: cuerpo?.referencia ?? null }); return demoGuarda('Donación registrada.'); },
    'POST /aportes/:id/confirmar': () => { const a = buscar(N.aportes, trozos[1]); if (a) { a.estado = 'CONFIRMADO'; a.inmutable = true; } return demoGuarda('Aporte confirmado.'); },
    'GET /cumplimiento/peticiones': () => ({ total_filas: N.titulares.length, vencidas: 0, aviso: null,
      peticiones: N.titulares.filter(p => q.get('vencidas') !== 'si' || p.vencida) }),
    'POST /cumplimiento/peticiones': () => { N.titulares.unshift({ id: id(915 + N.titulares.length), radicado: 'HD-2026-00' + (10 + N.titulares.length), tipo: cuerpo?.tipo,
        estado: 'recibida', titular_nombre: cuerpo?.titularNombre, titular_contacto: cuerpo?.titularContacto, recibida_en: d(0), vence_en: d(14), vencida: false, dias_restantes: 14 });
      return demoGuarda('Petición radicada. El plazo legal empieza a contar hoy.'); },
    'POST /cumplimiento/peticiones/:id/responder': () => { const p = buscar(N.titulares, trozos[2]); if (p) p.estado = 'atendida'; return demoGuarda('Respondida.'); },
    'POST /cumplimiento/peticiones/:id/prorrogar': () => { const p = buscar(N.titulares, trozos[2]); if (p) p.estado = 'prorrogada'; return demoGuarda('Prorrogada.'); },
    'GET /organizacion/sedes': () => SEDES,
    'GET /organizacion/ministerios': () => [
      { id: id(700), nombre: 'RocaKids' }, { id: id(701), nombre: 'Servicio' }, { id: id(702), nombre: 'Alabanza' }],
    'GET /personas': () => {
      const t = (q.get('q') ?? '').toLowerCase();
      return PERSONAS.filter(x => !t || x.nombre.toLowerCase().includes(t));
    },
    'GET /asistencia/servicios': () => ({ total_filas: SERVICIOS.length, desde: 0, servicios: SERVICIOS }),
    'POST /asistencia/servicios': () => ({ id: id(299), fecha: d(0), hora: '09:00', mensaje: 'En la demostración nada se guarda.' }),
    'GET /asistencia/servicios/:id/marcados': () => ({
      total_filas: 3,
      marcados: PERSONAS.slice(0, 3).map((x, i) => ({
        id: i + 1, persona_id: x.id, nombre_completo: x.nombre,
        marcada_en: new Date(hoy.getTime() - i * 240000).toISOString(), medio: 'manual' })),
    }),
    'POST /asistencia/servicios/:id/marcar': () => ({ id: 9, repetido: false, marcada_en: new Date().toISOString() }),
    'POST /asistencia/servicios/:id/conteo': () => ({ total: 412, adultos: 280, jovenes: 70, ninos: 62, primera_vez: 9, marcados: 3, diferencia: 409, aviso: 'Contados 412 y marcados 3: el conteo es el número de la puerta, la lista es para el seguimiento.' }),
    'GET /grupos': () => ({ total_filas: GRUPOS.length, desde: 0, grupos: GRUPOS,
      aviso: '2 grupo(s) sin reunión reportada en más de 45 días, o sin ninguna. Un grupo que no se reúne es una lista.' }),
    'GET /grupos/:id': () => {
      const g = GRUPOS.find(x => x.id === trozos[1]) ?? GRUPOS[0];
      return { grupo: g, miembros: { activos: g.miembros, total: g.miembros + 2,
        lista: PERSONAS.slice(0, g.miembros > 5 ? 5 : g.miembros).map((p, i) => ({
          id: i, persona_id: p.id, nombre_completo: p.nombre, rol: i === 0 ? 'lider' : 'miembro',
          desde: d(-120 - i * 20), hasta: null, motivo_salida: null })) },
        reuniones: g.ultima_reunion ? [{ id: 1, fecha: g.ultima_reunion, tema: 'La paciencia', asistentes: 8 }] : [] };
    },
    'GET /consejeria/topicos': () => ({ total_filas: 3, topicos: [
      { codigo: 'FAM', nombre: 'Familia y matrimonio', categoria: 'relacional', requiere_profesional: false },
      { codigo: 'DUELO', nombre: 'Duelo', categoria: 'crisis', requiere_profesional: false },
      { codigo: 'SUICIDIO', nombre: 'Ideación suicida', categoria: 'crisis', requiere_profesional: true }] }),
    'GET /consejeria/casos': () => ({ total_filas: CASOS.length, desde: 0, casos: CASOS,
      aviso: '1 caso(s) abierto(s) SIN consejero asignado. Un caso sin nadie detrás es una persona esperando.' }),
    'GET /consejeria/casos/:id': () => {
      const k = CASOS.find(x => x.id === trozos[2]) ?? CASOS[0];
      return { caso: { ...k, cerrado_en: null, derivado_a: null, consultante_id: id(100) },
        asignaciones: k.consejeros ? [{ id: 1, consejero_id: id(106), consejero: k.consejeros, rol: 'consejero', desde: d(-20), hasta: null }] : [],
        sesiones: Array.from({ length: k.sesiones }, (_, i) => ({
          id: i, fecha: new Date(hoy.getTime() - (i + 1) * 7 * 86400000).toISOString(),
          consejero: k.consejeros, duracion_min: 60, modalidad: 'presencial', asistio: true })),
        notas: k.sesiones ? [{ id: 1, escrita_en: new Date(hoy.getTime() - 5 * 86400000).toISOString(),
          autor: k.consejeros, texto: 'Nota de ejemplo. En el sistema real esto no sale nunca de esta ficha.' }] : [],
        lectura_registrada: true };
    },
    'GET /formacion/programas': () => ({ total_filas: 2, programas: [
      { id: id(800), codigo: 'IBLI', nombre: 'Instituto Bíblico', tipo: 'instituto', semestres: 4, descripcion: 'Formación bíblica completa.', cursos: 12 },
      { id: id(801), codigo: 'MAEST', nombre: 'Formación de maestros', tipo: 'diplomado', semestres: 1, descripcion: 'Para quienes enseñan a niños.', cursos: 4 }] }),
    'GET /formacion/cursos': () => ({ total_filas: 2, cursos: [
      { id: id(850), codigo: 'FUND', nombre: 'Fundamentos de la fe', semestre: 1, horas: 40, otorga_certificado: true, programa: 'Instituto Bíblico' },
      { id: id(851), codigo: 'KID', nombre: 'Enseñar a niños', semestre: 1, horas: 24, otorga_certificado: true, programa: 'Formación de maestros' }] }),
    'GET /formacion/cohortes': () => ({ total_filas: COHORTES.length, desde: 0, cohortes: COHORTES,
      aviso: '1 cohorte(s) por encima del cupo. Es un problema de salón, no de informe.' }),
    'GET /formacion/cohortes/:id': () => {
      const h = COHORTES.find(x => x.id === trozos[2]) ?? COHORTES[0];
      return { cohorte: { ...h, horas: 40 },
        ocupacion: { inscritos: h.inscritos, cupo: h.cupo },
        inscritos: PERSONAS.slice(0, 5).map((p, i) => ({
          id: i, persona_id: p.id, nombre_completo: p.nombre,
          estado: ['cursando','cursando','aprobado','inscrito','retirado'][i],
          estado_pago: ['pagado','pendiente','pagado','exonerado','pendiente'][i],
          valor_pagado: null, nota_final: i === 2 ? '4.5' : null, inscrito_en: d(-25) })) };
    },
    'GET /talento/cargos': () => ({ total_filas: 2, cargos: [
      { id: id(900), codigo: 'PASTOR', nombre: 'Pastor congregacional', area: 'Pastoral', nivel_dato: 3 },
      { id: id(901), codigo: 'ADMIN', nombre: 'Administrador de sede', area: 'Administrativa', nivel_dato: 3 }] }),
    'GET /talento/contratos': () => ({ total_filas: 1, desde: 0, contratos: [
      { id: id(950), persona_id: id(101), nombre_completo: 'Andrés Beltrán Ruiz', tipo: 'indefinido',
        estado: 'activo', inicia: d(-700), termina: null, salario: null, moneda: 'COP',
        cargo: 'Pastor congregacional', area: 'Pastoral', sede: 'BOG-NORTE', vence_pronto: false }], aviso: null }),
    'GET /talento/voluntariados': () => ({ total_filas: VOLUNTARIADOS.length, desde: 0, voluntariados: VOLUNTARIADOS,
      aviso: '⛔ 1 voluntario(s) ACTIVOS con menores y SIN antecedentes vigentes: Damián Rueda Silva' }),
    'GET /talento/antecedentes/:id': () => {
      const apto = trozos[2] === id(105);
      return { apto_para_menores: apto,
        le_faltan: apto ? [] : [{ codigo: 'DELITOS_SEXUALES', nombre: 'Registro de delitos sexuales contra menores' }],
        antecedentes: apto ? [
          { id: 1, tipo: 'DELITOS_SEXUALES', tipo_nombre: 'Registro de delitos sexuales contra menores',
            resultado: 'apto', expedido_en: d(-200), vence_en: d(165), vencido: false, dias_restantes: 165 },
          { id: 2, tipo: 'JUDICIALES', tipo_nombre: 'Antecedentes judiciales',
            resultado: 'apto', expedido_en: d(-200), vence_en: d(20), vencido: false, dias_restantes: 20 }] : [],
        aviso: apto ? null : 'No está apto para estar con menores. Falta: Registro de delitos sexuales contra menores.' };
    },
    /* ⛔ Devolvía `{abiertos, cerrados}` y la API real devuelve un ARREGLO
       PLANO con `cerrado`, `motivo_cerrado` y `valores_vigentes`. La vista
       hacía `cats.filter(...)` y la pantalla entera salía en rojo con
       «cats.filter is not a function». */
    'GET /identidad/catalogos': () => CATALOGOS,
    'GET /identidad/catalogos/:id/valores': () => {
      const c = CATALOGOS.find(x => x.codigo === trozos[2]);
      return (c?.valores ?? []).map((v, i) => ({ ...v, orden: (i + 1) * 10, vigente: true }));
    },
    'POST /identidad/catalogos/:id/valores': () => {
      const c = CATALOGOS.find(x => x.codigo === trozos[2]);
      if (!c) noEnDemo('Ese catálogo no existe.');
      if (c.cerrado) noEnDemo(`«${c.nombre}» es un catálogo cerrado: ${c.motivo_cerrado}`);
      c.valores.push({ codigo: cuerpo?.codigo, etiqueta: cuerpo?.etiqueta });
      c.valores_vigentes = c.valores.length;
      return { mensaje: 'Valor agregado al catálogo.' };
    },
    /* ⛔ Devolvía un OBJETO `{total_filas, salas}` y la API real devuelve
       un ARREGLO PLANO. La vista hacía `salas.map(...)` y reventaba con
       «salas.map is not a function» EN PANTALLA. Peor: el objeto se
       guardaba antes en `localStorage`, así que la pestaña Niños quedaba
       rota de forma permanente hasta borrar el almacenamiento. */
    'GET /rocakids/salas': () => SALAS,
    'GET /rocakids/salas/:id/roster': () => {
      const sala = SALAS.find(x => x.id === trozos[2]) ?? SALAS[0];
      return MENORES.filter(m => m.sala_id === sala.id);
    },
    'GET /rocakids/menores/:id/acudientes': () => ACUDIENTES.map((a, i) => ({
      ...a, acudiente_id: id(880 + i), menor_id: trozos[2] })),
    'POST /rocakids/salas/:id/entrar-a-servir': () => {
      const sala = SALAS.find(x => x.id === trozos[2]) ?? SALAS[0];
      /* La API real llama a esta columna `adultos`, no `adultos_dentro`.
         Con el nombre equivocado, la pantalla leía `undefined`, lo tomaba
         como CERO y toda sala decía «0 adultos, la regla exige dos». */
      sala.adultos += 1;
      sala.regla_dos_adultos = sala.adultos >= 2;
      return { mensaje: 'Queda registrado sirviendo en ' + sala.nombre + '.',
               aviso: sala.regla_dos_adultos ? null : 'Todavía hay un solo adulto en la sala: no se puede abrir con menos de dos.' };
    },
    'POST /rocakids/checkin': () => {
      const m = MENORES.find(x => x.menor_id === cuerpo?.menorId);
      if (!m) noEnDemo('Ese menor no está en el censo de la sala.');
      if (m.esta_dentro) noEnDemo(`${m.menor} ya está dentro: no se registra dos veces.`);
      m.esta_dentro = true;
      m.codigo = String(Math.floor(1000 + Math.random() * 9000));
      const sala = SALAS.find(s => s.id === m.sala_id);
      if (sala) sala.ninos_dentro += 1;
      return { checkinId: id(970), codigo: m.codigo, repetido: false,
               aviso: 'Este código se muestra UNA sola vez: sin él no se entrega al niño.' };
    },
    'POST /rocakids/entregar': () => {
      const m = MENORES.find(x => x.esta_dentro && x.codigo === String(cuerpo?.codigo ?? '').trim());
      if (!m) noEnDemo('Ese código no corresponde a ningún niño dentro de la sala.');
      m.esta_dentro = false; m.codigo = null;
      const sala = SALAS.find(s => s.id === m.sala_id);
      if (sala) sala.ninos_dentro = Math.max(0, sala.ninos_dentro - 1);
      return { mensaje: `${m.menor} fue entregado y queda registrado con hora y nombre de quien lo retiró.` };
    },
    /* ── Lo que se CREA desde la aplicación de los pastores ──────────
       ⛔ Ninguna de estas rutas estaba, así que cada «+ Crear…» respondía
          con el comodín. Ahora escriben en el estado de esta pestaña: se
          crea un grupo y aparece en la lista, como en el sistema real. */
    'POST /grupos': () => {
      if (!cuerpo?.nombre || !cuerpo?.sedeId) noEnDemo('Falta el nombre o la sede del grupo.');
      const sede = SEDES.find(x => x.id === cuerpo.sedeId) ?? SEDES[0];
      GRUPOS.unshift({ id: id(310 + GRUPOS.length), nombre: cuerpo.nombre, tipo: cuerpo.tipo ?? 'pequeno',
        sede: sede.codigo, dia_reunion: cuerpo.diaReunion ?? null, hora: cuerpo.hora ?? null,
        cupo: cuerpo.cupo ?? null, miembros: 0, ultima_reunion: null, dias_sin_reunirse: null });
      return { id: GRUPOS[0].id, mensaje: 'Grupo creado. Todavía no tiene a nadie dentro.' };
    },
    'POST /grupos/:id/reuniones': () => {
      const g = GRUPOS.find(x => x.id === trozos[1]);
      if (!g) noEnDemo('Ese grupo no existe.');
      g.ultima_reunion = cuerpo?.fecha ?? d(0); g.dias_sin_reunirse = 0;
      return { mensaje: 'Reunión reportada. El grupo sale de la lista de los que no se reúnen.' };
    },
    'POST /grupos/:id/miembros': () => {
      const g = GRUPOS.find(x => x.id === trozos[1]);
      if (!g) noEnDemo('Ese grupo no existe.');
      if (g.cupo && g.miembros >= g.cupo) noEnDemo(`«${g.nombre}» está en su cupo de ${g.cupo}.`);
      g.miembros += 1;
      return { mensaje: 'Entró al grupo.' };
    },
    'POST /grupos/:id/miembros/:id2/salir': () => {
      const g = GRUPOS.find(x => x.id === trozos[1]);
      if (!g) noEnDemo('Ese grupo no existe.');
      g.miembros = Math.max(0, g.miembros - 1);
      return { mensaje: 'Salió del grupo. Queda la fecha, no se borra el rastro.' };
    },

    'POST /consejeria/casos': () => {
      if (!cuerpo?.consultanteId) noEnDemo('Falta a quién se va a acompañar.');
      CASOS.unshift({ id: id(410 + CASOS.length), estado: 'abierto',
        topico: cuerpo.topico ?? 'OTRO', topico_nombre: 'Sin clasificar',
        requiere_profesional: false, sede: SEDES[0].codigo,
        consultante: PERSONAS.find(p => p.id === cuerpo.consultanteId)?.nombre ?? 'Persona de la demostración',
        dias_abierto: 0, sesiones: 0, ultima_sesion: null, consejeros: null });
      return { id: CASOS[0].id, mensaje: 'Caso abierto. Asígnele un consejero: sin consejero no avanza.' };
    },
    'POST /consejeria/casos/:id/asignar': () => {
      const c = CASOS.find(x => x.id === trozos[2]);
      if (!c) noEnDemo('Ese caso no existe.');
      c.consejeros = PERSONAS.find(p => p.id === cuerpo?.consejeroId)?.nombre ?? 'Consejero de la demostración';
      return { mensaje: 'Consejero asignado. Solo él y quien supervisa verán las notas.' };
    },
    'POST /consejeria/casos/:id/sesiones': () => {
      const c = CASOS.find(x => x.id === trozos[2]);
      if (!c) noEnDemo('Ese caso no existe.');
      c.sesiones += 1; c.ultima_sesion = d(0); c.estado = 'en_proceso';
      return { mensaje: 'Sesión registrada.' };
    },
    'POST /consejeria/casos/:id/notas': () => {
      if (!String(cuerpo?.texto ?? '').trim()) noEnDemo('Una nota vacía no se guarda.');
      return { mensaje: 'Nota guardada. Es N3: cada lectura queda registrada con nombre y hora.' };
    },
    'POST /consejeria/casos/:id/cerrar': () => {
      const c = CASOS.find(x => x.id === trozos[2]);
      if (!c) noEnDemo('Ese caso no existe.');
      if (!String(cuerpo?.motivo ?? cuerpo?.cierre ?? '').trim()) noEnDemo('Cerrar un caso exige escribir cómo terminó.');
      c.estado = 'cerrado';
      return { mensaje: 'Caso cerrado. Queda el histórico completo.' };
    },

    'POST /formacion/cohortes': () => {
      if (!cuerpo?.codigo) noEnDemo('Falta el código de la cohorte.');
      COHORTES.unshift({ id: id(510 + COHORTES.length), codigo: cuerpo.codigo,
        modalidad: cuerpo.modalidad ?? 'presencial', inicia: cuerpo.inicia ?? d(0),
        termina: cuerpo.termina ?? null, cupo: cuerpo.cupo ?? 20, valor: cuerpo.valor ?? null,
        moneda: 'COP', sede: SEDES[0].codigo, curso: 'Curso de la demostración',
        programa: 'Instituto Bíblico', docente: null, inscritos: 0, otorga_certificado: true });
      return { id: COHORTES[0].id, mensaje: 'Cohorte abierta. Ya se puede inscribir gente.' };
    },
    'POST /formacion/cohortes/:id/inscribir': () => {
      const h = COHORTES.find(x => x.id === trozos[2]);
      if (!h) noEnDemo('Esa cohorte no existe.');
      h.inscritos += 1;
      return { mensaje: h.inscritos > h.cupo
        ? 'Inscrito. ⚠️ La cohorte quedó POR ENCIMA del cupo: es un problema de salón, no de informe.'
        : 'Inscrito.' };
    },
    'POST /formacion/inscripciones/:id/calificar': () => {
      if (cuerpo?.nota === undefined || cuerpo?.nota === null) noEnDemo('Falta la nota.');
      return { mensaje: 'Calificación registrada.' };
    },

    'POST /talento/voluntariados': () => {
      if (!cuerpo?.personaId) noEnDemo('Falta a quién se registra.');
      const conMenores = cuerpo.trabajaConMenores === true;
      VOLUNTARIADOS.unshift({ id: id(610 + VOLUNTARIADOS.length), persona_id: cuerpo.personaId,
        nombre_completo: PERSONAS.find(p => p.id === cuerpo.personaId)?.nombre ?? 'Persona de la demostración',
        funcion: cuerpo.funcion ?? 'Sin función', estado: 'activo', desde: cuerpo.desde ?? d(0),
        hasta: null, trabaja_con_menores: conMenores, apto_para_menores: false,
        ministerio: 'RocaKids', sede: SEDES[0].codigo });
      return { id: VOLUNTARIADOS[0].id, mensaje: conMenores
        ? '⛔ Registrado, y marcado como que estará con MENORES: no puede servir hasta que tenga antecedentes vigentes.'
        : 'Voluntariado registrado.' };
    },
    'POST /talento/antecedentes': () => {
      if (!cuerpo?.tipo) noEnDemo('Falta qué antecedente se está registrando.');
      const v = VOLUNTARIADOS.find(x => x.persona_id === cuerpo.personaId);
      if (v && cuerpo.resultado === 'apto') v.apto_para_menores = true;
      return { mensaje: 'Antecedente registrado con su fecha de vencimiento.' };
    },
    'POST /talento/voluntariados/:id/terminar': () => {
      const v = VOLUNTARIADOS.find(x => x.id === trozos[2]);
      if (!v) noEnDemo('Ese voluntariado no existe.');
      if (!String(cuerpo?.motivo ?? '').trim()) noEnDemo('Terminar un voluntariado exige un motivo escrito.');
      v.estado = 'terminado'; v.hasta = d(0);
      return { mensaje: 'Voluntariado terminado. Queda el histórico.' };
    },

    /* ── Lo que puede cada quien, para la consola ────────────────── */
    'GET /identidad/personas/:id/asignaciones': () => G.asignaciones[trozos[2]] ?? [],
    'GET /identidad/personas/:id/efectivo': () => {
      const roles = (G.asignaciones[trozos[2]] ?? []).map(a => a.rol);
      const salida = [];
      for (const llave of G.matriz) {
        const [rol, modulo, accion] = llave.split('|');
        if (!roles.includes(rol)) continue;
        const m = MODULOS_DEMO.find(x => x.codigo === modulo);
        const a = ACCIONES_DEMO.find(x => x.codigo === accion);
        salida.push({ modulo, modulo_nombre: m?.nombre ?? modulo,
          accion, accion_nombre: a?.nombre ?? accion,
          nivel_max: rolDe(rol)?.nivel_maximo ?? 0 });
      }
      return salida;
    },

    /* ── Las tres acciones de una cuenta ─────────────────────────── */
    'POST /administracion/cuentas/:id/reiniciar-clave': () => ({
      clave_provisional: 'cedro brisa faro lazo ' + (10 + Math.floor(Math.random() * 89)),
      mensaje: 'Se cerraron todas sus sesiones. Tendrá que cambiarla al entrar.' }),
    'POST /administracion/cuentas/:id/desbloquear': () => ({
      mensaje: 'Cuenta desbloqueada. Los intentos fallidos vuelven a cero.' }),
    'POST /administracion/cuentas/:id/reiniciar-segundo-factor': () => ({
      mensaje: 'Segundo factor borrado. Lo volverá a configurar la próxima vez que entre.' }),

    /* ── Gobierno de la red · TODO esto reacciona de verdad ───────── */
    'GET /administracion/catalogo': () => ({
      modulos: MODULOS_DEMO, acciones: ACCIONES_DEMO, roles: G.roles,
      niveles: NIVELES_DEMO, tiposDocumento: TIPOS_DOC_DEMO }),

    'GET /administracion/matriz': () => {
      const codigo = q.get('rol') ?? G.roles[0].codigo;
      const r = rolDe(codigo) ?? G.roles[0];
      const filas = [];
      for (const m of MODULOS_DEMO) for (const a of accionesDe(m.codigo)) {
        filas.push({
          rol: r.codigo, rol_nombre: r.nombre, rol_techo: r.nivel_maximo,
          modulo: m.codigo, modulo_nombre: m.nombre, modulo_nivel: m.nivel_dato,
          accion: a.codigo, accion_nombre: a.nombre,
          marcado: G.matriz.has(`${r.codigo}|${m.codigo}|${a.codigo}`),
          nivel_max: null, acta_ref: null,
          /* Un permiso que engaña: el módulo guarda datos más sensibles
             que el techo del rol, así que existe y no deja ver nada. */
          por_encima: m.nivel_dato > r.nivel_maximo,
        });
      }
      return { total_filas: filas.length, matriz: filas, aviso: null };
    },

    'POST /administracion/matriz': () => {
      const { rol, modulo, accion, marcado } = cuerpo ?? {};
      const llave = `${rol}|${modulo}|${accion}`;
      if (marcado) G.matriz.add(llave); else G.matriz.delete(llave);
      return { marcado: !!marcado, mensaje: marcado ? 'Permiso otorgado.' : 'Permiso quitado.' };
    },

    'POST /administracion/roles': () => {
      const b = cuerpo ?? {};
      const y = rolDe(b.codigo);
      if (!y && String(b.descripcion ?? '').trim().length < 10) {
        noEnDemo('Escriba para qué sirve el rol: al menos diez caracteres. Un rol sin propósito escrito no se puede auditar.');
      }
      const fila = {
        codigo: b.codigo, nombre: b.nombre,
        alcance_maximo: b.alcanceMaximo, nivel_maximo: Number(b.nivelMaximo),
        /* Lo que no se manda NO SE TOCA, igual que en la base. */
        descripcion: String(b.descripcion ?? '').trim() || y?.descripcion || '',
        activo: typeof b.activo === 'boolean' ? b.activo : (y?.activo ?? true),
      };
      if (y) Object.assign(y, fila); else G.roles.push(fila);
      return { mensaje: 'Rol guardado. Los permisos que le sobren por encima del techo dejan de servir.' };
    },

    'GET /administracion/plantillas': () => ({
      total_filas: G.plantillas.length,
      plantillas: G.plantillas.map(p => ({
        codigo: p.codigo, nombre: p.nombre, tipo_sede: p.tipo_sede, descripcion: p.descripcion,
        modulos: p.modulos.size,
        lista: MODULOS_DEMO.filter(m => p.modulos.has(m.codigo)).map(m => m.nombre).join(', '),
        con_compuerta_legal: MODULOS_DEMO.filter(m => p.modulos.has(m.codigo) && m.exige_compuerta_legal).length,
      })),
      aviso: 'Los módulos con compuerta legal nacen APAGADOS: se encienden cuando exista la evidencia jurídica.' }),

    'POST /administracion/plantillas': () => {
      const b = cuerpo ?? {};
      const y = G.plantillas.find(p => p.codigo === b.codigo);
      if (y) { Object.assign(y, { nombre: b.nombre, descripcion: b.descripcion ?? y.descripcion }); }
      else G.plantillas.push({ codigo: b.codigo, nombre: b.nombre, tipo_sede: b.tipoSede,
        descripcion: b.descripcion ?? '',
        modulos: new Set(MODULOS_DEMO.filter(m => m.es_nucleo).map(m => m.codigo)) });
      return { mensaje: 'Plantilla guardada. Marque los módulos que debe traer una iglesia nueva.' };
    },

    'POST /administracion/plantillas/:id/modulos': () => {
      const p = G.plantillas.find(x => x.codigo === trozos[2]);
      if (!p) noEnDemo('Esa plantilla no existe.');
      const m = MODULOS_DEMO.find(x => x.codigo === cuerpo?.modulo);
      if (m?.es_nucleo && !cuerpo?.marcado) {
        noEnDemo(`El módulo «${m.codigo}» es de núcleo: no se puede quitar de una plantilla`);
      }
      if (cuerpo?.marcado) p.modulos.add(cuerpo.modulo); else p.modulos.delete(cuerpo.modulo);
      return { marcado: !!cuerpo?.marcado,
               mensaje: cuerpo?.marcado ? 'Módulo añadido a la plantilla.' : 'Módulo quitado.' };
    },

    'POST /administracion/plantillas/:id/borrar': () => {
      const i = G.plantillas.findIndex(x => x.codigo === trozos[2]);
      if (i < 0) noEnDemo('Esa plantilla no existe.');
      G.plantillas.splice(i, 1);
      return { mensaje: 'Plantilla borrada.' };
    },

    'POST /administracion/sedes/:id/modulos': () => {
      const sede = G.modulosSede[trozos[2]] ?? G.modulosSede[SEDES[0].id];
      const m = MODULOS_DEMO.find(x => x.codigo === cuerpo?.modulo);
      if (!m) noEnDemo('Ese módulo no existe.');
      if (m.es_nucleo && !cuerpo?.activo) {
        noEnDemo(`«${m.nombre}» es de núcleo: sin él la iglesia no puede ni registrar personas.`);
      }
      if (cuerpo?.activo && m.exige_compuerta_legal && !cuerpo?.evidencia
          && !sede[m.codigo]?.evidencia) {
        noEnDemo(`«${m.nombre}» toca datos protegidos: no se enciende sin la referencia del instrumento jurídico que lo autoriza.`);
      }
      sede[m.codigo] = { activo: !!cuerpo?.activo,
                         evidencia: cuerpo?.evidencia ?? sede[m.codigo]?.evidencia ?? null };
      return { mensaje: cuerpo?.activo ? 'Módulo encendido en esa sede.' : 'Módulo apagado en esa sede.' };
    },

    'GET /administracion/personas/:id': () => {
      const p = PERSONAS.find(x => x.id === trozos[2]) ?? PERSONAS[0];
      const roles = G.asignaciones[p.id] ?? [];
      return {
        persona: { id: p.id, nombre_completo: p.nombre, numero_documento: p.numero_documento,
          tipo_documento: 'CC', email_principal: null, telefono_movil: null, estado: 'activa',
          edad: 34, es_menor: false, sede: p.sede, sede_nombre: p.sede },
        cuenta: { cuenta_id: id(980), persona_id: p.id, persona: p.nombre,
          usuario: p.nombre.split(' ')[0].toLowerCase() + '@casaroca.org', estado: 'activa',
          segundo_factor_activo: true, exige_segundo_factor: true, debe_cambiar_clave: false,
          ultimo_ingreso: new Date().toISOString(), bloqueada: false },
        roles, equipos: [],
        aviso: roles.length ? null : 'Esta persona no tiene ningún rol: puede entrar y no ve nada.' };
    },

    'GET /administracion/sedes/:id': () => {
      const sede = SEDES.find(x => x.id === trozos[2]) ?? SEDES[0];
      const mods = G.modulosSede[sede.id] ?? {};
      const on = Object.values(mods).filter(x => x.activo).length;
      return {
        sede: { id: sede.id, codigo: sede.codigo, nombre: sede.nombre, tipo: 'plantacion',
                pais: 'CO', ciudad: sede.nombre.replace(' (demo)', ''), activa: true,
                sede_padre: null, ola_migracion: 1 },
        conteo: { personas: String(PERSONAS.filter(p => p.sede === sede.codigo).length),
                  grupos: '3', modulos_encendidos: String(on) },
        equipo: [{ persona: 'Andrés Beltrán Ruiz', rol: 'PASTOR_CONGREGACIONAL',
                   rol_nombre: 'Pastor congregacional', nivel_max: 3, desde: d(-400) }],
        unidades: [{ id: id(700), nombre: 'Casa Sobre la Roca · Central', clase: 'central' }],
        aviso: null };
    },

    'POST /identidad/personas/:id/otorgar': () => {
      const lista = cuerpo?.roles ?? (Array.isArray(cuerpo) ? cuerpo : [cuerpo]);
      const persona = PERSONAS.find(x => x.id === trozos[2])?.id ?? PERSONAS[0].id;
      G.asignaciones[persona] = G.asignaciones[persona] ?? [];
      for (const a of lista) {
        if (!a?.rol) noEnDemo('Falta el código del rol.');
        const acta = String(a.acta ?? a.actaReferencia ?? '').trim();
        if (acta.length < 4) {
          noEnDemo('Falta el acta que autoriza el rol. Un permiso sin constancia de quién lo autorizó no se otorga.');
        }
        const r = rolDe(a.rol);
        G.asignaciones[persona].push({
          id: id(8000 + G.asignaciones[persona].length), rol: a.rol,
          rol_nombre: r?.nombre ?? a.rol, alcance_tipo: a.alcanceTipo ?? 'sede',
          alcance_id: a.alcanceId ?? null, nivel_max: r?.nivel_maximo ?? 2,
          desde: d(0), hasta: null, acta_referencia: acta });
      }
      return { ok: true, otorgados: G.asignaciones[persona] };
    },

    'DELETE /identidad/asignaciones/:id': () => {
      const motivo = String(cuerpo?.motivo ?? '').trim();
      if (motivo.length < 5) {
        noEnDemo('Revocar un permiso exige un motivo escrito: quedará en la ficha de la persona y en la auditoría.');
      }
      for (const [persona, lista] of Object.entries(G.asignaciones)) {
        const i = lista.findIndex(x => x.id === trozos[2]);
        if (i >= 0) {
          lista.splice(i, 1);
          return { id: trozos[2], motivo,
                   mensaje: 'Rol revocado. Queda en la ficha de la persona y en la auditoría.' };
        }
      }
      noEnDemo('No existe esa asignación.');
    },

    'POST /administracion/iglesias': () => ({ id: id(970), mensaje: 'En la demostración nada se guarda.' }),
    'POST /administracion/personas': () => ({ id: id(971), mensaje: 'En la demostración nada se guarda.' }),
    'GET /administracion/unidades': () => ({
      total_filas: UNIDADES.length, unidades: UNIDADES,
      aviso: UNIDADES.filter(u => u.clase === 'equipo' && !Number(u.roles)).length
        + ' equipo(s) sin ningún rol otorgado: existen pero no pueden hacer nada.' }),
    'POST /administracion/unidades': () => {
      const b = cuerpo ?? {};
      if (String(b.proposito ?? '').trim().length < 15) {
        noEnDemo('Escriba para qué existe el equipo: al menos quince caracteres.');
      }
      if (UNIDADES.some(u => u.codigo === b.codigo)) noEnDemo('Ya existe un equipo con ese código.');
      UNIDADES.push({ id: id(710 + UNIDADES.length), codigo: b.codigo, nombre: b.nombre,
        clase: b.clase, padre_id: UNIDADES[0].id, proposito: b.proposito, activa: true,
        padre: UNIDADES[0].nombre, lider: null, integrantes: '0', roles: '0' });
      return { mensaje: 'Equipo creado. Ahora otórguele un rol: sin rol existe y no puede hacer nada.' };
    },
    'POST /administracion/unidades/:id/miembros': () => {
      const u = UNIDADES.find(x => x.id === trozos[2]);
      if (!u) noEnDemo('Ese equipo no existe.');
      u.integrantes = String(Number(u.integrantes) + 1);
      return { mensaje: 'Entró al equipo. Hereda lo que el equipo alcance mientras esté dentro.' };
    },
    'POST /administracion/unidades/:id/miembros/:id2/salir': () => {
      const u = UNIDADES.find(x => x.id === trozos[2]);
      if (!u) noEnDemo('Ese equipo no existe.');
      if (!String(cuerpo?.motivo ?? '').trim()) noEnDemo('Sacar a alguien de un equipo exige un motivo escrito.');
      u.integrantes = String(Math.max(0, Number(u.integrantes) - 1));
      return { mensaje: 'Salió del equipo. Pierde lo que heredaba de él, y queda la fecha de salida.' };
    },
    'POST /administracion/unidades/:id/roles': () => {
      const u = UNIDADES.find(x => x.id === trozos[2]);
      if (!u) noEnDemo('Ese equipo no existe.');
      if (String(cuerpo?.acta ?? cuerpo?.actaReferencia ?? '').trim().length < 4) {
        noEnDemo('Falta el acta que autoriza el rol del equipo.');
      }
      u.roles = String(Number(u.roles) + 1);
      return { mensaje: 'Rol otorgado al equipo. Lo hereda cada integrante mientras esté dentro.' };
    },
    'POST /administracion/unidades/roles/:id/revocar': () => {
      if (!String(cuerpo?.motivo ?? '').trim()) noEnDemo('Revocar el rol de un equipo exige un motivo escrito.');
      const u = UNIDADES.find(x => Number(x.roles) > 0);
      if (u) u.roles = String(Number(u.roles) - 1);
      return { mensaje: 'Rol revocado. Lo pierden TODOS los integrantes del equipo a la vez.' };
    },
    /* ⛔ Ignoraba el identificador y devolvía SIEMPRE Tesorería: se pulsaba
       «Región Andina» y la ficha decía «Tesorería de la red», con sus
       miembros y su acta. En una auditoría eso se lee como que el sistema
       mezcla registros. */
    'GET /administracion/unidades/:id': () => {
      const u = UNIDADES.find(x => x.id === trozos[2]) ?? UNIDADES[0];
      const cuantos = Number(u.integrantes) || 0;
      return {
        unidad: { ...u, lider: cuantos ? PERSONAS[0].nombre : null },
        miembros: { activos: cuantos, lista: PERSONAS.slice(0, cuantos).map((p, i) => ({
          id: i, persona_id: p.id, nombre_completo: p.nombre,
          rol_en_unidad: i === 0 ? 'lider' : 'integrante', desde: d(-200), hasta: null })) },
        roles: Number(u.roles) ? [{ id: id(704), rol: 'TESORERIA', rol_nombre: 'Tesorería',
          alcance_tipo: 'organizacion', nivel_max: 3, desde: d(-200), hasta: null,
          acta_referencia: 'Acta 2026-014 de la Junta' }] : [],
        alcanza: u.clase === 'region' ? SEDES.slice(0, 2).map(s => ({ codigo: s.codigo, nombre: s.nombre }))
               : SEDES.map(s => ({ codigo: s.codigo, nombre: s.nombre })),
        aviso: Number(u.roles) ? null
             : 'Este equipo no tiene ningún rol otorgado: existe pero no puede hacer nada.' };
    },
    'GET /administracion/cuentas': () => ({ total_filas: 3, cuentas: PERSONAS.slice(0, 3).map((p, i) => ({
      cuenta_id: id(980 + i), persona_id: p.id, persona: p.nombre,
      usuario: p.nombre.split(' ')[0].toLowerCase() + '@casaroca.org',
      estado: i === 2 ? 'bloqueada' : 'activa', segundo_factor_activo: i === 0,
      exige_segundo_factor: i < 2, debe_cambiar_clave: i === 1,
      ultimo_ingreso: i === 0 ? new Date().toISOString() : null,
      intentos_fallidos: i === 2 ? 5 : 0, bloqueada: i === 2, sede: SEDES[i].codigo,
      roles: ['PASTOR_DIRECTOR_GENERAL','TESORERIA','SECRETARIA'][i] })),
      aviso: '2 cuenta(s) necesitan atención: bloqueadas, suspendidas o con el segundo factor sin activar.' }),
    'POST /administracion/cuentas': () => ({ id: id(989), usuario: 'nueva@casaroca.org',
      clave_provisional: 'cedro brisa faro lazo 47',
      mensaje: 'En la demostración nada se guarda. Así se vería la contraseña provisional.' }),
    'GET /administracion/sedes/:id/modulos': () => {
      const sede = G.modulosSede[trozos[2]] ?? G.modulosSede[SEDES[0].id];
      const modulos = MODULOS_DEMO.map(m => ({
        ...m, activo: !!sede[m.codigo]?.activo,
        evidencia_legal_ref: sede[m.codigo]?.evidencia ?? null }));
      const falta = modulos.filter(x => x.activo && x.exige_compuerta_legal && !x.evidencia_legal_ref);
      return { total_filas: modulos.length, modulos,
        aviso: falta.length ? `${falta.length} módulo(s) encendidos sin la evidencia jurídica registrada.` : null };
    },
    'GET /administracion/organigrama': () => ({ total_filas: 4, unidades: [
      { id: id(700), codigo: 'CENTRAL', nombre: 'Casa Sobre la Roca · Central', clase: 'central', nivel: 0, integrantes: 6, sedes_que_alcanza: 3 },
      { id: id(703), codigo: 'REG-ANDINA', nombre: 'Región Andina', clase: 'region', nivel: 1, integrantes: 1, sedes_que_alcanza: 2 },
      { id: id(701), codigo: 'TESORERIA', nombre: 'Tesorería de la red', clase: 'equipo', nivel: 1, integrantes: 3, sedes_que_alcanza: 3 },
      { id: id(702), codigo: 'CONTA', nombre: 'Contabilidad', clase: 'equipo', nivel: 1, integrantes: 2, sedes_que_alcanza: 3 }] }),
    'GET /administracion/sesiones': () => ({ total_filas: SESIONES.length, sesiones: SESIONES }),
    'GET /administracion/alertas': () => ({ total_filas: 1, alertas: [
      { usuario: 'desconocido@x.org', ip: '45.12.9.3', intentos_fallidos: 14, desde: d(0), hasta: d(0) }],
      aviso: '1 usuario(s) o dirección(es) con intentos fallidos agrupados.' }),
    'GET /administracion/recertificar': () => {
      const vencidos = RECERT.filter(x => x.vencido);
      const lista = q.get('todos') === 'si' ? RECERT : vencidos;
      return { total_filas: lista.length, accesos: lista,
        vencidos: vencidos.length, vigentes: RECERT.length,
        aviso: vencidos.length
          ? `${vencidos.length} acceso(s) pasaron su plazo de revisión, de ${RECERT.length} vigentes. Un permiso que nadie revisa es un permiso que nadie quitó.`
          : `Ninguno de los ${RECERT.length} accesos vigentes pasó su plazo. El plazo es de 90 días para los que tocan datos N3 o N4, y de 180 para el resto.` };
    },
    'POST /administracion/recertificar/:id': () => {
      const a = RECERT.find(x => x.asignacion_id === trozos[2]);
      if (!a) noEnDemo('Ese acceso no existe o ya se revisó.');
      if (String(cuerpo?.nota ?? '').trim().length < 5) {
        noEnDemo('Escriba por qué se mantiene o se quita el acceso: la revisión queda firmada con su nombre.');
      }
      a.ultima_revision = new Date().toISOString();
      a.dias_sin_revisar = 0; a.vencido = false;
      if (cuerpo?.veredicto === 'se_revoca') RECERT.splice(RECERT.indexOf(a), 1);
      return { mensaje: cuerpo?.veredicto === 'se_revoca'
        ? 'Revisado y REVOCADO. La persona pierde ese acceso ahora mismo.'
        : 'Revisado. El contador de días vuelve a cero y queda firmado con su nombre.' };
    },
    'POST /administracion/sesiones/:id/cerrar': () => {
      if (String(cuerpo?.motivo ?? '').trim().length < 5) {
        noEnDemo('Cerrarle la sesión a otra persona exige un motivo escrito: queda en la auditoría.');
      }
      const i = SESIONES.findIndex(x => x.sesion === trozos[2]);
      if (i < 0) noEnDemo('Esa sesión ya no está abierta.');
      SESIONES.splice(i, 1);
      return { mensaje: 'Sesión cerrada. Surte efecto ahora, no cuando expire el token.' };
    },

    'GET /administracion/auditoria': () => ({ total_filas: 2, movimientos: [
      { ocurrido_en: new Date().toISOString(), esquema: 'aportes', tabla: 'aportes', operacion: 'I', actor: 'Rosa Cifuentes Lara', actor_ip: '190.0.0.4' },
      { ocurrido_en: new Date(Date.now()-36e5).toISOString(), esquema: 'identidad', tabla: 'asignaciones', operacion: 'U', actor: 'Marta Quiroga Peña', actor_ip: '190.0.0.1' }] }),
    'GET /administracion/lecturas': () => ({ total_filas: 1, lecturas: [
      { ocurrido_en: new Date().toISOString(), esquema: 'consejeria', tabla: 'casos', nivel: 3,
        motivo: 'ficha completa del caso, con notas', filas_leidas: 1, actor: 'Rosa Cifuentes Lara', actor_ip: '190.0.0.4' }],
      aviso: 'Esta bitácora existe para que mirar por curiosidad tenga nombre y hora.' }),
    'GET /identidad/roles': () => [
      { codigo: 'PASTOR_DIRECTOR_GENERAL', nombre: 'Pastor Director General', activo: true },
      { codigo: 'TESORERIA', nombre: 'Tesorería', activo: true },
      { codigo: 'CONTABILIDAD', nombre: 'Contabilidad', activo: true },
      { codigo: 'PASTOR_CONGREGACIONAL', nombre: 'Pastor congregacional', activo: true }],
    /* ⛔ Devolvía `estado: 'demostración'`, y el Panel solo pinta el
       distintivo verde cuando vale exactamente 'sano'. El dueño veía
       «Estado del sistema: con problemas» y ninguna línea que dijera
       cuál, porque tampoco devolvía `problemas`. */
    'GET /salud/detalle': () => ({
      estado: 'sano', problemas: [],
      base: { estado: 'responde', ms: 4 },
      particiones: [{ tabla: 'asistencia.entradas', meses_de_colchon: 14 },
                    { tabla: 'plataforma.auditoria', meses_de_colchon: 14 }],
      fugasDeLectura: 0 }),
  };

  /* Se busca la clave exacta y, si no, la genérica con `:id`.
     ⛔ Antes solo se sustituía lo que tuviera pinta de uuid. Una plantilla
        se identifica por su código («PLANTACION»), no por un uuid: la
        ruta no casaba con ningún patrón y la consola de demostración
        contestaba «esta pantalla todavía no trae datos de ejemplo» al
        marcar un módulo. Ahora se prueba sustituyendo CADA segmento. */
  /* ⛔ 21 sep 2026 · Una ruta con DOS identificadores («/grupos/:id/
     miembros/:id2/salir») nunca casaba: la genérica sustituye ambos por
     `:id` y la clave decía `:id2`. «Sacar del grupo» no funcionaba en la
     demostración. Las claves se normalizan: todo `:idN` es `:id`. */
  for (const k of Object.keys(M)) {
    const n = k.replace(/:id\d+/g, ':id');
    if (n !== k && !M[n]) M[n] = M[k];
  }
  const exacta = `${metodo} ${p}`;
  if (M[exacta]) return M[exacta]();
  const generica = `${metodo} /` + trozos.map(t =>
    /^[0-9a-f-]{16,}$/i.test(t) ? ':id' : t).join('/');
  if (M[generica]) return M[generica]();
  for (let i = 0; i < trozos.length; i++) {
    const clave = `${metodo} /` + trozos.map((t, j) => (j === i ? ':id' : t)).join('/');
    if (M[clave]) return M[clave]();
  }
  /* ⛔ 20 de septiembre de 2026. Esto RESOLVÍA la promesa, y ese era el
     peor fallo de todo el modo demostración: veintisiete botones de
     guardar respondían con un aviso VERDE de éxito cuyo texto era «en la
     demostración todavía no trae datos», el formulario se limpiaba y se
     plegaba como si hubiera guardado. Quien recorriera la solución creía
     estar creando grupos, casos y voluntariados.
     Un aviso rojo que dice la verdad vale más que veintisiete verdes que
     mienten. Ahora se RECHAZA, y el manejo de error que ya tienen todas
     las vistas hace su trabajo. */
  if (metodo !== 'GET') {
    const e = new Error('En la demostración no se guarda nada: esta acción existe en el sistema real. '
      + 'Lo que ve aquí son datos inventados que viven solo en esta pestaña.');
    e.estado = 501; e.demo = true;
    throw e;
  }
  const e = new Error('Esta pantalla todavía no trae datos de ejemplo en la demostración.');
  e.estado = 501; e.demo = true;
  throw e;
}

export const demoActivo = () =>
  window.CASAROCA_DEMO === true || new URLSearchParams(location.search).has('demo');

export function responderDemo(ruta, opciones = {}) {
  const metodo = (opciones.method ?? 'GET').toUpperCase();
  /* ⛔ Sin el cuerpo, la demostración solo sabía contestar «aquí no se
     guarda nada» y cada casilla que se marcaba volvía sola a su sitio al
     cambiar de pestaña. Una demostración en la que nada reacciona no
     enseña el sistema: enseña una foto. Lo que se marca aquí vive en la
     memoria de ESTA pestaña y muere al cerrarla. */
  let cuerpo = null;
  try { cuerpo = opciones.body ? JSON.parse(opciones.body) : null; } catch { cuerpo = null; }
  return new Promise((resolver, rechazar) => setTimeout(() => {
    try { resolver(responder(metodo, ruta, cuerpo)); }
    catch (e) { rechazar(e); }
  }, 120));
}
