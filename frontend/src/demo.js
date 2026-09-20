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

const SEDES = [
  { id: id(1), codigo: 'BOG-NORTE', nombre: 'Bogotá Norte (demo)' },
  { id: id(2), codigo: 'MED', nombre: 'Medellín (demo)' },
  { id: id(3), codigo: 'CHIA', nombre: 'Chía (demo)' },
];

const PERSONAS = [
  'Marta Quiroga Peña', 'Andrés Beltrán Ruiz', 'Lucía Naranjo Díaz', 'Tomás Ibarra Cano',
  'Elena Vargas Toro', 'Julián Espinosa Mora', 'Rosa Cifuentes Lara', 'Damián Rueda Silva',
].map((nombre, i) => ({
  id: id(100 + i), nombre, nombre_completo: nombre,
  numero_documento: String(1020304050 + i * 7), documento: String(1020304050 + i * 7),
  sede: SEDES[i % 3].codigo, sede_codigo: SEDES[i % 3].codigo, estado: 'activa',
}));

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

/** Respuestas por ruta. La clave es «MÉTODO ruta» con los identificadores
    sustituidos por `:id`, igual que las declara el servidor. */
function responder(metodo, ruta) {
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
      modulos: ['personas','asistencia','grupos','rocakids','consejeria','formacion','talento','sistemas','aportes','crm']
        .map(m => ({ modulo: m, nombre: m, nivel_dato: m === 'consejeria' || m === 'talento' ? 3 : m === 'rocakids' ? 4 : 2 })),
    }),
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
    'GET /identidad/catalogos': () => ({ abiertos: [
      { codigo: 'estado_civil', nombre: 'Estado civil', descripcion: 'Lista abierta: cambia con la ley y con la realidad de la gente.', vigentes: 6 },
      { codigo: 'medio_pago', nombre: 'Medio de pago', descripcion: 'Aparecen medios nuevos cada año.', vigentes: 9 }],
      cerrados: [{ codigo: 'nivel_sensibilidad', nombre: 'Nivel de sensibilidad', motivo: 'Lo fija la política de datos, no la operación.' }] }),
    'GET /rocakids/salas': () => ({ total_filas: 2, salas: [
      { id: id(960), nombre: 'Cuna (0 a 2)', sede: 'BOG-NORTE', dentro: 12, adultos: 3, cumple_dos_adultos: true },
      { id: id(961), nombre: 'Exploradores (6 a 8)', sede: 'BOG-NORTE', dentro: 21, adultos: 1, cumple_dos_adultos: false }] }),
    'GET /salud/detalle': () => ({ estado: 'demostración', base: { estado: 'sin base', ms: 0 }, particiones: [], fugasDeLectura: 0 }),
  };

  /* Se busca la clave exacta y, si no, la genérica con `:id`. */
  const exacta = `${metodo} ${p}`;
  if (M[exacta]) return M[exacta]();
  const generica = `${metodo} /` + trozos.map((t, i) =>
    /^[0-9a-f-]{16,}$/i.test(t) ? ':id' : t).join('/');
  if (M[generica]) return M[generica]();
  return { demo: true, ruta: p, mensaje: 'En la demostración esta pantalla todavía no trae datos de ejemplo.' };
}

export const demoActivo = () =>
  window.CASAROCA_DEMO === true || new URLSearchParams(location.search).has('demo');

export function responderDemo(ruta, opciones = {}) {
  const metodo = (opciones.method ?? 'GET').toUpperCase();
  return new Promise(r => setTimeout(() => r(responder(metodo, ruta)), 120));
}
