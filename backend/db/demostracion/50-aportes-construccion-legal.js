'use strict';
/**
 * =====================================================================
 * 50-aportes-construccion-legal.js · APORTES, CONSTRUCCIÓN Y LEGAL
 *
 * ⛔ SOLO DEMOSTRACIÓN. Todo lo que deja este archivo es inventado: los
 *    aportes, los pagos en línea, los certificados, las obras y los
 *    asuntos legales. La guarda de comun.js impide correrlo fuera de
 *    casaroca_dev, casaroca_test, cr_e2e_* o cr_pob_*. Jamás va a
 *    producción.
 *
 * APORTES · en las 26 sedes donde el módulo está encendido (Houston queda
 * afuera a propósito y las plantaciones no tienen tesorería):
 *   · El año 2025 llegó por migración el día de la salida en vivo de cada
 *     sede (fuente «importado», ya confirmado y conciliado mes a mes con su
 *     cierre de control): así el certificado de 2025 va completo. Desde la
 *     salida en vivo hasta ayer, el digitador registra y la tesorera
 *     confirma los martes: dos manos distintas. Si la sede no tenía
 *     tesorera, confirma el Equipo de Finanzas; si no tenía a nadie, el
 *     primero que llegó digitó el atraso.
 *   · Diezmos, ofrendas, pactos (misiones y construcción), primicias de
 *     enero, proyectos (RocaKids, tMt, Instituto), donaciones de
 *     beneficencia, «otro» y la ofrenda anónima del culto de cada domingo,
 *     cada uno en su fondo y por el medio de pago que se usa en su país.
 *   · Estacionalidad: diciembre sube (diezmo de la prima, ofrenda de
 *     Navidad, mercados), junio sube con la prima, enero trae primicias,
 *     los salarios suben en febrero y el Domingo de Resurrección se nota.
 *   · Por confirmar lo de la última semana (y cuatro semanas en
 *     Barranquilla, que cambió de tesorera en julio); anulados con motivo y
 *     su registro corregido; un aporte digitado dos veces que el cierre de
 *     agosto de Bucaramanga delata, y un sobre de julio que Cali nunca
 *     digitó.
 *   · «Dar en línea» con la pasarela desde abril de 2026: intentos,
 *     rechazos, vencidos, avisos de la pasarela (uno con firma falsa y otro
 *     de una referencia que no existe), pagos sin dueño por emparejar, uno
 *     emparejado a mano y los desembolsos semanales con su comisión.
 *   · Certificados de donación de 2025 expedidos con
 *     aportes.expedir_certificado por la tesorera de cada sede de Colombia
 *     (donde la DIAN los pide), y uno anulado y vuelto a expedir porque un
 *     monto estaba mal digitado.
 * CONSTRUCCIÓN · en las 6 sedes con obra: diez obras con presupuesto e
 *   hitos que mueven el avance y lo ejecutado (el disparador de la base lo
 *   hace): una atrasada que gasta más de lo que avanza, dos terminadas, una
 *   suspendida, una planeada y una cancelada.
 * LEGAL · encendido solo en la sede madre, porque es corporativo:
 *   dieciséis asuntos con su tipo, su término y sus actuaciones; tres con
 *   término en los próximos quince días y uno ya vencido.
 *
 * Construcción y Legal solo los maneja la dirección general (la matriz de
 * permisos no se los da a nadie más), así que sus autores son el Pastor
 * Principal y su esposa. Los responsables son personas que la dirección
 * alcanza en ese módulo (ver el informe: el filtro de módulos por sede le
 * esconde al resto).
 *
 * Todo en UNA transacción: o queda todo, o nada.
 * Uso:    PGDATABASE=cr_e2e_65 node backend/db/demostracion/50-aportes-construccion-legal.js
 * Ensayo: ENSAYO=1 corre todo, cuenta y revierte (no deja nada en la base).
 * =====================================================================
 */
const d = require('./comun');
const {
  AYER, SISTEMA, SALIDAS_POR_OLA,
  sumarDias, sumarMeses, sumarAnios, diasEntre, edad, diaSemana, domingosEntre, momentoLocal,
  minFecha, maxFecha, insertarLote, fijarAutor, crypto,
} = d;

/* ─────────────────────────────────────────────────────────────────────
   1 · LAS FECHAS Y LAS CIFRAS DEL TEMA
   ───────────────────────────────────────────────────────────────────── */

/** El histórico arranca con el año 2025: el certificado de 2025 va completo. */
const INICIO = '2025-01-01';
/** El último cierre mensual que ya cargó el Equipo de Finanzas. */
const ULTIMO_MES_CERRADO = '2026-08';
/** «Dar en línea» con la pasarela se abrió este lunes. */
const EN_LINEA_DESDE = '2026-04-06';
/** La tesorera confirma los martes: el último fue este. */
const ULTIMA_CONFIRMACION = '2026-09-15';
/** Barranquilla cambió de tesorera en julio y va atrasada. */
const CONFIRMACION_ATRASADA = { BAQ: '2026-08-25' };
/** Domingos de Resurrección del histórico. */
const RESURRECCION = new Set(['2025-04-20', '2026-04-05']);

const MONEDA_PAIS = { CO: 'COP', US: 'USD', PA: 'USD', ES: 'EUR' };

/** Lo que diezma al mes un hogar típico de la sede, en su moneda (mediana). */
const DIEZMO_MEDIANO = {
  'BOG-CHICO': 560000, 'BOG-NORTE': 450000, 'BOG-OCC': 330000, 'BOG-SUBA': 320000, 'BOG-SUR': 220000,
  SOACHA: 190000, MED: 360000, ENV: 390000, BELLO: 240000, CALI: 330000, BAQ: 320000, BGA: 330000,
  CTG: 300000, PEI: 270000, MZL: 270000, ARM: 250000, IBG: 250000, VVC: 270000, NVA: 240000,
  SMR: 250000, CUC: 240000, MIA: 380, ORL: 320, PTY: 170, MAD: 170, BCN: 185,
};
/** Lo que deja cada adulto en la ofrenda del culto, en promedio. */
const OFRENDA_POR_ADULTO = { COP: 9000, USD: 5.5, EUR: 4.5 };
const MINIMO = { COP: { diezmo: 20000, ofrenda: 5000 }, USD: { diezmo: 20, ofrenda: 5 }, EUR: { diezmo: 20, ofrenda: 5 } };
/** Donación de beneficencia típica (mercados de Navidad, lluvias). */
const DONACION = { COP: [30000, 160000], USD: [20, 80], EUR: [20, 60] };

/** Desde cuándo cada sede con obra recoge pactos para su construcción. */
const CAMPANA_OBRA = {
  'BOG-CHICO': '2025-10-01', 'BOG-SUR': '2025-09-01', MED: '2026-02-01', CALI: '2026-05-01', BAQ: '2026-03-01',
  VVC: '2025-11-01',
};

/** Cómo quiere dar un hogar típico en cada país (el medio que prefiere). */
function medioPreferido(az, pais, e) {
  if (pais === 'CO') {
    if (e < 30) return az.ponderado({ nequi_daviplata: 40, transferencia: 34, efectivo: 10, pse: 8, datafono: 8 });
    if (e < 60) return az.ponderado({ transferencia: 38, efectivo: 19, nequi_daviplata: 14, datafono: 10, pse: 8, consignacion: 7, tarjeta: 3, cheque: 1 });
    return az.ponderado({ efectivo: 48, consignacion: 24, transferencia: 22, cheque: 4, datafono: 2 });
  }
  if (pais === 'US') return az.ponderado({ transferencia: 40, cheque: 28, tarjeta: 20, efectivo: 12 });
  if (pais === 'PA') return az.ponderado({ transferencia: 42, otro: 22, efectivo: 20, tarjeta: 16 });
  return az.ponderado({ transferencia: 48, otro: 24, efectivo: 16, tarjeta: 12 });   // España
}
/** Lo que se entrega en el culto (sobre, datáfono, cheque) lleva fecha de domingo. */
const EN_EL_CULTO = new Set(['efectivo', 'datafono', 'cheque']);
const BANCOS_CO = ['Bancolombia', 'Davivienda', 'Banco de Bogotá', 'BBVA', 'Banco de Occidente', 'Banco Popular',
  'Scotiabank Colpatria', 'AV Villas', 'Banco Caja Social', 'Itaú'];
const BANCOS_EXT = { US: ['Chase', 'Bank of America', 'Wells Fargo', 'TD Bank'], PA: ['Banco General', 'Banistmo', 'BAC'],
  ES: ['CaixaBank', 'BBVA', 'Banco Santander', 'Sabadell'] };

/** Perfil de quien da, según su compromiso. */
const PERFIL = {
  lider: { constante: 70, frecuente: 20, ocasional: 7, ninguno: 3 },
  miembro: { constante: 40, frecuente: 25, ocasional: 18, ninguno: 17 },
  visitante: { constante: 2, frecuente: 6, ocasional: 30, ninguno: 62 },
};
const PERFIL_SECUNDARIO = { constante: 35, frecuente: 35, ocasional: 30 };

/* ─────────────────────────────────────────────────────────────────────
   2 · AYUDAS
   ───────────────────────────────────────────────────────────────────── */

const mesDe = (f) => f.slice(0, 7);
const finDeMes = (m) => sumarDias(sumarMeses(`${m}-01`, 1), -1);
function mesesEntre(desde, hasta) {
  const salida = [];
  for (let m = mesDe(desde); m <= mesDe(hasta); m = mesDe(sumarMeses(`${m}-01`, 1))) salida.push(m);
  return salida;
}
/** El día `dia` del mes, recortado al último día. */
function diaDelMes(m, dia) {
  const fin = finDeMes(m);
  const f = `${m}-${String(Math.max(1, dia)).padStart(2, '0')}`;
  return f > fin ? fin : f;
}
/** El k-ésimo domingo del mes (k = -1: el último). */
function domingoDelMes(m, k) {
  const doms = domingosEntre(`${m}-01`, finDeMes(m));
  return k < 0 ? doms[doms.length - 1] : doms[Math.min(k, doms.length) - 1];
}
/** El domingo más cercano hacia adelante dentro del mes (o el anterior si se sale del mes). */
function alDomingo(f) {
  if (diaSemana(f) === 0) return f;
  const sig = sumarDias(f, 7 - diaSemana(f));
  return mesDe(sig) === mesDe(f) ? sig : sumarDias(f, -diaSemana(f));
}
/** El primer martes estrictamente después de la fecha. */
function martesDespues(f) { const w = diaSemana(f); return sumarDias(f, ((2 - w + 7) % 7) || 7); }
/** Si cae en fin de semana, pasa al lunes. */
function habil(f) { const w = diaSemana(f); return w === 6 ? sumarDias(f, 2) : w === 0 ? sumarDias(f, 1) : f; }
/** Lunes de la semana de la fecha. */
function lunesDe(f) { return sumarDias(f, -((diaSemana(f) + 6) % 7)); }
/** Instante como texto ISO (para timestamptz), a partir de milisegundos. */
const iso = (ms) => new Date(ms).toISOString();
const ms = (fecha, hora, zona) => Date.parse(momentoLocal(fecha, hora, zona));

/** Quién tenía el cargo en esa fecha. */
function titularEn(lista, f) { return (lista ?? []).find(x => x.desde <= f && (!x.hasta || x.hasta >= f)) ?? null; }
/** El primer inicio de un titular a partir de esa fecha, entre varias listas. */
function primerInicioDesde(listas, f) {
  let mejor = null;
  for (const l of listas) for (const x of l ?? []) if (x.desde >= f && (!mejor || x.desde < mejor)) mejor = x.desde;
  return mejor;
}

/** Redondea como redondea la gente (de a 10.000, 5.000 o 1.000 pesos; de a 10, 5 o 1 dólar o euro). */
function redondear(monto, moneda, paso) {
  const p = paso ?? (moneda === 'COP' ? 1000 : 1);
  return Math.max(p, Math.round(monto / p) * p);
}
function pasoDe(az, moneda) {
  return Number(moneda === 'COP' ? az.ponderado({ 10000: 50, 5000: 30, 1000: 20 }) : az.ponderado({ 10: 55, 5: 35, 1: 10 }));
}
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** '2025-11-18' → '18 de noviembre de 2025' (así se lee en un motivo). */
const fechaLarga = (f) => `${Number(f.slice(8, 10))} de ${MESES[Number(f.slice(5, 7)) - 1]} de ${f.slice(0, 4)}`;
const dinero = (v, moneda) => moneda === 'COP'
  ? Math.round(v).toLocaleString('es-CO')
  : Number(v).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** La referencia que se ve en la lista: lo que dice el comprobante. */
function referenciaDe(az, a, g, s) {
  const pais = s.pais;
  const banco = g?.bancos?.[pais] ?? az.elegir(pais === 'CO' ? BANCOS_CO : BANCOS_EXT[pais] ?? BANCOS_CO);
  switch (a.medio) {
    case 'efectivo': return g?.sobres?.[s.codigo] ? `Sobre ${g.sobres[s.codigo]}` : `Recibo de caja ${az.entero(1000, 9999)}`;
    case 'transferencia':
      if (pais === 'US') return `Zelle ${az.hex(8).toUpperCase()}`;
      return `Transferencia ${banco} · ${az.entero(10000000, 99999999)}`;
    case 'nequi_daviplata': return `${g?.billetera ?? 'Nequi'} · M${az.entero(1000000, 9999999)}`;
    case 'pse': return `PSE · CUS ${az.entero(1000000000, 1999999999)}`;
    case 'consignacion': return `Consignación ${banco} · ${az.entero(10000, 99999)}`;
    case 'datafono': return `Datáfono · voucher ${String(az.entero(1, 99999)).padStart(6, '0')}`;
    case 'tarjeta': return `Tarjeta · aprobación ${az.entero(100000, 999999)}`;
    case 'cheque': return pais === 'US' ? `Check #${az.entero(1001, 2999)}` : `Cheque ${String(az.entero(1, 999999)).padStart(6, '0')} · ${banco}`;
    case 'otro': return pais === 'ES' ? `Bizum · ${az.entero(10000, 99999)}` : pais === 'PA' ? `Yappy · ${az.entero(100000, 999999)}` : `Otro medio · ${az.entero(1000, 9999)}`;
    default: return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────
   3 · LO QUE SE LEE DE LA BASE
   ───────────────────────────────────────────────────────────────────── */

async function cargar(c) {
  const S = {};
  for (const s of await d.sedes(c, { conModulo: 'aportes' })) {
    const moneda = MONEDA_PAIS[s.pais] ?? 'COP';
    S[s.codigo] = { ...s, moneda, golive: SALIDAS_POR_OLA[s.ola_migracion] ?? INICIO,
      mediana: DIEZMO_MEDIANO[s.codigo] ?? (moneda === 'COP' ? 260000 : 200),
      adultos: 0, digitadores: [], tesoreros: [], proximoSobre: 101, acta: 0 };
  }
  const { rows: titulares } = await c.query(
    `SELECT a.rol, s.codigo, a.persona_id, to_char(a.vigente_desde, 'YYYY-MM-DD') AS desde,
            to_char(a.vigente_hasta, 'YYYY-MM-DD') AS hasta
       FROM identidad.asignaciones a JOIN org.sedes s ON s.id = a.alcance_id
      WHERE a.rol IN ('TESORERIA', 'DIGITADOR_APORTES') AND a.alcance_tipo = 'sede' AND a.revocada_en IS NULL
      ORDER BY s.codigo, a.rol, a.vigente_desde, a.persona_id`);
  for (const t of titulares) if (S[t.codigo]) S[t.codigo][t.rol === 'TESORERIA' ? 'tesoreros' : 'digitadores'].push(t);

  /* El Equipo de Finanzas confirma cuando la sede no tiene tesorera (o cuando la tesorera digitó). */
  const { rows: finanzas } = await c.query(
    `SELECT m.persona_id, m.rol_en_unidad, to_char(m.desde, 'YYYY-MM-DD') AS desde, to_char(m.hasta, 'YYYY-MM-DD') AS hasta
       FROM org.unidad_miembros m JOIN org.unidades u ON u.id = m.unidad_id JOIN nucleo.personas p ON p.id = m.persona_id
      WHERE u.codigo = 'EQ-FIN' AND m.revocado_en IS NULL
      ORDER BY p.primer_apellido, p.primer_nombre, m.persona_id`);

  const { rows: pas } = await c.query(
    `SELECT DISTINCT persona_id FROM identidad.asignaciones
      WHERE rol IN ('PASTOR_CONGREGACIONAL', 'PASTOR_DIRECTOR_GENERAL') AND revocada_en IS NULL`);

  const { rows: gente } = await c.query(
    `SELECT p.id, p.source_id, p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido,
            p.genero::text AS genero, to_char(p.fecha_nacimiento, 'YYYY-MM-DD') AS fnac, p.nivel_compromiso AS nivel,
            p.estado::text AS estado, p.email_principal::text AS email, p.numero_documento AS documento,
            p.tipo_documento, p.telefono_movil AS telefono, s.codigo AS sede,
            hm.hogar_id, h.jefe_hogar_id AS jefe_id,
            (SELECT v.tipo FROM nucleo.vinculos v WHERE v.persona_id = h.jefe_hogar_id AND v.relacionada_id = p.id
                AND v.vigente_hasta IS NULL ORDER BY v.tipo LIMIT 1) AS parentesco
       FROM nucleo.personas p
       JOIN org.sedes s ON s.id = p.sede_id
       LEFT JOIN grupos.hogar_miembros hm ON hm.persona_id = p.id AND hm.hasta IS NULL
       LEFT JOIN grupos.hogares h ON h.id = hm.hogar_id
      WHERE p.eliminado_en IS NULL AND p.fecha_nacimiento IS NOT NULL
      ORDER BY p.source_id NULLS FIRST, p.id`);

  const { rows: membs } = await c.query(
    `SELECT m.persona_id, s.codigo AS sede, m.tipo, to_char(m.desde, 'YYYY-MM-DD') AS desde,
            to_char(m.hasta, 'YYYY-MM-DD') AS hasta
       FROM nucleo.membresias_sede m JOIN org.sedes s ON s.id = m.sede_id
      WHERE m.tipo IN ('miembro', 'visitante', 'egresado')
      ORDER BY m.persona_id, m.desde, s.codigo`);
  const membsDe = new Map();
  for (const m of membs) (membsDe.get(m.persona_id) ?? membsDe.set(m.persona_id, []).get(m.persona_id)).push(m);

  for (const p of gente) if (S[p.sede] && p.estado === 'activa' && edad(p.fnac) >= 18) S[p.sede].adultos++;

  const { rows: fondos } = await c.query(`SELECT codigo, id FROM aportes.fondos`);
  const fondo = Object.fromEntries(fondos.map(f => [f.codigo, f.id]));

  /* Los catálogos mandan: si alguno de los valores que se usan no está vigente, no se sigue. */
  const tipos = new Set(await d.valoresDe(c, 'tipo_aporte'));
  const medios = new Set(await d.valoresDe(c, 'medio_pago'));
  for (const t of ['diezmo', 'ofrenda', 'pacto', 'proyecto', 'primicia', 'otro', 'donacion']) {
    if (!tipos.has(t)) throw new Error(`El tipo de aporte «${t}» no está vigente en el catálogo.`);
  }
  for (const m of ['efectivo', 'transferencia', 'tarjeta', 'pse', 'cheque', 'datafono', 'nequi_daviplata', 'consignacion', 'otro']) {
    if (!medios.has(m)) throw new Error(`El medio de pago «${m}» no está vigente en el catálogo.`);
  }
  for (const f of ['GENERAL', 'DIEZMOS', 'MISIONES', 'CONSTRUCCION', 'BENEFICENCIA', 'ROCAKIDS', 'TMT', 'INSTITUTO']) {
    if (!fondo[f]) throw new Error(`Falta el fondo ${f} (semilla 016).`);
  }
  const personaPorId = new Map(gente.map(p => [p.id, p]));
  return { S, finanzas, pastores: new Set(pas.map(x => x.persona_id)), gente, membsDe, fondo, personaPorId };
}

/** Quién del Equipo de Finanzas hace la tarea de la semana (rota entre los que estaban). */
function deFinanzas(finanzas, f) {
  const vivos = finanzas.filter(x => x.desde <= f && (!x.hasta || x.hasta >= f));
  if (!vivos.length) return null;
  const semana = Math.floor(diasEntre('2025-01-06', f) / 7);
  return vivos[((semana % vivos.length) + vivos.length) % vivos.length];
}
/** La líder del Equipo de Finanzas en esa fecha (o el coordinador si aún no había líder). */
function liderFinanzas(finanzas, f) {
  const vivos = finanzas.filter(x => x.desde <= f && (!x.hasta || x.hasta >= f));
  return vivos.find(x => x.rol_en_unidad === 'lider') ?? vivos.find(x => x.rol_en_unidad === 'coordinador') ?? vivos[0] ?? null;
}

/* ─────────────────────────────────────────────────────────────────────
   4 · QUIÉN DA, CUÁNTO Y CÓMO
   ───────────────────────────────────────────────────────────────────── */

function construirDadores(ctx, az0) {
  const { gente, membsDe, S, pastores } = ctx;
  const porHogar = new Map();
  for (const p of gente) if (p.hogar_id) (porHogar.get(p.hogar_id) ?? porHogar.set(p.hogar_id, []).get(p.hogar_id)).push(p);

  const papelEnHogar = (p) => {
    if (!p.hogar_id) return 'principal';
    const adultos = porHogar.get(p.hogar_id).filter(x => edad(x.fnac) >= 18);
    const jefe = adultos.find(x => x.id === p.jefe_id) ?? adultos.slice().sort((a, b) => a.fnac.localeCompare(b.fnac))[0];
    if (jefe && jefe.id === p.id) return 'principal';
    return p.parentesco === 'CONYUGE' ? 'conyuge' : 'otro';
  };

  const dadores = [];
  for (const p of gente) {
    const e = edad(p.fnac);
    if (e < 18 || !['activa', 'inactiva', 'fallecida', 'trasladada'].includes(p.estado)) continue;
    const az = az0.derivar(`dador:${p.source_id ?? p.id}`);
    const ms = membsDe.get(p.id) ?? [];
    const cumple18 = sumarAnios(p.fnac, 18);

    /* Los tramos en que la persona congregó en una sede con aportes. */
    const periodos = [];
    for (const m of ms) {
      if (!S[m.sede]) continue;
      let desde = maxFecha(maxFecha(m.desde, INICIO), cumple18);
      const hasta = minFecha(m.hasta ?? AYER, AYER);
      const esTraslado = ms.some(o => o !== m && o.hasta && Math.abs(diasEntre(o.hasta, m.desde)) <= 3);
      /* Quien llega no da el primer domingo; quien se trasladó sigue dando en su nueva sede. */
      if (m.desde > INICIO && !esTraslado) desde = sumarDias(desde, m.tipo === 'visitante' ? az.entero(7, 60) : az.entero(20, 100));
      if (desde <= hasta) periodos.push({ sede: m.sede, desde, hasta, tipo: m.tipo });
    }
    if (!periodos.length) continue;

    const papel = papelEnHogar(p);
    let perfil;
    if (pastores.has(p.id)) perfil = 'constante';
    else if (papel === 'principal') perfil = az.ponderado(PERFIL[p.nivel] ?? PERFIL.miembro);
    else {
      const pDa = papel === 'conyuge' ? 0.2 : e >= 61 ? 0.35 : e >= 23 ? 0.3 : 0.15;
      perfil = az.probabilidad(pDa) ? az.ponderado(PERFIL_SECUNDARIO) : 'ninguno';
      if (perfil !== 'ninguno' && p.nivel === 'visitante') perfil = 'ocasional';
    }
    if (perfil === 'ninguno') continue;

    /* Quien dejó de venir dejó de dar. */
    if (p.estado === 'inactiva') {
      const ultimo = periodos[periodos.length - 1];
      const tope = minFecha(ultimo.hasta, '2026-06-30');
      const piso = sumarDias(ultimo.desde, 45);
      if (piso > tope) continue;
      ultimo.hasta = az.fechaEntre(piso, tope);
    }

    const k = Math.min(3.5, Math.max(0.3, Math.exp(az.normal(0, 0.5))));
    const factorEdad = e < 25 ? 0.45 : e < 35 ? 0.85 : e < 60 ? 1 : 0.7;
    const factorPapel = papel === 'principal' ? 1 : papel === 'conyuge' ? 0.55 : 0.45;
    const hijos = p.hogar_id ? porHogar.get(p.hogar_id).filter(x => edad(x.fnac) < 18) : [];
    const g = {
      p, papel, perfil, e,
      factor: k * factorEdad * factorPapel,
      pasos: {},
      empleado: az.probabilidad(e >= 22 && e <= 62 ? 0.7 : 0.2),
      aumento: az.probabilidad(0.55) ? az.decimal(0.05, 0.12) : 0,
      quincenal: perfil === 'constante' && az.probabilidad(0.18),
      dia: az.elegir([1, 2, 3, 5, 5, 10, 15, 15, 16, 20, 25, 28, 30, 30]),
      domingo: az.elegir([1, 1, 2, -1]),
      medios: {}, bancos: {}, sobres: {},
      billetera: az.probabilidad(0.7) ? 'Nequi' : 'Daviplata',
      pactoMisiones: perfil === 'constante' && p.nivel === 'lider' && papel === 'principal' && az.probabilidad(0.14)
        ? az.decimal(0.08, 0.2) : 0,
      pactoObra: ['constante', 'frecuente'].includes(perfil) && papel === 'principal' && az.probabilidad(0.24)
        ? az.decimal(0.2, 0.55) : 0,
      conNinos: hijos.some(x => edad(x.fnac) < 12),
      jovenes: hijos.some(x => edad(x.fnac) >= 12) || (e < 30),
      /* Dar en línea: algunos, jóvenes y con correo, se pasan a la pasarela desde abril. */
      enLinea: null, medioEnLinea: null,
      periodos,
    };
    const ultimaSede = periodos[periodos.length - 1];
    if (S[ultimaSede.sede].pais === 'CO' && ['constante', 'frecuente'].includes(perfil) && p.email && e >= 20 && e <= 54
        && p.estado === 'activa' && az.probabilidad(0.1)) {
      g.enLinea = az.fechaEntre(EN_LINEA_DESDE, '2026-07-31');
      g.medioEnLinea = az.probabilidad(0.6) ? 'pse' : 'tarjeta';
    }
    for (const per of periodos) {
      const s = S[per.sede];
      if (!g.medios[s.pais]) {
        g.medios[s.pais] = medioPreferido(az, s.pais, e);
        g.bancos[s.pais] = az.elegir(s.pais === 'CO' ? BANCOS_CO : BANCOS_EXT[s.pais]);
      }
      if (!g.pasos[s.moneda]) g.pasos[s.moneda] = pasoDe(az, s.moneda);
      if (g.medios[s.pais] === 'efectivo' && !g.sobres[s.codigo]) g.sobres[s.codigo] = String(s.proximoSobre++).padStart(4, '0');
    }
    dadores.push(g);
  }
  return dadores;
}

/** Los aportes con nombre de un dador, tramo por tramo y mes por mes. */
function aportesDeDador(g, az, S, manuales, enLinea) {
  for (const per of g.periodos) {
    const s = S[per.sede];
    const mon = s.moneda;
    const paso = g.pasos[mon];
    const base = Math.max(MINIMO[mon].diezmo, redondear(s.mediana * g.factor, mon, paso));
    const medioP = g.medios[s.pais];
    const [dMin, dMax] = DONACION[mon];

    const pon = (f, tipo, fondo, monto, op = {}) => {
      if (!f || f < per.desde || f > per.hasta) return;
      let medio = op.medio ?? (az.probabilidad(0.87) ? medioP : medioPreferido(az, s.pais, g.e));
      if (EN_EL_CULTO.has(medio) || (medio === 'tarjeta' && s.pais !== 'CO')) f = alDomingo(f);
      if (f < per.desde || f > per.hasta) return;
      const a = { persona_id: g.p.id, sede: s.codigo, fecha: f, tipo, fondo, monto, moneda: mon, medio, anonimo: false, g };
      if (g.enLinea && f >= g.enLinea && s.pais === 'CO' && ['diezmo', 'ofrenda', 'pacto'].includes(tipo)) {
        enLinea.push({ ...a, medio: g.medioEnLinea });
      } else manuales.push(a);
    };
    const objetivo = (m) => EN_EL_CULTO.has(medioP) ? domingoDelMes(m, g.domingo) : diaDelMes(m, g.dia + az.entero(0, 2));

    if (g.perfil === 'ocasional') {
      const veces = az.entero(1, 3);
      for (let i = 0; i < veces; i++) {
        const f = az.fechaEntre(per.desde, per.hasta);
        const tipo = az.ponderado({ ofrenda: 62, diezmo: 26, donacion: 12 });
        const monto = tipo === 'diezmo' ? redondear(base * az.decimal(0.4, 1), mon, paso)
          : tipo === 'donacion' ? redondear(az.decimal(dMin, dMax), mon, paso)
            : Math.max(MINIMO[mon].ofrenda, redondear(base * az.decimal(0.05, 0.2), mon, mon === 'COP' ? 5000 : 5));
        pon(f, tipo, tipo === 'diezmo' ? 'DIEZMOS' : tipo === 'donacion' ? 'BENEFICENCIA' : 'GENERAL', monto);
      }
      continue;
    }

    const pMes = g.perfil === 'constante' ? 0.94 : 0.55;
    for (const m of mesesEntre(per.desde, per.hasta)) {
      const mm = m.slice(5);
      const baseMes = redondear(base * (m >= '2026-02' && g.aumento ? 1 + g.aumento : 1), mon, paso);
      if (az.probabilidad(pMes)) {
        if (g.quincenal && !EN_EL_CULTO.has(medioP)) {
          pon(diaDelMes(m, 1 + az.entero(0, 3)), 'diezmo', 'DIEZMOS', redondear(baseMes / 2, mon, paso));
          pon(diaDelMes(m, 15 + az.entero(0, 3)), 'diezmo', 'DIEZMOS', redondear(baseMes / 2, mon, paso));
        } else {
          const monto = g.perfil === 'constante'
            ? (az.probabilidad(0.1) ? redondear(baseMes * az.decimal(0.8, 1.25), mon, paso) : baseMes)
            : redondear(baseMes * az.decimal(0.6, 1), mon, paso);
          pon(objetivo(m), 'diezmo', 'DIEZMOS', Math.max(MINIMO[mon].diezmo, monto));
        }
        if (g.pactoMisiones) pon(objetivo(m), 'pacto', 'MISIONES', redondear(base * g.pactoMisiones, mon, mon === 'COP' ? 10000 : 5));
        if (g.pactoObra && CAMPANA_OBRA[s.codigo] && `${m}-28` >= CAMPANA_OBRA[s.codigo]) {
          pon(objetivo(m), 'pacto', 'CONSTRUCCION', redondear(base * g.pactoObra, mon, mon === 'COP' ? 10000 : 5));
        }
      }
      if (az.probabilidad(g.perfil === 'constante' ? 0.22 : 0.12)) {
        pon(domingoDelMes(m, az.elegir([1, 2, 3, -1])), 'ofrenda', 'GENERAL',
          Math.max(MINIMO[mon].ofrenda, redondear(baseMes * az.decimal(0.06, 0.2), mon, mon === 'COP' ? 5000 : 5)));
      }
      if (mm === '01' && az.probabilidad(g.perfil === 'constante' ? 0.45 : 0.2)) {
        pon(az.fechaEntre(`${m}-04`, `${m}-25`), 'primicia', 'GENERAL', redondear(baseMes * az.decimal(0.5, 1.2), mon, paso));
      }
      /* La prima de servicios (junio y diciembre): quien diezma de su sueldo diezma también de la prima. */
      if ((mm === '06' || mm === '12') && s.pais === 'CO' && g.empleado && g.papel === 'principal' && g.perfil === 'constante') {
        pon(az.fechaEntre(`${m}-${mm === '06' ? '18' : '15'}`, `${m}-${mm === '06' ? '30' : '22'}`), 'diezmo', 'DIEZMOS',
          redondear(baseMes * 0.5, mon, paso));
      }
      if (mm === '12') {
        if (az.probabilidad(g.perfil === 'constante' ? 0.45 : 0.3)) {
          pon(az.fechaEntre(`${m}-18`, `${m}-24`), 'ofrenda', 'GENERAL', redondear(baseMes * az.decimal(0.15, 0.6), mon, paso));
        }
        if (az.probabilidad(0.2)) pon(az.fechaEntre(`${m}-01`, `${m}-14`), 'donacion', 'BENEFICENCIA', redondear(az.decimal(dMin, dMax), mon, paso));
      }
      if (m === '2026-05' && s.pais === 'CO' && az.probabilidad(0.12)) {
        pon(az.fechaEntre('2026-05-08', '2026-05-31'), 'donacion', 'BENEFICENCIA', redondear(az.decimal(dMin, dMax), mon, paso));
      }
    }
    /* Una vez en el año: dotación de las salas, becas del campamento, instituto, algo más. */
    if (g.conNinos && az.probabilidad(0.08)) pon(az.fechaEntre('2026-03-01', '2026-04-30'), 'proyecto', 'ROCAKIDS', redondear(base * az.decimal(0.2, 0.7), mon, paso));
    if (az.probabilidad(g.jovenes ? 0.1 : 0.04)) pon(az.fechaEntre('2026-08-01', '2026-09-18'), 'proyecto', 'TMT', redondear(base * az.decimal(0.25, 0.9), mon, paso));
    if (az.probabilidad(0.025)) pon(az.fechaEntre(per.desde, per.hasta), 'proyecto', 'INSTITUTO', redondear(base * az.decimal(0.3, 1), mon, paso));
    if (az.probabilidad(0.012)) pon(az.fechaEntre(per.desde, per.hasta), 'otro', 'GENERAL', redondear(base * az.decimal(0.1, 0.4), mon, paso));
  }
}

/** La ofrenda del culto de cada domingo: anónima, en efectivo, contada y firmada. */
function ofrendasDelCulto(S, az0, manuales) {
  for (const s of Object.values(S)) {
    const az = az0.derivar(`culto:${s.codigo}`);
    const mon = s.moneda;
    const redondeo = mon === 'COP' ? 50 : 1;
    const fechas = domingosEntre(INICIO, AYER);
    if (AYER >= '2025-12-24') fechas.push('2025-12-24');      // culto de Nochebuena
    fechas.sort();
    for (const f of fechas) {
      const asistentes = s.adultos * az.decimal(0.42, 0.58);
      let factor = az.decimal(0.8, 1.2);
      if (f.slice(5, 7) === '12') factor *= 1.45;
      if (RESURRECCION.has(f)) factor *= 1.3;
      if (f === '2025-12-24') factor *= 0.9;
      const monto = redondear(asistentes * OFRENDA_POR_ADULTO[mon] * factor, mon, redondeo);
      s.acta++;
      const nota = f === '2025-12-24' ? 'Recuento de la ofrenda del culto de Nochebuena' : 'Recuento de la ofrenda del culto';
      manuales.push({ persona_id: null, sede: s.codigo, fecha: f, tipo: 'ofrenda', fondo: 'GENERAL', monto, moneda: mon,
        medio: 'efectivo', anonimo: true, referencia: `${nota} · acta ${String(s.acta).padStart(3, '0')}` });
      /* El segundo domingo de marzo, junio, septiembre y diciembre: ofrenda misionera. */
      if (['03', '06', '09', '12'].includes(f.slice(5, 7)) && f === domingoDelMes(mesDe(f), 2)) {
        s.acta++;
        manuales.push({ persona_id: null, sede: s.codigo, fecha: f, tipo: 'ofrenda', fondo: 'MISIONES',
          monto: redondear(monto * az.decimal(0.3, 0.5), mon, redondeo), moneda: mon, medio: 'efectivo', anonimo: true,
          referencia: `Ofrenda misionera del domingo · acta ${String(s.acta).padStart(3, '0')}` });
      }
    }
  }
}

/**
 * Cuándo y quién lo digitó. Antes de la salida en vivo de la sede, llegó
 * por migración. Después: el sobre del domingo se digita esa tarde o el
 * lunes; la transferencia, cuando aparece en el extracto. Si la sede no
 * tenía a nadie en tesorería, lo digitó el primero que llegó.
 * Devuelve null si todavía no se ha digitado (sale del extracto después de ayer).
 */
function registro(a, s, az, finanzas) {
  if (a.fecha < s.golive) {
    return { fuente: 'importado', estado: 'confirmado', registrado_por: null, dia: s.golive,
      registrado_en: iso(ms(s.golive, az.horaEntre('18:00', '21:00', 1), s.zona_horaria)) };
  }
  let r = EN_EL_CULTO.has(a.medio) || (a.medio === 'tarjeta' && s.pais !== 'CO')
    ? (az.probabilidad(0.6) ? a.fecha : sumarDias(a.fecha, 1))
    : habil(sumarDias(a.fecha, az.entero(1, 4)));
  let quien = titularEn(s.digitadores, r) ?? titularEn(s.tesoreros, r);
  if (!quien) {
    const inicio = primerInicioDesde([s.digitadores, s.tesoreros], r);
    if (!inicio) return null;
    r = habil(sumarDias(inicio, az.entero(0, 6)));
    quien = titularEn(s.digitadores, r) ?? titularEn(s.tesoreros, r);
  }
  if (!quien || r > AYER) return null;
  const hora = r === a.fecha ? az.horaEntre('13:00', '16:30', 1) : az.horaEntre('08:30', '17:30', 1);
  const reg = { fuente: 'manual', estado: 'registrado', registrado_por: quien.persona_id, dia: r,
    registrado_en: iso(ms(r, hora, s.zona_horaria)) };
  /* La tesorera confirma el martes siguiente; si ella misma digitó (o no había tesorera), confirma Finanzas. */
  const martes = martesDespues(r);
  if (martes <= (CONFIRMACION_ATRASADA[s.codigo] ?? ULTIMA_CONFIRMACION)) {
    const t = titularEn(s.tesoreros, martes);
    const conf = t && t.persona_id !== quien.persona_id ? t : deFinanzas(finanzas, martes);
    if (conf) { reg.confirma = conf.persona_id; reg.confirmaEl = martes; }
  }
  return reg;
}

/* ─────────────────────────────────────────────────────────────────────
   5 · EL POBLADOR
   ───────────────────────────────────────────────────────────────────── */

d.ejecutar({ archivo: 50, tema: 'aportes, construcción y legal' }, async (c, azar) => {
  if (await d.yaPoblado(c, `SELECT count(*) FROM aportes.aportes WHERE source_system = $1`, [SISTEMA],
    'aportes, construcción y legal')) return;
  const ensayo = process.env.ENSAYO === '1';
  const t0 = Date.now();
  const paso = (m) => console.log(`   · ${m} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  const conteo = {};

  await c.query('BEGIN');
  try {
    const ctx = await cargar(c);
    if (Object.keys(ctx.S).length < 10 || ctx.gente.length < 1000) {
      throw new Error('Falta la red: corra primero 00-red.js (36 sedes, sus personas y sus roles).');
    }
    paso(`${Object.keys(ctx.S).length} sedes con aportes · ${ctx.gente.length} personas leídas`);

    await poblarAportes(c, ctx, azar, conteo, paso);
    await poblarConstruccion(c, azar, conteo);
    paso('construcción');
    await poblarLegal(c, azar, conteo);
    paso('legal');
    await comprobar(c, conteo.cierres_que_no_cuadran);
    paso('comprobaciones en verde');

    const tablas = ['aportes.aportes', 'aportes.certificados', 'aportes.cierres_control', 'aportes.pasarela_transacciones',
      'aportes.pasarela_eventos', 'aportes.desembolsos', 'aportes.desembolso_items', 'org.obras', 'org.obras_hitos',
      'plataforma.asuntos_legales', 'plataforma.asuntos_legales_notas'];
    const r = await d.contarFilas(c, tablas);
    const { rows: [x] } = await c.query(
      `SELECT (SELECT count(*)::int FROM crm.linea_tiempo WHERE entidad_modulo = 'aportes') AS linea_tiempo_aportes,
              (SELECT count(*)::int FROM plataforma.notificaciones WHERE origen_modulo = 'aportes') AS avisos_aportes`);
    if (ensayo) {
      await c.query('ROLLBACK');
      console.log('   ENSAYO=1: se revirtió todo; la base queda como estaba.');
    } else {
      await c.query('COMMIT');
    }
    return { ...r, 'crm.linea_tiempo (aportes)': x.linea_tiempo_aportes, 'plataforma.notificaciones (aportes)': x.avisos_aportes, ...conteo };
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  }
});

/* ─────────────────────────────────────────────────────────────────────
   6 · APORTES
   ───────────────────────────────────────────────────────────────────── */

async function poblarAportes(c, ctx, azar, conteo, paso) {
  const { S, finanzas, fondo } = ctx;
  const azA = azar.derivar('aportes');

  /* 6.1 · Quién da y lo que dio */
  const dadores = construirDadores(ctx, azA);
  const manuales = [], enLinea = [];
  for (const g of dadores) aportesDeDador(g, azA.derivar(`meses:${g.p.source_id ?? g.p.id}`), S, manuales, enLinea);
  ofrendasDelCulto(S, azA, manuales);
  paso(`${dadores.length} personas que dan · ${manuales.length} aportes a mano · ${enLinea.length} por la pasarela`);

  /* 6.2 · Cuándo y quién los digitó; lo que todavía no aparece en el extracto no existe aún */
  const azR = azar.derivar('registro');
  const vivos = [];
  for (const a of manuales) {
    const s = S[a.sede];
    const reg = registro(a, s, azR, finanzas);
    if (!reg) continue;
    Object.assign(a, reg);
    if (!a.referencia) a.referencia = referenciaDe(azR, a, a.g, s);
    vivos.push(a);
  }
  vivos.sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0) || (x.sede < y.sede ? -1 : x.sede > y.sede ? 1 : 0));

  /* 6.3 · Lo que salió mal, como sale mal en la vida real */
  const azE = azar.derivar('errores');
  const anulaciones = [];      // { a, en, motivo, actor }
  const extras = [];           // registros nuevos (duplicados y correcciones)
  const correcto = (a) => a.fuente === 'manual' && !a.anonimo && a.fecha >= '2025-10-01' && a.fecha <= '2026-09-05';
  const anularEl = (a, dia) => titularEn(S[a.sede].tesoreros, dia) ?? deFinanzas(finanzas, dia);
  const reRegistrar = (base, cambios, dia) => {
    const s = S[base.sede];
    const quien = titularEn(s.digitadores, dia) ?? titularEn(s.tesoreros, dia);
    if (!quien) return null;
    const nuevo = { ...base, ...cambios, fuente: 'manual', estado: 'registrado', registrado_por: quien.persona_id, dia,
      registrado_en: iso(ms(dia, azE.horaEntre('09:00', '17:00', 1), s.zona_horaria)), confirma: null, confirmaEl: null };
    const martes = martesDespues(dia);
    if (martes <= (CONFIRMACION_ATRASADA[s.codigo] ?? ULTIMA_CONFIRMACION)) {
      const t = titularEn(s.tesoreros, martes);
      const conf = t && t.persona_id !== quien.persona_id ? t : deFinanzas(finanzas, martes);
      nuevo.confirma = conf?.persona_id ?? null; nuevo.confirmaEl = martes;
    }
    extras.push(nuevo);
    return nuevo;
  };
  const candidatos = azE.barajar(vivos.filter(correcto));
  const cuota = { duplicado: 11, monto: 11, devuelto: 6, persona: 5, fondo: 5 };
  const usados = new Set();
  for (const a of candidatos) {
    const s = S[a.sede];
    let tipo = null;
    if (cuota.devuelto && ['cheque', 'transferencia'].includes(a.medio) && a.monto >= MINIMO[a.moneda].diezmo) tipo = 'devuelto';
    else if (cuota.persona && a.g?.papel === 'principal' && a.tipo === 'diezmo') tipo = 'persona';
    else if (cuota.fondo && a.tipo === 'diezmo' && a.fondo === 'DIEZMOS') tipo = 'fondo';
    else if (cuota.monto && a.tipo === 'diezmo') tipo = 'monto';
    else if (cuota.duplicado) tipo = 'duplicado';
    if (!tipo || usados.has(a)) continue;
    const dia = minFecha(AYER, habil(sumarDias(a.dia, azE.entero(2, 9))));
    if (dia <= a.dia) continue;
    const actor = anularEl(a, dia);
    if (!actor || !(titularEn(s.digitadores, dia) ?? titularEn(s.tesoreros, dia))) continue;
    const en = iso(ms(dia, azE.horaEntre('09:00', '17:30', 1), s.zona_horaria));
    if (tipo === 'persona') {
      /* Quedó a nombre del cónyuge: se anula y se registra a nombre de quien dio. */
      const conyuge = ctx.gente.find(x => x.hogar_id && x.hogar_id === a.g.p.hogar_id && x.parentesco === 'CONYUGE'
        && x.id !== a.persona_id && x.sede === a.sede && edad(x.fnac) >= 18);
      if (!conyuge) continue;
      const titular = a.persona_id;
      a.persona_id = conyuge.id;
      anulaciones.push({ a, en, actor, motivo: 'Quedó a nombre de su cónyuge, pero el aporte es de quien lo entregó. Se registra de nuevo a nombre de quien dio.' });
      reRegistrar(a, { persona_id: titular }, dia);
    } else if (tipo === 'monto') {
      const bueno = a.monto;
      a.monto = bueno * 10;       // un cero de más
      anulaciones.push({ a, en, actor, motivo: `Monto mal digitado: el comprobante dice ${dinero(bueno, a.moneda)} y se registró ${dinero(a.monto, a.moneda)}. Se registra de nuevo con el monto correcto.` });
      reRegistrar(a, { monto: bueno }, dia);
    } else if (tipo === 'fondo') {
      a.fondo = 'DIEZMOS';
      anulaciones.push({ a, en, actor, motivo: 'Era el pacto de misiones y quedó como diezmo: se registra de nuevo en el fondo de misiones.' });
      reRegistrar(a, { tipo: 'pacto', fondo: 'MISIONES' }, dia);
    } else if (tipo === 'devuelto') {
      anulaciones.push({ a, en, actor, motivo: a.medio === 'cheque'
        ? 'El banco devolvió el cheque por fondos insuficientes.'
        : 'El banco reversó la transferencia a pedido del titular de la cuenta.' });
    } else {
      /* Se digitó dos veces el mismo comprobante: se anula el segundo registro. */
      const dup = reRegistrar(a, {}, minFecha(AYER, habil(sumarDias(a.dia, azE.entero(1, 3)))));
      if (!dup) continue;
      anulaciones.push({ a: dup, en: iso(Math.max(Date.parse(en), Date.parse(dup.registrado_en) + 3600000)), actor,
        motivo: `Digitado dos veces: el mismo comprobante (${a.referencia}) ya estaba registrado con fecha del ${fechaLarga(a.fecha)}.` });
    }
    cuota[tipo]--;
    usados.add(a);
    if (!Object.values(cuota).some(Boolean)) break;
  }

  /* Bucaramanga, agosto: la misma transferencia digitada dos veces y confirmada las dos. Nadie lo ha visto;
     el cierre de agosto lo delata (v_reconciliacion). */
  const dupBga = vivos.find(a => a.sede === 'BGA' && a.fuente === 'manual' && a.medio === 'transferencia' && a.tipo === 'diezmo'
    && a.fecha >= '2026-08-10' && a.fecha <= '2026-08-24' && !usados.has(a));
  let duplicadoSinDetectar = null;
  if (dupBga) {
    duplicadoSinDetectar = reRegistrar(dupBga, {}, habil(sumarDias(dupBga.dia, 2)));
    usados.add(dupBga);
  }

  /* Medellín, noviembre de 2025: un diezmo digitado con un cero de más que entra al certificado. */
  const certificables = new Set();
  const typo = vivos.find(a => a.sede === 'MED' && a.fuente === 'manual' && a.tipo === 'diezmo' && a.medio === 'transferencia'
    && a.fecha >= '2025-11-12' && a.fecha <= '2025-11-30' && !usados.has(a) && a.g?.perfil === 'constante'
    && ['CC', 'CE'].includes(a.g.p.tipo_documento) && a.g.p.documento && a.g.p.estado === 'activa'
    && vivos.every(o => o.persona_id !== a.persona_id || o.fecha < '2025-01-01' || o.fecha > '2025-12-31' || o.sede === 'MED'));
  if (typo) {
    typo.montoCorrecto = typo.monto;
    typo.monto = typo.monto * 10;
    usados.add(typo);
    certificables.add(typo.persona_id);
  }

  const todos = vivos.concat(extras);
  const azId = azar.derivar('ids');
  todos.forEach((a, i) => {
    a.id = azId.uuid();
    a.source_id = `aporte-${a.sede}-${String(i + 1).padStart(6, '0')}`;
  });
  const anuladoAntes = new Set(anulaciones.filter(x => !x.a.confirmaEl || x.en.slice(0, 10) < x.a.confirmaEl).map(x => x.a));

  /* 6.4 · A la base, con su autor: el digitador (o la migración, que no tiene sesión) */
  const grupos = new Map();
  for (const a of todos) {
    const clave = `${a.sede}|${a.registrado_por ?? 'migracion'}`;
    (grupos.get(clave) ?? grupos.set(clave, []).get(clave)).push(a);
  }
  for (const [clave, filas] of grupos) {
    const [sede, autor] = clave.split('|');
    const s = S[sede];
    await fijarAutor(c, { persona_id: autor === 'migracion' ? null : autor, sede_ids: [s.id], nivel_max: 3, alcance_global: false,
      motivo: autor === 'migracion' ? `Migración de aportes: libro de tesorería de ${s.nombre} (ola ${s.ola_migracion})` : 'Digitación de aportes' });
    await insertarLote(c, 'aportes.aportes', filas.map(a => ({
      id: a.id, sede_id: s.id, persona_id: a.persona_id, es_anonimo: a.anonimo, fondo_id: fondo[a.fondo], tipo: a.tipo,
      monto: a.monto, moneda: a.moneda, medio: a.medio, fecha: a.fecha, referencia: a.referencia,
      registrado_por: a.registrado_por, registrado_en: a.registrado_en, estado: a.estado, fuente: a.fuente,
      source_system: SISTEMA, source_id: a.source_id,
    })));
  }
  paso(`${todos.length} aportes registrados (${todos.filter(a => a.fuente === 'importado').length} por migración)`);

  /* 6.5 · La tesorera confirma los martes (manos distintas) */
  const porConfirmador = new Map();
  for (const a of todos) {
    if (a.fuente !== 'manual' || !a.confirma || anuladoAntes.has(a)) continue;
    const clave = `${a.sede}|${a.confirma}`;
    (porConfirmador.get(clave) ?? porConfirmador.set(clave, []).get(clave)).push(a.id);
  }
  for (const [clave, ids] of porConfirmador) {
    const [sede, quien] = clave.split('|');
    await fijarAutor(c, { persona_id: quien, sede_ids: [S[sede].id], nivel_max: 3, alcance_global: false,
      motivo: 'Confirmación de aportes contra el extracto' });
    await c.query(`UPDATE aportes.aportes SET estado = 'confirmado' WHERE id = ANY($1::uuid[])`, [ids]);
  }

  /* 6.6 · Anulaciones con motivo (un aporte no se corrige: se anula y se vuelve a registrar) */
  for (const x of anulaciones) {
    await fijarAutor(c, { persona_id: x.actor.persona_id, sede_ids: [S[x.a.sede].id], nivel_max: 3, alcance_global: false,
      motivo: 'Anulación de un aporte' });
    await c.query(`UPDATE aportes.aportes SET estado = 'anulado', anulado_en = $2, anulado_motivo = $3 WHERE id = $1`,
      [x.a.id, x.en, x.motivo]);
  }
  conteo.aportes_por_confirmar = todos.filter(a => a.fuente === 'manual' && !a.confirma && !anulaciones.some(x => x.a === a)).length;
  conteo.aportes_anulados = anulaciones.length;
  paso(`confirmados los martes · ${anulaciones.length} anulados con motivo`);

  /* 6.7 · Dar en línea: la pasarela */
  await poblarPasarela(c, ctx, azar.derivar('pasarela'), enLinea, conteo);
  paso(`pasarela: ${conteo.pagos_en_linea} intentos de pago`);

  /* 6.8 · Certificados de donación de 2025 */
  await poblarCertificados(c, ctx, azar.derivar('certificados'), todos, anulaciones, typo, certificables, conteo);
  paso(`${conteo.certificados_2025} certificados de 2025`);

  /* 6.9 · Cierres de control: el juez de la conciliación */
  conteo.cierres_que_no_cuadran = await poblarCierres(c, ctx, duplicadoSinDetectar);
  paso('cierres de control mensuales');
}

/* ─────────────────────────────────────────────────────────────────────
   7 · LA PASARELA (desde abril de 2026, solo en Colombia)
   Por las funciones de la base, en el orden en que llegan los avisos:
   registrar_aviso_pasarela → actualizar_estado_pasarela → confirmar_pago
   → cerrar_aviso_pasarela. Las funciones sellan con now(); después se
   devuelve cada sello a la fecha en que pasó.
   ───────────────────────────────────────────────────────────────────── */

async function poblarPasarela(c, ctx, az, enLinea, conteo) {
  const { S, gente, fondo, finanzas, personaPorId } = ctx;
  const usados = await d.usadosEnLaBase(c);
  /* Un correo que no es el de ninguna ficha (si lo fuera, la base emparejaría con otra persona). */
  const correoAjeno = (base) => {
    let correo = `${base}@example.org`;
    for (let i = 2; usados.correos.has(correo); i++) correo = `${base}${i}@example.org`;
    usados.correos.add(correo);
    return correo;
  };
  const trx = [];
  const nombreDe = (p) => [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ');
  const referencia = (sede, f) => `CR-${sede}-${f.replace(/-/g, '')}-${az.hex(6).toUpperCase()}`;
  const nuevo = (x) => {
    const t = { id: az.uuid(), referencia: referencia(x.sede, x.fecha), transaccion_id: az.uuid(), orden_id: String(az.entero(1400000000, 1499999999)), ...x };
    trx.push(t);
    return t;
  };
  const pagadorDe = (p) => ({ pagador_nombre: nombreDe(p), pagador_correo: p.email,
    pagador_documento: p.documento && az.probabilidad(0.7) ? p.documento : null, pagador_telefono: p.telefono });

  /* Quien se pasó a dar en línea, más las ofrendas sueltas de otros. */
  const sueltos = az.muestra(gente.filter(p => S[p.sede]?.pais === 'CO' && p.estado === 'activa' && p.email && edad(p.fnac) >= 18
    && edad(p.fnac) <= 60), 45);
  for (const p of sueltos) {
    const f = az.fechaEntre(EN_LINEA_DESDE, AYER);
    const s = S[p.sede];
    const tipo = az.ponderado({ ofrenda: 70, donacion: 18, proyecto: 12 });
    enLinea.push({ persona_id: p.id, sede: p.sede, fecha: f, tipo, moneda: s.moneda, medio: az.probabilidad(0.6) ? 'pse' : 'tarjeta',
      fondo: tipo === 'donacion' ? 'BENEFICENCIA' : tipo === 'proyecto' ? az.elegir(['ROCAKIDS', 'TMT', 'INSTITUTO']) : 'GENERAL',
      monto: redondear(az.decimal(20000, 180000), 'COP', 5000), g: null });
  }
  enLinea.sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0) || (x.persona_id < y.persona_id ? -1 : 1));

  const MOTIVOS = ['Fondos insuficientes', 'Transacción rechazada por la entidad financiera', 'Tarjeta vencida o restringida',
    'El banco no autorizó el débito'];
  for (const a of enLinea) {
    const p = personaPorId.get(a.persona_id);
    const s = S[a.sede];
    const hora = az.horaEntre('07:00', '21:30', 1);
    const creada = ms(a.fecha, hora, s.zona_horaria);
    const base = { sede: a.sede, persona: p, tipo: a.tipo, fondo: a.fondo, monto: a.monto, medio: a.medio, fecha: a.fecha,
      ...pagadorDe(p) };
    /* Lo de anoche todavía no tiene respuesta del banco. */
    if (a.fecha === AYER && a.medio === 'pse' && az.probabilidad(0.5)) {
      nuevo({ ...base, estado: 'iniciada', creada: iso(creada) });
      continue;
    }
    const suerte = az.ponderado({ aprobada: 90, rechazada: 6, expirada: a.medio === 'pse' ? 4 : 0 });
    if (suerte === 'rechazada') {
      nuevo({ ...base, estado: 'rechazada', motivo: az.elegir(MOTIVOS), creada: iso(creada), conf: iso(creada + az.entero(40, 140) * 1000) });
      const reintento = creada + az.entero(8, 50) * 60000;
      nuevo({ ...base, estado: 'aprobada', creada: iso(reintento), conf: iso(reintento + az.entero(60, 240) * 1000) });
    } else if (suerte === 'expirada') {
      nuevo({ ...base, estado: 'expirada', creada: iso(creada), conf: iso(creada + 31 * 60000) });
      if (az.probabilidad(0.7) && sumarDias(a.fecha, 1) <= AYER) {
        const otroDia = ms(sumarDias(a.fecha, 1), az.horaEntre('07:00', '20:00', 1), s.zona_horaria);
        nuevo({ ...base, fecha: sumarDias(a.fecha, 1), estado: 'aprobada', creada: iso(otroDia), conf: iso(otroDia + az.entero(180, 720) * 1000) });
      }
    } else {
      const espera = a.medio === 'pse' ? az.entero(180, 720) : az.entero(50, 200);
      nuevo({ ...base, estado: 'aprobada', creada: iso(creada), conf: iso(creada + espera * 1000) });
    }
  }

  /* Pagos sin dueño: el correo que escribieron no es el de su ficha y no dejaron documento. */
  const coSedes = Object.values(S).filter(s => s.pais === 'CO').map(s => s.codigo);
  const recienLlegados = gente.filter(p => coSedes.includes(p.sede) && p.nivel === 'visitante' && p.estado === 'activa' && edad(p.fnac) >= 18);
  const sinDueno = [];
  for (const [i, p] of az.muestra(recienLlegados, 3).entries()) {
    const f = az.fechaEntre('2026-09-08', '2026-09-19');
    const creada = ms(f, az.horaEntre('08:00', '20:00', 1), S[p.sede].zona_horaria);
    sinDueno.push(nuevo({ sede: p.sede, persona: null, tipo: 'ofrenda', fondo: 'GENERAL', monto: redondear(az.decimal(20000, 120000), 'COP', 10000),
      medio: az.probabilidad(0.5) ? 'pse' : 'tarjeta', fecha: f, estado: 'aprobada', creada: iso(creada), conf: iso(creada + 200000),
      pagador_nombre: nombreDe(p), pagador_correo: correoAjeno(`${d.slug(p.primer_nombre)}.${d.slug(p.primer_apellido)}.${70 + i}`),
      pagador_documento: null, pagador_telefono: null }));
  }
  {
    /* Alguien que todavía no tiene ficha: dio en línea desde el sitio sin haberse registrado. */
    const n = d.nombrePara(az, 'F', 1991);
    const apellido = d.apellidoAzar(az);
    const nombre = [n.primer_nombre, n.segundo_nombre, apellido, d.apellidoAzar(az)].filter(Boolean).join(' ');
    const f = '2026-09-13';
    const creada = ms(f, '19:42', 'America/Bogota');
    sinDueno.push(nuevo({ sede: 'BOG-NORTE', persona: null, tipo: 'ofrenda', fondo: 'GENERAL', monto: 50000, medio: 'pse', fecha: f,
      estado: 'aprobada', creada: iso(creada), conf: iso(creada + 310000), pagador_nombre: nombre,
      pagador_correo: correoAjeno(`${d.slug(n.primer_nombre)}.${d.slug(apellido)}.ofrenda`), pagador_documento: null,
      pagador_telefono: null }));
  }
  /* Uno que la tesorera emparejó a mano en junio: escribió el correo del trabajo. */
  const aMano = (() => {
    const candidatos = S.MED ? gente.filter(x => x.sede === 'MED' && x.nivel === 'miembro' && x.estado === 'activa' && x.email
      && edad(x.fnac) >= 25 && edad(x.fnac) <= 50) : [];
    if (!candidatos.length) return null;
    const p = az.elegir(candidatos);
    const f = '2026-06-14';
    const creada = ms(f, '10:18', 'America/Bogota');
    return { persona: p, t: nuevo({ sede: 'MED', persona: null, tipo: 'diezmo', fondo: 'DIEZMOS', monto: redondear(S.MED.mediana * 0.8, 'COP', 10000),
      medio: 'pse', fecha: f, estado: 'aprobada', creada: iso(creada), conf: iso(creada + 420000), pagador_nombre: nombreDe(p),
      pagador_correo: correoAjeno(`${d.slug(p.primer_nombre)}.${d.slug(p.primer_apellido)}.trabajo`), pagador_documento: null,
      pagador_telefono: null }), dia: '2026-06-16' };
  })();

  /* 1 · Los intentos nacen «iniciados» (nuestra referencia viaja a la pasarela). */
  await fijarAutor(c, { persona_id: null, sede_ids: coSedes.map(x => S[x].id), nivel_max: 3, alcance_global: false,
    motivo: 'Aviso de la pasarela de pagos' });
  await insertarLote(c, 'aportes.pasarela_transacciones', trx.map(t => ({
    id: t.id, pasarela: 'payu', referencia: t.referencia, transaccion_id: null, orden_id: t.orden_id, sede_id: S[t.sede].id,
    persona_id: null, pagador_nombre: t.pagador_nombre, pagador_correo: t.pagador_correo, pagador_documento: t.pagador_documento,
    pagador_telefono: t.pagador_telefono, tipo: t.tipo, fondo_id: fondo[t.fondo], monto: t.monto, moneda: 'COP', medio: t.medio,
    estado: 'iniciada', creada_en: t.creada, actualizada_en: t.creada,
  })));

  /* 2 · Los avisos de la pasarela, como llegan: con su cuerpo crudo, su firma y su huella. */
  const ESTADO_POL = { aprobada: ['4', 'APPROVED'], rechazada: ['6', 'DECLINED'], expirada: ['5', 'EXPIRED'] };
  const avisos = [];
  for (const t of trx.filter(x => x.estado !== 'iniciada')) {
    const [pol, msg] = ESTADO_POL[t.estado];
    const cuerpo = { merchant_id: '508029', state_pol: pol, response_message_pol: msg, reference_sale: t.referencia,
      reference_pol: t.orden_id, transaction_id: t.transaccion_id, value: t.monto.toFixed(2), currency: 'COP',
      payment_method_type: t.medio === 'pse' ? 'PSE' : 'CREDIT_CARD', email_buyer: t.pagador_correo,
      transaction_date: new Date(Date.parse(t.conf) - 5 * 3600000).toISOString().slice(0, 19).replace('T', ' ') };
    cuerpo.sign = crypto.createHash('md5').update(`demostracion~508029~${t.referencia}~${cuerpo.value}~COP~${pol}`).digest('hex');
    avisos.push({ t, cuerpo, valida: true, recibido: Date.parse(t.conf) + az.entero(2, 25) * 1000 });
  }
  /* Uno con firma falsa: alguien quiso marcar como pagada una referencia real con otro valor. */
  const victima = trx.find(t => t.estado === 'aprobada' && t.fecha >= '2026-08-01');
  if (victima) {
    const cuerpo = { merchant_id: '508029', state_pol: '4', response_message_pol: 'APPROVED', reference_sale: victima.referencia,
      transaction_id: victima.transaccion_id, value: (victima.monto * 20).toFixed(2), currency: 'COP', sign: az.hex(32) };
    avisos.push({ t: victima, cuerpo, valida: false, recibido: Date.parse(victima.conf) + 86400000 * 2 + 3600000,
      error: 'Firma inválida: el aviso se guarda pero no mueve dinero' });
  }
  /* Y uno de una referencia que no existe (una prueba del comercio que llegó a producción). */
  const huerfano = { merchant_id: '508029', state_pol: '4', response_message_pol: 'APPROVED', reference_sale: 'CR-PRUEBA-20260704-000000',
    transaction_id: az.uuid(), value: '1000.00', currency: 'COP' };
  huerfano.sign = crypto.createHash('md5').update(`demostracion~508029~${huerfano.reference_sale}~1000.00~COP~4`).digest('hex');
  avisos.push({ t: null, cuerpo: huerfano, valida: true, recibido: ms('2026-07-04', '11:05', 'America/Bogota'),
    error: 'No existe una transacción con esa referencia' });
  avisos.sort((x, y) => x.recibido - y.recibido);

  const huella = (cu) => crypto.createHash('sha256').update(JSON.stringify(cu)).digest('hex');
  const { rows: ids } = await c.query(
    `SELECT x.ord, aportes.registrar_aviso_pasarela('payu', x.ref, x.trx, x.est, x.cuerpo::jsonb, x.firma, x.valida, x.huella) AS id
       FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::boolean[], $7::text[])
            WITH ORDINALITY AS x(ref, trx, est, cuerpo, firma, valida, huella, ord)
      ORDER BY x.ord`,
    [avisos.map(v => v.cuerpo.reference_sale), avisos.map(v => v.cuerpo.transaction_id), avisos.map(v => v.cuerpo.state_pol),
      avisos.map(v => JSON.stringify(v.cuerpo)), avisos.map(v => v.cuerpo.sign ?? null), avisos.map(v => v.valida),
      avisos.map(v => huella(v.cuerpo))]);
  ids.forEach((r, i) => { avisos[i].id = r.id; });

  /* 3 · Cada aviso válido pone al día su transacción (la función sella con now(): se devuelve a su hora). */
  const terminales = trx.filter(t => t.estado !== 'iniciada');
  await c.query(
    `SELECT aportes.actualizar_estado_pasarela(x.ref, x.est::aportes.estado_pasarela, x.trx, x.motivo)
       FROM unnest($1::text[], $2::text[], $3::text[], $4::text[]) AS x(ref, est, trx, motivo)`,
    [terminales.map(t => t.referencia), terminales.map(t => t.estado), terminales.map(t => t.transaccion_id),
      terminales.map(t => t.motivo ?? null)]);
  await c.query(
    `UPDATE aportes.pasarela_transacciones t SET confirmada_en = x.conf::timestamptz, actualizada_en = x.conf::timestamptz
       FROM unnest($1::uuid[], $2::text[]) AS x(id, conf) WHERE t.id = x.id`,
    [terminales.map(t => t.id), terminales.map(t => t.conf)]);

  /* 4 · Lo aprobado se contabiliza, con la única función que puede hacerlo (empareja por documento o correo). */
  const aprobadas = terminales.filter(t => t.estado === 'aprobada');
  await c.query(`SELECT aportes.confirmar_pago(x) FROM unnest($1::uuid[]) WITH ORDINALITY AS u(x, ord) ORDER BY ord`, [aprobadas.map(t => t.id)]);

  /* 5 · La tesorera de Medellín emparejó a mano el pago de junio (lo mismo que hace la API). */
  const tesMed = aMano ? titularEn(S.MED.tesoreros, aMano.dia) : null;
  if (tesMed) {
    await fijarAutor(c, { persona_id: tesMed.persona_id, sede_ids: [S.MED.id], nivel_max: 3, alcance_global: false,
      motivo: 'Emparejar un pago en línea con su ficha' });
    await c.query(`UPDATE aportes.pasarela_transacciones SET persona_id = $2, actualizada_en = $3 WHERE id = $1`,
      [aMano.t.id, aMano.persona.id, iso(ms(aMano.dia, '09:12', 'America/Bogota'))]);
    await c.query(`SELECT aportes.confirmar_pago($1)`, [aMano.t.id]);
    await c.query(`UPDATE aportes.aportes a SET registrado_en = $2 FROM aportes.pasarela_transacciones t
                    WHERE t.id = $1 AND a.id = t.aporte_id`, [aMano.t.id, iso(ms(aMano.dia, '09:13', 'America/Bogota'))]);
    await fijarAutor(c, { persona_id: null, sede_ids: coSedes.map(x => S[x].id), nivel_max: 3, alcance_global: false,
      motivo: 'Aviso de la pasarela de pagos' });
  }

  /* 6 · Cada aviso queda cerrado, con su error si lo tuvo; y a su hora. */
  await c.query(
    `SELECT aportes.cerrar_aviso_pasarela(x.id, x.err) FROM unnest($1::bigint[], $2::text[]) AS x(id, err)`,
    [avisos.map(v => v.id), avisos.map(v => v.error ?? null)]);
  await c.query(
    `UPDATE aportes.pasarela_eventos e SET recibido_en = x.rec::timestamptz, procesado_en = x.rec::timestamptz + interval '400 milliseconds'
       FROM unnest($1::bigint[], $2::text[]) AS x(id, rec) WHERE e.id = x.id`,
    [avisos.map(v => v.id), avisos.map(v => iso(v.recibido))]);

  /* 7 · El aporte que nació de la pasarela quedó registrado cuando llegó la confirmación, no hoy. */
  await c.query(
    `UPDATE aportes.aportes a SET registrado_en = t.confirmada_en + interval '1 second'
       FROM aportes.pasarela_transacciones t
      WHERE t.aporte_id = a.id AND t.referencia LIKE 'CR-%' AND t.id IS DISTINCT FROM $1::uuid`, [aMano?.t.id ?? null]);

  /* 8 · Los correos de confirmación salieron en su momento. */
  await c.query(
    `UPDATE plataforma.notificaciones n
        SET estado = 'enviada', intentos = 1, creada_en = a.registrado_en, tomada_en = a.registrado_en + interval '35 seconds',
            enviada_en = a.registrado_en + interval '48 seconds', ultimo_error = NULL, proximo_intento = NULL
       FROM aportes.aportes a
      WHERE n.origen_modulo = 'aportes' AND n.plantilla = 'Confirmacion_aporte' AND n.origen_id = a.id::text
        AND a.fuente = 'pasarela' AND n.estado = 'pendiente'`);

  /* 9 · Los desembolsos: cada martes la pasarela consigna lo aprobado de la semana anterior, menos su comisión. */
  const { rows: ok } = await c.query(
    `SELECT id, monto::numeric AS monto, to_char(confirmada_en, 'YYYY-MM-DD') AS dia FROM aportes.pasarela_transacciones
      WHERE estado = 'aprobada' AND referencia LIKE 'CR-%' ORDER BY confirmada_en, id`);
  const semanas = new Map();
  for (const t of ok) {
    const pago = sumarDias(lunesDe(t.dia), 8);          // el martes de la semana siguiente
    if (pago > AYER) continue;
    (semanas.get(pago) ?? semanas.set(pago, []).get(pago)).push(t);
  }
  const desembolsos = [], items = [];
  for (const [pago, lista] of [...semanas].sort()) {
    const id = az.uuid();
    let bruto = 0, comision = 0;
    for (const t of lista) {
      const m = Number(t.monto);
      const cm = Math.round(m * 0.0329 + 300);
      bruto += m; comision += cm;
      items.push({ desembolso_id: id, transaccion_id: t.id, monto_bruto: m, comision: cm });
    }
    const iva = Math.round(comision * 0.19);
    const ultimo = pago === [...semanas.keys()].sort().pop();
    const concilia = deFinanzas(finanzas, sumarDias(pago, 1));
    desembolsos.push({ id, pasarela: 'payu', fecha: pago, monto_bruto: bruto, comision, iva_comision: iva, retenciones: 0,
      monto_neto: bruto - comision - iva, moneda: 'COP', referencia_banco: `Abono PayU ${pago.replace(/-/g, '')}-${az.entero(100, 999)}`,
      conciliado_en: ultimo ? null : iso(ms(sumarDias(pago, 1), az.horaEntre('09:00', '12:00', 1), 'America/Bogota')),
      conciliado_por: ultimo ? null : concilia?.persona_id ?? null });
  }
  await insertarLote(c, 'aportes.desembolsos', desembolsos);
  await insertarLote(c, 'aportes.desembolso_items', items);

  conteo.pagos_en_linea = trx.length;
  conteo.pagos_sin_dueno = sinDueno.length;
  conteo.desembolsos = desembolsos.length;
}

/* ─────────────────────────────────────────────────────────────────────
   8 · CERTIFICADOS DE DONACIÓN DE 2025
   Los expide la tesorera de cada sede de Colombia con
   aportes.expedir_certificado (el total lo calcula la base). La mayoría,
   en febrero y marzo; el resto a pedido, cuando se acerca la declaración
   de renta. Numeración CERT-2025-SEDE-NNNN, como la API.
   ───────────────────────────────────────────────────────────────────── */

async function poblarCertificados(c, ctx, az, todos, anulaciones, typo, certificables, conteo) {
  const { S, finanzas, personaPorId } = ctx;
  const anulados = new Set(anulaciones.map(x => x.a));
  /* Aportes de 2025 por persona y sede (lo que un certificado puede recoger), en todas las sedes. */
  const por = new Map();
  for (const a of todos) {
    if (!a.persona_id || a.fecha < '2025-01-01' || a.fecha > '2025-12-31' || anulados.has(a)) continue;
    const m = por.get(a.persona_id) ?? por.set(a.persona_id, new Map()).get(a.persona_id);
    const x = m.get(a.sede) ?? m.set(a.sede, { n: 0, desde: a.fecha, hasta: a.fecha }).get(a.sede);
    x.n++; x.desde = minFecha(x.desde, a.fecha); x.hasta = maxFecha(x.hasta, a.fecha);
  }
  const pedidos = [];
  for (const [pid, sedes] of por) {
    const p = personaPorId.get(pid);
    if (!p || !p.documento || !['CC', 'CE', 'PPT', 'PEP', 'PA'].includes(p.tipo_documento)) continue;
    if (!['activa', 'inactiva'].includes(p.estado)) continue;
    const enColombia = [...sedes.entries()].filter(([sede]) => S[sede].pais === 'CO');
    const n = enColombia.reduce((t, [, x]) => t + x.n, 0);
    if (n < 3) continue;
    const azP = az.derivar(`pide:${p.source_id ?? p.id}`);
    const pide = certificables.has(pid) || azP.probabilidad(n >= 10 ? 0.45 : n >= 5 ? 0.25 : 0.08);
    if (!pide) continue;
    /* Quien congregó en dos sedes en 2025 recibe uno por sede, por el tramo de cada una: cada sede certifica
       lo que recibió (la base rechaza un certificado que mezcle sedes o monedas). */
    const unaSola = sedes.size === 1;
    for (const [sede, x] of enColombia.sort(([a], [b]) => (a < b ? -1 : 1))) {
      const desde = unaSola ? '2025-01-01' : x.desde;
      const hasta = unaSola ? '2025-12-31' : x.hasta;
      const choca = [...sedes.entries()].some(([otra, y]) => otra !== sede && y.desde <= hasta && y.hasta >= desde);
      if (!choca) pedidos.push({ persona_id: pid, sede, p, desde, hasta });
    }
  }

  /* Cuándo: en lote al abrir el año (si la sede ya tenía tesorera), o a pedido después. */
  const eventos = [];
  for (const x of pedidos) {
    const s = S[x.sede];
    const azX = az.derivar(`cuando:${x.persona_id}:${x.sede}`);
    const primera = (s.tesoreros.find(t => !t.hasta || t.hasta >= '2026-02-02')?.desde) ?? null;
    if (!primera) continue;
    const abre = habil(maxFecha('2026-02-02', sumarDias(primera, 2)));
    const aPedido = maxFecha(abre, '2026-04-01');
    let dia = azX.probabilidad(0.7) || aPedido > '2026-09-18'
      ? habil(sumarDias(abre, azX.entero(0, 25)))
      : habil(azX.fechaEntre(aPedido, '2026-09-18'));
    if (typo && x.persona_id === typo.persona_id) dia = '2026-02-17';
    if (dia > AYER) continue;
    const tes = titularEn(s.tesoreros, dia);
    if (!tes) continue;
    eventos.push({ ...x, dia, hora: azX.horaEntre('08:30', '17:00', 1), tes });
  }
  /* Medellín: el certificado con el monto mal digitado se anula y se vuelve a expedir. */
  let reexpedicion = null;
  if (typo && eventos.some(e => e.persona_id === typo.persona_id && e.sede === 'MED')) {
    const tes = titularEn(S.MED.tesoreros, '2026-02-24');
    reexpedicion = { persona_id: typo.persona_id, sede: 'MED', dia: '2026-02-24', hora: '09:40', tes, reexpide: true,
      desde: '2025-01-01', hasta: '2025-12-31' };
    eventos.push(reexpedicion);
  }
  eventos.sort((x, y) => (x.dia + x.hora < y.dia + y.hora ? -1 : x.dia + x.hora > y.dia + y.hora ? 1 : 0)
    || (x.persona_id < y.persona_id ? -1 : 1));
  const numero = {};
  for (const e of eventos) {
    numero[e.sede] = (numero[e.sede] ?? 0) + 1;
    e.numero = `CERT-2025-${e.sede}-${String(numero[e.sede]).padStart(4, '0')}`;
    e.en = iso(ms(e.dia, e.hora, S[e.sede].zona_horaria));
  }

  const expedir = async (e) => {
    const s = S[e.sede];
    await fijarAutor(c, { persona_id: e.tes.persona_id, sede_ids: [s.id], nivel_max: 3, alcance_global: false,
      motivo: 'Certificado de donación del año 2025' });
    const { rows: [r] } = await c.query(`SELECT aportes.expedir_certificado($1, $2::date, $3::date, $4, $5) AS id`,
      [e.persona_id, e.desde, e.hasta, e.numero, e.tes.persona_id]);
    e.id = r.id;
    await c.query(`UPDATE aportes.certificados SET url_pdf = $2, expedido_en = $3 WHERE id = $1`,
      [r.id, `/api/v1/aportes/certificados/${r.id}/documento`, e.en]);
  };
  for (const e of eventos) if (!e.reexpide) await expedir(e);

  if (reexpedicion) {
    const primero = eventos.find(e => e.persona_id === typo.persona_id && !e.reexpide);
    const s = S.MED;
    const tes = titularEn(s.tesoreros, '2026-02-23');
    /* 1 · Se anula el certificado, con motivo (la función libera los aportes). */
    await fijarAutor(c, { persona_id: tes.persona_id, sede_ids: [s.id], nivel_max: 3, alcance_global: false,
      motivo: 'Anulación de un certificado de donación' });
    const motivo = `El diezmo del ${fechaLarga(typo.fecha)} quedó digitado por ${dinero(typo.monto, 'COP')} y el comprobante dice ${dinero(typo.montoCorrecto, 'COP')}. Se anula para corregirlo y expedirlo de nuevo.`;
    await c.query(`SELECT aportes.anular_certificado($1, $2, $3)`, [primero.id, motivo, tes.persona_id]);
    await c.query(`UPDATE aportes.certificados SET anulado_en = $2 WHERE id = $1`, [primero.id, iso(ms('2026-02-23', '10:15', s.zona_horaria))]);
    /* 2 · Se anula el aporte mal digitado y se registra el correcto (lo confirma Finanzas: la tesorera lo digitó). */
    await c.query(`UPDATE aportes.aportes SET estado = 'anulado', anulado_en = $2, anulado_motivo = $3 WHERE id = $1`,
      [typo.id, iso(ms('2026-02-23', '10:20', s.zona_horaria)),
        `Monto mal digitado: el comprobante dice ${dinero(typo.montoCorrecto, 'COP')} y se registró ${dinero(typo.monto, 'COP')}. Se registra de nuevo con el monto correcto.`]);
    conteo.aportes_anulados = (conteo.aportes_anulados ?? 0) + 1;
    const nuevoId = az.uuid();
    await insertarLote(c, 'aportes.aportes', [{
      id: nuevoId, sede_id: s.id, persona_id: typo.persona_id, es_anonimo: false, fondo_id: ctx.fondo[typo.fondo], tipo: typo.tipo,
      monto: typo.montoCorrecto, moneda: 'COP', medio: typo.medio, fecha: typo.fecha, referencia: typo.referencia,
      registrado_por: tes.persona_id, registrado_en: iso(ms('2026-02-23', '10:25', s.zona_horaria)), estado: 'registrado',
      fuente: 'manual', source_system: SISTEMA, source_id: `aporte-MED-correccion-${typo.source_id}` }]);
    const fin = deFinanzas(finanzas, '2026-02-23');
    await fijarAutor(c, { persona_id: fin.persona_id, sede_ids: [s.id], nivel_max: 3, alcance_global: false,
      motivo: 'Confirmación de aportes contra el extracto' });
    await c.query(`UPDATE aportes.aportes SET estado = 'confirmado' WHERE id = $1`, [nuevoId]);
    /* 3 · Se expide de nuevo, con número nuevo. */
    await expedir(reexpedicion);
  }

  /* El correo del certificado salió el día que se expidió. */
  const conId = eventos.filter(e => e.id);
  await c.query(
    `UPDATE plataforma.notificaciones n
        SET estado = 'enviada', intentos = 1, creada_en = x.en::timestamptz, tomada_en = x.en::timestamptz + interval '40 seconds',
            enviada_en = x.en::timestamptz + interval '52 seconds', ultimo_error = NULL, proximo_intento = NULL
       FROM unnest($1::text[], $2::text[]) AS x(id, en)
      WHERE n.origen_modulo = 'aportes' AND n.plantilla = 'Certificado_expedido' AND n.origen_id = x.id AND n.estado = 'pendiente'`,
    [conId.map(e => e.id), conId.map(e => e.en)]);
  conteo.certificados_2025 = conId.length;
  conteo.certificados_anulados = reexpedicion ? 1 : 0;
}

/* ─────────────────────────────────────────────────────────────────────
   9 · CIERRES DE CONTROL
   La suma oficial de cada mes contra la que se concilia. Los meses de
   antes de la salida en vivo llegaron con la migración (y cuadran al
   peso: esa era la compuerta). Los demás los carga el Equipo de Finanzas
   la primera semana del mes siguiente. Dos no cuadran, y tienen por qué.
   ───────────────────────────────────────────────────────────────────── */

async function poblarCierres(c, ctx, duplicado) {
  const { S, finanzas } = ctx;
  const { rows: sumas } = await c.query(
    `SELECT s.codigo, to_char(a.fecha, 'YYYY-MM') AS mes, a.moneda, sum(a.monto)::numeric AS total
       FROM aportes.aportes a JOIN org.sedes s ON s.id = a.sede_id
      WHERE a.anulado_en IS NULL AND a.fecha <= $1::date
      GROUP BY 1, 2, 3 ORDER BY 1, 2`, [finDeMes(ULTIMO_MES_CERRADO)]);
  const filas = [];
  let descuadres = 0;
  for (const x of sumas) {
    const s = S[x.codigo];
    if (!s) continue;
    let total = Number(x.total);
    /* Cali, julio: un sobre del 26 de julio que nunca se digitó (la contabilidad sí lo tiene). */
    if (x.codigo === 'CALI' && x.mes === '2026-07') { total += 250000; descuadres++; }
    /* Bucaramanga, agosto: el sistema tiene la misma transferencia dos veces; la contabilidad, una. */
    if (duplicado && x.codigo === 'BGA' && x.mes === '2026-08') { total -= Number(duplicado.monto); descuadres++; }
    const migrado = x.mes < mesDe(s.golive);
    const carga = migrado ? s.golive : habil(`${mesDe(sumarMeses(`${x.mes}-01`, 1))}-07`);
    const firma = migrado ? (titularEn(s.tesoreros, s.golive) ?? liderFinanzas(finanzas, s.golive)) : liderFinanzas(finanzas, carga);
    filas.push({ sede_id: s.id, anio: Number(x.mes.slice(0, 4)), mes: Number(x.mes.slice(5)), moneda: x.moneda,
      total_oficial: total.toFixed(2),
      fuente: migrado ? 'Migración: libro de tesorería de la sede, conciliado con la contabilidad'
        : x.mes === mesDe(s.golive) ? 'Cierre contable del mes de la salida en vivo (migración y sistema)'
          : 'Cierre contable mensual del Equipo de Finanzas',
      certificado_por: firma?.persona_id ?? null,
      cargado_en: iso(ms(carga, migrado ? '18:30' : '16:00', s.zona_horaria)) });
  }
  await fijarAutor(c, { persona_id: liderFinanzas(finanzas, '2026-09-08')?.persona_id ?? null, sede_ids: [], nivel_max: 3,
    alcance_global: true, motivo: 'Cierres de control de aportes' });
  await insertarLote(c, 'aportes.cierres_control', filas);
  return descuadres;
}

/* ─────────────────────────────────────────────────────────────────────
   10 · CONSTRUCCIÓN
   Diez obras en las seis sedes con el módulo encendido. El avance y lo
   ejecutado NO se escriben: salen de los hitos (org.tg_obra_desde_hitos).
   [fecha, qué se logró, avance total de la obra, gasto del hito]
   ───────────────────────────────────────────────────────────────────── */

const OBRAS = [
  { sede: 'BOG-CHICO', nombre: 'Ampliación del auditorio principal', tipo: 'ampliacion', presupuesto: 2480000000,
    registrada: '2025-10-15', inicia: '2025-11-04', termina: '2026-12-18', final: 'en_curso',
    descripcion: 'Cuatrocientas sillas más en el ala norte, cubierta termoacústica y un segundo acceso por la calle lateral. '
      + 'La supervisa el Equipo de Construcción de la central; la ejecuta un contratista con póliza de cumplimiento.',
    hitos: [
      ['2025-11-04', 'Licencia de construcción aprobada por la curaduría urbana', 4, 18600000],
      ['2025-11-28', 'Demolición del muro norte y retiro de escombros', 9, 64300000],
      ['2026-01-30', 'Pilotaje y cimentación del ala norte', 21, 318700000],
      ['2026-03-20', 'Estructura metálica de la ampliación montada', 36, 421500000],
      ['2026-05-08', 'Cubierta termoacústica instalada', 45, 208900000],
      ['2026-06-26', 'Mampostería, pañetes y redes eléctricas del ala norte', 53, 176400000],
      ['2026-08-14', 'Ductos del aire acondicionado y tablero eléctrico nuevo', 58, 142800000],
      ['2026-09-11', 'Piso en concreto pulido y graderías del ala norte', 63, 118600000],
    ] },
  { sede: 'BOG-CHICO', nombre: 'Cambio de cubierta del salón de RocaKids', tipo: 'mantenimiento_mayor', presupuesto: 86000000,
    registrada: '2026-02-10', inicia: '2026-03-02', termina: '2026-04-30', final: 'terminada', terminada: '2026-04-24',
    descripcion: 'La cubierta vieja goteaba sobre dos salas de RocaKids. Se cambió en semanas sin servicio de niños entre semana.',
    hitos: [
      ['2026-03-02', 'Retiro de la cubierta vieja con gestor de residuos autorizado', 25, 12400000],
      ['2026-03-27', 'Estructura de soporte reforzada y canales nuevos', 55, 31800000],
      ['2026-04-17', 'Teja termoacústica instalada y sellada', 90, 29600000],
      ['2026-04-24', 'Pintura, limpieza final y entrega de la obra al equipo de RocaKids', 100, 7100000],
    ] },
  { sede: 'BOG-SUR', nombre: 'Segunda planta de salones para grupos y RocaKids', tipo: 'construccion', presupuesto: 620000000,
    registrada: '2025-09-29', inicia: '2025-10-20', termina: '2026-07-31', final: 'en_curso',
    descripcion: 'Seis salones nuevos sobre el primer piso. Va atrasada: lluvias en abril y un ajuste estructural que pidió la '
      + 'curaduría subieron el acero; el contratista pide sesenta días más.',
    hitos: [
      ['2025-10-20', 'Licencia de construcción en la modalidad de ampliación', 3, 9800000],
      ['2025-11-21', 'Reforzamiento de las columnas del primer piso', 14, 86500000],
      ['2026-01-23', 'Placa de entrepiso fundida', 27, 132400000],
      ['2026-03-13', 'Columnas y vigas de la segunda planta', 38, 98700000],
      ['2026-04-24', 'Tres semanas detenida por las lluvias; se reforzó la impermeabilización', 41, 23600000],
      ['2026-06-05', 'Más acero por el ajuste estructural que pidió la curaduría', 47, 71300000],
      ['2026-07-24', 'Cubierta y mampostería de la segunda planta', 56, 58400000],
      ['2026-09-04', 'Instalaciones eléctricas y sanitarias en curso; el contratista pide sesenta días más', 61, 36900000],
    ] },
  { sede: 'BOG-SUR', nombre: 'Compra de la casa vecina para ampliar el parqueadero', tipo: 'compra_inmueble', presupuesto: 480000000,
    registrada: '2026-01-26', inicia: '2026-02-16', termina: '2026-06-30', final: 'cancelada', cancelada: '2026-03-06',
    descripcion: 'Se cancela: el propietario desistió de vender antes de firmar la promesa. La sede no alcanzó a desembolsar nada.',
    hitos: [] },
  { sede: 'MED', nombre: 'Compra del lote contiguo para parqueadero', tipo: 'compra_inmueble', presupuesto: 1150000000,
    registrada: '2026-01-28', inicia: '2026-02-09', termina: '2026-12-15', final: 'en_curso',
    descripcion: 'Lote de 640 metros cuadrados al costado oriental. La escritura se firma en diciembre contra el último pago.',
    hitos: [
      ['2026-02-09', 'Avalúo comercial del lote por una lonja inscrita', 5, 3800000],
      ['2026-02-27', 'Estudio de títulos: la tradición de veinte años está limpia', 12, 6500000],
      ['2026-03-20', 'Promesa de compraventa firmada y arras del 30 %', 40, 345000000],
      ['2026-07-15', 'Segundo pago pactado en la promesa', 55, 172500000],
    ] },
  { sede: 'MED', nombre: 'Rampas y baños accesibles', tipo: 'remodelacion', presupuesto: 145000000,
    registrada: '2025-11-18', inicia: '2025-12-01', termina: '2026-02-28', final: 'terminada', terminada: '2026-02-26',
    descripcion: 'Acceso sin escalones al auditorio y dos baños para personas con movilidad reducida.',
    hitos: [
      ['2025-12-05', 'Demolición de los baños antiguos del primer piso', 20, 18200000],
      ['2026-01-16', 'Rampas de acceso con pasamanos a los dos lados', 55, 46700000],
      ['2026-02-13', 'Baños accesibles terminados, con barras de apoyo', 90, 58900000],
      ['2026-02-26', 'Señalización táctil y entrega a la sede', 100, 12600000],
    ] },
  { sede: 'CALI', nombre: 'Techado de la plazoleta de encuentro', tipo: 'construccion', presupuesto: 380000000,
    registrada: '2026-05-12', inicia: '2026-06-01', termina: '2026-11-30', final: 'en_curso',
    descripcion: 'Cubierta metálica sobre la plazoleta donde la gente se queda después del culto, para que la lluvia no la vacíe.',
    hitos: [
      ['2026-06-01', 'Estudio de suelos y diseño estructural aprobados', 6, 14600000],
      ['2026-07-10', 'Zapatas y columnas metálicas', 22, 71200000],
      ['2026-08-21', 'Cerchas de la cubierta instaladas', 31, 49800000],
    ] },
  { sede: 'CALI', nombre: 'Sala de lactancia y enfermería', tipo: 'remodelacion', presupuesto: 42000000,
    registrada: '2026-09-02', inicia: '2026-10-13', termina: '2026-11-27', final: 'planeada',
    descripcion: 'Un cuarto junto a RocaKids para mamás lactantes y primeros auxilios. Empieza cuando termine el techado.',
    hitos: [] },
  { sede: 'BAQ', nombre: 'Aire acondicionado central del auditorio', tipo: 'mantenimiento_mayor', presupuesto: 265000000,
    registrada: '2026-02-24', inicia: '2026-03-16', termina: '2026-08-28', final: 'suspendida',
    descripcion: 'Seis equipos de 60.000 BTU. Suspendida: el operador de energía exige una acometida nueva antes de conectarlos.',
    hitos: [
      ['2026-03-16', 'Diseño de la carga térmica y compra de los equipos', 15, 38400000],
      ['2026-05-22', 'Equipos recibidos en la sede y ductos del ala oriental', 40, 92600000],
      ['2026-07-10', 'Se suspende la instalación: falta la acometida eléctrica que exige el operador de energía', 45, 4100000],
    ] },
  { sede: 'VVC', nombre: 'Templo nuevo en el lote de la vía a Restrepo', tipo: 'construccion', presupuesto: 1900000000,
    registrada: '2026-01-20', inicia: '2026-02-02', termina: '2027-06-30', final: 'en_curso',
    descripcion: 'Nave para ochocientas personas, salones y parqueadero, en el lote que se escrituró en enero. Primera etapa: la nave.',
    hitos: [
      ['2026-02-02', 'Licencia de construcción y plan de manejo ambiental', 4, 21500000],
      ['2026-03-27', 'Movimiento de tierras y cerramiento del lote', 10, 96400000],
      ['2026-06-19', 'Cimentación: zapatas y vigas de amarre de la nave central', 19, 188200000],
      ['2026-09-04', 'Columnas de la nave central hasta el primer nivel', 24, 102300000],
    ] },
];

async function poblarConstruccion(c, azar, conteo) {
  const az = azar.derivar('construccion');
  const [pp, esposa] = await d.direccionGeneral(c);
  const autores = [esposa ?? pp, pp];
  const conObra = await d.sedes(c, { conModulo: 'construccion' });
  const sedeDe = Object.fromEntries(conObra.map(s => [s.codigo, s]));
  const comoAutor = async (persona, motivo) => fijarAutor(c, { persona_id: persona.persona_id, sede_ids: [], nivel_max: 4,
    alcance_global: true, motivo });
  const usadosResp = new Set();
  let hitos = 0, obras = 0;
  for (const o of OBRAS) {
    const s = sedeDe[o.sede];
    if (!s) continue;             // el módulo está apagado ahí: no se inventa una obra que nadie vería
    /* El responsable es un líder de la sede (la dirección lo alcanza en este módulo). */
    const lideres = (await d.personas(c, { sede: s.id, edadMin: 35, edadMax: 62, compromiso: 'lider', azar: az }))
      .filter(p => !usadosResp.has(p.id));
    const resp = lideres[0] ?? null;
    if (resp) usadosResp.add(resp.id);
    const autor = autores[obras % 2];
    await comoAutor(autor, 'Registro de una obra');
    const id = az.uuid();
    await insertarLote(c, 'org.obras', [{ id, sede_id: s.id, nombre: o.nombre, tipo: o.tipo, presupuesto: o.presupuesto, moneda: 'COP',
      inicia: o.inicia, termina_estimado: o.termina, responsable_id: resp?.id ?? null, descripcion: o.descripcion,
      creado_en: iso(ms(o.registrada, az.horaEntre('09:00', '12:00', 1), s.zona_horaria)) }]);
    /* Cada hito lo registra la dirección (la base mueve el avance y lo ejecutado). */
    for (const [f, desc, avance, gasto] of o.hitos) {
      const quien = autores[az.probabilidad(0.7) ? 0 : 1];
      await comoAutor(quien, 'Hito de obra');
      const dia = minFecha(AYER, sumarDias(f, az.entero(0, 2)));
      await c.query(
        `INSERT INTO org.obras_hitos (id, obra_id, sede_id, fecha, descripcion, avance_pct, gasto, registrado_por, registrado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [az.uuid(), id, s.id, f, desc, avance, gasto, quien.persona_id, iso(ms(dia, az.horaEntre('17:00', '19:30', 1), s.zona_horaria))]);
      hitos++;
    }
    await comoAutor(autor, 'Estado de una obra');
    if (o.final === 'terminada') {
      await c.query(`UPDATE org.obras SET estado = 'terminada', terminada_en = $2 WHERE id = $1`, [id, o.terminada]);
    } else if (o.final === 'suspendida') {
      await c.query(`UPDATE org.obras SET estado = 'suspendida' WHERE id = $1`, [id]);
    } else if (o.final === 'cancelada') {
      await c.query(`UPDATE org.obras SET estado = 'cancelada' WHERE id = $1`, [id]);
    }
    obras++;
  }
  conteo.obras = obras;
  conteo.obras_hitos = hitos;
}

/* ─────────────────────────────────────────────────────────────────────
   11 · LEGAL (solo la sede madre tiene el módulo: es corporativo)
   Cada asunto: tipo del catálogo, término, responsable que la dirección
   alcanza en este módulo, y sus actuaciones (se agregan; no se editan).
   ───────────────────────────────────────────────────────────────────── */

const ASUNTOS = [
  { tipo: 'contrato', titulo: 'Contrato de obra de la ampliación del auditorio de Chicó', contraparte: 'Constructora Montes y Asociados S.A.S.',
    creado: '2025-10-06', estado: 'en_tramite', vence: '2026-12-18', resp: 'legal',
    notas: [
      ['2025-10-06', 'Se revisó la minuta del contratista. Pedimos póliza de cumplimiento del 20 %, póliza de estabilidad de obra por cinco años y pagos contra acta de avance.'],
      ['2025-10-24', 'Contrato firmado por 1.980 millones. Las pólizas quedaron aprobadas y en la carpeta del proyecto.'],
      ['2026-04-30', 'Otrosí número 1: el plazo se amplía treinta días por las lluvias de abril. El valor no cambia.'],
      ['2026-09-12', 'Acta de avance número 8 revisada con la interventoría: 63 % de obra. Se autoriza el pago del corte.'],
    ] },
  { tipo: 'arrendamiento', titulo: 'Renovación del arriendo del local de la sede Soacha', contraparte: 'Inmobiliaria Sabana Real Ltda.',
    creado: '2026-08-18', estado: 'abierto', vence: '2026-09-30', resp: 'legal',
    notas: [
      ['2026-08-18', 'El contrato vence el 30 de septiembre. El arrendador propone un incremento del 9 %: la inflación más tres puntos.'],
      ['2026-09-04', 'Respondimos por escrito: por ser un local comercial el incremento se negocia, y ofrecimos la inflación más un punto.'],
      ['2026-09-17', 'La inmobiliaria no ha contestado. Si no hay acuerdo antes del 30, se pide una prórroga de un mes para seguir negociando.'],
    ] },
  { tipo: 'arrendamiento', titulo: 'Arriendo del local de la sede Bello', contraparte: 'Arrendamientos Aburrá S.A.S.',
    creado: '2026-01-12', estado: 'cerrado', cerrado: '2026-02-20', vence: '2026-02-28', resp: 'finanzas',
    resultado: 'Se renovó por doce meses con un incremento igual a la inflación de 2025. El otrosí firmado quedó en la carpeta de la sede.',
    notas: [
      ['2026-01-12', 'Vence el 28 de febrero. La sede quiere quedarse: el local está bien ubicado y el aforo alcanza.'],
      ['2026-02-20', 'Firmado el otrosí de renovación por doce meses.'],
    ] },
  { tipo: 'laboral', titulo: 'Reclamación de un extrabajador del área de producción por horas extra',
    contraparte: 'Extrabajador de producción (contrato terminado en abril de 2026)', creado: '2026-06-09', estado: 'en_tramite',
    vence: '2026-10-14', resp: 'legal',
    notas: [
      ['2026-06-09', 'Llegó la citación a conciliación del Ministerio del Trabajo. Reclama horas extra y dominicales de los eventos de 2025.'],
      ['2026-07-02', 'Talento Humano entregó las planillas de turnos y la nómina de 2025: los dominicales se pagaron; las horas extra de dos eventos no quedaron registradas.'],
      ['2026-08-20', 'La audiencia pasó al 14 de octubre. Propuesta: pagar las horas de esos dos eventos con su recargo, sin reconocer lo demás.'],
    ] },
  { tipo: 'derecho_peticion', titulo: 'Derecho de petición de la junta de acción comunal de Cedritos por el ruido de los ensayos',
    contraparte: 'Junta de Acción Comunal del barrio Cedritos', creado: '2026-09-03', estado: 'en_tramite', vence: '2026-09-24', resp: 'legal',
    notas: [
      ['2026-09-03', 'Radicado en la sede Bogotá Norte. Piden que los ensayos de alabanza de los jueves terminen antes de las nueve de la noche.'],
      ['2026-09-10', 'La sede Bogotá Norte confirmó que los ensayos terminan a las nueve y media. Se midió el ruido con la junta en la puerta del vecino.'],
      ['2026-09-18', 'Borrador de respuesta listo: los ensayos terminarán a las ocho y cuarenta y cinco y se pondrán paneles acústicos en el salón. Falta la firma del pastor de la sede.'],
    ] },
  { tipo: 'derecho_peticion', titulo: 'Solicitud de copia de actas de asamblea de una exmiembro', contraparte: null, persona: 'exmiembro',
    creado: '2026-03-02', estado: 'cerrado', cerrado: '2026-03-19', vence: '2026-03-23', resp: 'legal',
    resultado: 'Se respondió dentro del término: se entregaron las actas de asamblea que son públicas para los miembros; lo que contiene datos de terceros se negó con fundamento en la Ley 1581 de 2012.',
    notas: [
      ['2026-03-02', 'Pide copia de las actas de asamblea de 2023 a 2025.'],
      ['2026-03-19', 'Respuesta enviada por correo certificado y por correo electrónico.'],
    ] },
  { tipo: 'tutela', titulo: 'Tutela por habeas data: supresión de los datos de una exasistente',
    contraparte: 'Juzgado Civil Municipal de Bogotá (la accionante ya no figura en la base: se suprimió)', creado: '2026-05-11',
    estado: 'cerrado', cerrado: '2026-05-29', vence: '2026-05-21', resp: 'legal',
    resultado: 'El juzgado declaró hecho superado: la supresión se hizo al tercer día y se probó con la bitácora del sistema. No hubo condena.',
    notas: [
      ['2026-05-11', 'Notificada la tutela. Hay dos días para contestar y diez para el fallo.'],
      ['2026-05-13', 'Contestación radicada: la supresión que pidió se hizo hoy; se anexó el registro de la supresión y de las listas de envío.'],
      ['2026-05-29', 'Fallo notificado: hecho superado.'],
    ] },
  { tipo: 'reclamacion', titulo: 'Reclamación a la aseguradora por la consola de sonido de Cali', contraparte: 'Aseguradora Andina de Seguros S.A.',
    creado: '2026-07-06', estado: 'en_tramite', vence: '2026-10-30', resp: 'finanzas',
    notas: [
      ['2026-07-06', 'Una filtración del techo en la bodega de Cali dañó la consola digital y dos monitores. Se avisó a la aseguradora dentro de los tres días.'],
      ['2026-08-12', 'El ajustador visitó la sede y pidió las cotizaciones de reposición y el informe del técnico.'],
      ['2026-09-09', 'Enviados el informe técnico y tres cotizaciones. La aseguradora tiene un mes para pagar u objetar.'],
    ] },
  { tipo: 'propiedad', titulo: 'Estudio de títulos y escritura del lote contiguo de Medellín', contraparte: 'Familia propietaria del lote',
    creado: '2026-02-02', estado: 'en_tramite', vence: '2026-12-15', resp: 'legal',
    notas: [
      ['2026-02-27', 'Estudio de títulos sin gravámenes ni embargos; la tradición de veinte años está limpia.'],
      ['2026-03-20', 'Promesa de compraventa firmada con arras del 30 %. La escritura se firma el 15 de diciembre, contra el último pago.'],
      ['2026-07-15', 'Segundo pago hecho según la promesa. Se pidió el paz y salvo del impuesto predial para la escritura.'],
    ] },
  { tipo: 'propiedad', titulo: 'Registro de la escritura del lote de Villavicencio',
    contraparte: 'Oficina de Registro de Instrumentos Públicos de Villavicencio', creado: '2025-11-10', estado: 'cerrado',
    cerrado: '2026-01-22', vence: '2026-01-30', resp: 'legal',
    resultado: 'Escritura registrada: el folio de matrícula inmobiliaria quedó a nombre de la iglesia. Con eso se pidió la licencia del templo.',
    notas: [
      ['2025-11-10', 'Firmada la escritura de compraventa en la notaría. Falta pagar los derechos de registro.'],
      ['2025-12-02', 'Pagados los derechos de registro y la boleta fiscal; radicada en la oficina de registro.'],
      ['2026-01-22', 'Llegó el certificado de tradición con la iglesia como propietaria.'],
    ] },
  { tipo: 'permiso_licencia', titulo: 'Prórroga de la licencia de construcción de la segunda planta de Bogotá Sur', contraparte: 'Curaduría urbana',
    creado: '2026-08-24', estado: 'abierto', vence: '2026-10-05', resp: 'legal',
    notas: [
      ['2026-08-24', 'La obra va atrasada y la licencia no alcanza. La prórroga se radica a más tardar el 5 de octubre, con la certificación del avance firmada por el constructor.'],
      ['2026-09-11', 'El constructor entregó la certificación del 61 % de avance. Falta el poder firmado por el representante legal para radicar.'],
    ] },
  { tipo: 'permiso_licencia', titulo: 'Permiso de uso del parque para el Encuentro de Jóvenes', contraparte: 'Alcaldía local de Usaquén',
    creado: '2026-06-15', estado: 'cerrado', cerrado: '2026-07-24', vence: '2026-07-24', resp: 'direccion',
    resultado: 'Permiso otorgado para el sábado 8 de agosto de dos a ocho de la noche, con plan de emergencias y brigadistas. El evento se hizo sin novedades.',
    notas: [
      ['2026-06-15', 'Radicada la solicitud con el plan de emergencias, el aforo esperado y la póliza de responsabilidad civil.'],
      ['2026-07-24', 'La alcaldía local expidió el permiso.'],
    ] },
  { tipo: 'otro', titulo: 'Actualización de dignatarios en el registro de entidades religiosas', contraparte: 'Ministerio del Interior',
    creado: '2026-08-31', estado: 'abierto', vence: '2026-10-31', resp: 'direccion',
    notas: [
      ['2026-08-31', 'La asamblea de agosto eligió nuevo tesorero de la junta directiva. Hay que reportarlo con el acta y las cédulas.'],
    ] },
  { tipo: 'otro', titulo: 'Actualización anual del Registro Nacional de Bases de Datos', contraparte: 'Superintendencia de Industria y Comercio',
    creado: '2026-02-16', estado: 'cerrado', cerrado: '2026-03-18', vence: '2026-03-31', resp: 'legal',
    resultado: 'Registro actualizado con las bases de personas, aportes, menores y consejería, y con los reclamos atendidos en el año.',
    notas: [
      ['2026-02-16', 'Se revisó con Sistemas qué bases cambiaron con la salida en vivo del sistema nuevo.'],
      ['2026-03-18', 'Actualización hecha en el portal de la Superintendencia; quedó la constancia.'],
    ] },
  { tipo: 'otro', titulo: 'Respuesta al requerimiento de la Secretaría de Ambiente por el aviso de la fachada',
    contraparte: 'Secretaría Distrital de Ambiente', creado: '2026-08-26', estado: 'en_tramite', vence: '2026-09-16', resp: 'legal',
    notas: [
      ['2026-08-26', 'Requerimiento por el aviso luminoso de la fachada de Chicó: piden el registro de publicidad exterior visual.'],
      ['2026-09-11', 'Se radicó una solicitud de prórroga de diez días hábiles mientras se tramita el registro.'],
      ['2026-09-18', 'La Secretaría no ha contestado la prórroga. El término original venció el 16; se sigue preparando el registro.'],
    ] },
  { tipo: 'contrato', titulo: 'Contrato de servicios contables para las sedes de la región Colombia', contraparte: 'Contadores Asociados del Valle S.A.S.',
    creado: '2026-01-05', estado: 'cerrado', cerrado: '2026-01-27', vence: '2026-01-31', resp: 'finanzas',
    resultado: 'Contrato firmado por un año, con cláusula de confidencialidad y de tratamiento de datos como encargado.',
    notas: [
      ['2026-01-05', 'Tres propuestas recibidas. Se escoge la que incluye la conciliación mensual de aportes por sede.'],
      ['2026-01-27', 'Contrato firmado con la cláusula de encargado del tratamiento de datos personales.'],
    ] },
];

async function poblarLegal(c, azar, conteo) {
  const az = azar.derivar('legal');
  const madre = (await d.sedes(c, { conModulo: 'legal' })).find(s => s.tipo === 'sede_madre') ?? (await d.sedes(c, { conModulo: 'legal' }))[0];
  if (!madre) return;
  const [pp, esposa] = await d.direccionGeneral(c);
  const coordina = esposa ?? pp;
  /* Responsables que la dirección alcanza en Legal: gente de la sede madre (el filtro de módulos esconde a los demás). */
  const { rows: [legal] } = await c.query(
    `SELECT m.persona_id FROM org.unidad_miembros m JOIN org.unidades u ON u.id = m.unidad_id JOIN nucleo.personas p ON p.id = m.persona_id
      WHERE u.codigo = 'EQ-LEGAL' AND m.hasta IS NULL AND p.sede_id = $1 ORDER BY m.desde, m.persona_id LIMIT 1`, [madre.id]);
  const { rows: [fin] } = await c.query(
    `SELECT m.persona_id FROM org.unidad_miembros m JOIN org.unidades u ON u.id = m.unidad_id JOIN nucleo.personas p ON p.id = m.persona_id
      WHERE u.codigo = 'EQ-FIN' AND m.hasta IS NULL AND p.sede_id = $1 ORDER BY m.desde, p.primer_apellido LIMIT 1`, [madre.id]);
  const responsable = { legal: legal?.persona_id ?? coordina.persona_id, finanzas: fin?.persona_id ?? coordina.persona_id,
    direccion: coordina.persona_id };
  const [exmiembro] = await d.personas(c, { sede: madre.id, estado: 'inactiva', edadMin: 30, azar: az, limite: 1 });

  const comoAutor = async (persona_id, motivo) => fijarAutor(c, { persona_id, sede_ids: [madre.id], nivel_max: 4,
    alcance_global: false, motivo });
  let notas = 0;
  for (const [i, x] of ASUNTOS.entries()) {
    const autor = i % 4 === 3 ? pp.persona_id : coordina.persona_id;
    await comoAutor(autor, 'Apertura de un asunto legal');
    const id = az.uuid();
    await insertarLote(c, 'plataforma.asuntos_legales', [{ id, sede_id: madre.id, tipo: x.tipo, titulo: x.titulo,
      contraparte: x.contraparte, persona_id: x.persona === 'exmiembro' ? exmiembro?.id ?? null : null,
      responsable_id: responsable[x.resp], vence_en: x.vence, creado_por: autor,
      creado_en: iso(ms(x.creado, az.horaEntre('08:30', '11:30', 1), madre.zona_horaria)) }]);
    /* Las actuaciones las escribe quien coordina lo legal en la dirección. */
    const filas = x.notas.map(([f, texto], k) => ({ id: az.uuid(), asunto_id: id, sede_id: madre.id,
      autor_id: k % 3 === 2 ? pp.persona_id : coordina.persona_id, contenido: texto,
      escrita_en: iso(ms(f, az.horaEntre(k === 0 ? '11:30' : '09:00', '18:30', 1), madre.zona_horaria)) }));
    for (const autorNota of [...new Set(filas.map(f => f.autor_id))]) {
      await comoAutor(autorNota, 'Actuación en un asunto legal');
      await insertarLote(c, 'plataforma.asuntos_legales_notas', filas.filter(f => f.autor_id === autorNota));
    }
    notas += filas.length;
    /* El estado avanza por sus transiciones (abierto → en trámite → cerrado), con la fecha en que pasó. */
    await comoAutor(autor, 'Estado de un asunto legal');
    if (x.estado === 'en_tramite' || x.estado === 'cerrado') {
      await c.query(`UPDATE plataforma.asuntos_legales SET estado = 'en_tramite' WHERE id = $1`, [id]);
    }
    if (x.estado === 'cerrado') {
      await c.query(`UPDATE plataforma.asuntos_legales SET estado = 'cerrado', resultado = $2, cerrado_en = $3 WHERE id = $1`,
        [id, x.resultado, iso(ms(x.cerrado, '18:45', madre.zona_horaria))]);
    }
  }
  conteo.asuntos_legales = ASUNTOS.length;
  conteo.actuaciones_legales = notas;
}

/* ─────────────────────────────────────────────────────────────────────
   12 · COMPROBACIONES ANTES DE CONFIRMAR
   Si algo de esto falla, se revierte todo: mejor nada que datos que no cuadran.
   ───────────────────────────────────────────────────────────────────── */

async function comprobar(c, descuadres) {
  const chequeos = [
    ['aportes con fecha futura', `SELECT count(*) FROM aportes.aportes WHERE fecha > DATE '${AYER}'`],
    /* Solo los vigentes: la vista también marca los anulados, porque al anular se liberan sus aportes (ver el informe). */
    ['certificados vigentes cuyo total no cuadra con sus renglones', `SELECT count(*) FROM aportes.v_control_certificados v
       JOIN aportes.certificados c ON c.id = v.id WHERE c.estado = 'expedido' AND NOT v.cuadra`],
    ['aportes certificados sin certificado vigente', `SELECT count(*) FROM aportes.aportes a LEFT JOIN aportes.certificados c ON c.id = a.certificado_id
       WHERE a.estado = 'certificado' AND (c.id IS NULL OR c.estado <> 'expedido')`],
    ['cierres que no cuadran (solo los dos a propósito: el sobre de Cali en julio y el duplicado de Bucaramanga en agosto)',
      `SELECT abs(count(*) - ${Number(descuadres) || 0}) FROM aportes.v_reconciliacion WHERE NOT cuadra`],
    ['obras terminadas por debajo del cien', `SELECT count(*) FROM org.obras WHERE estado = 'terminada' AND avance_pct <> 100`],
    ['obras cuyo ejecutado no es la suma de sus hitos', `SELECT count(*) FROM org.obras o
       WHERE o.ejecutado <> COALESCE((SELECT sum(h.gasto) FROM org.obras_hitos h WHERE h.obra_id = o.id), 0)`],
    ['asuntos cerrados sin resultado', `SELECT count(*) FROM plataforma.asuntos_legales WHERE estado = 'cerrado' AND resultado IS NULL`],
    ['desembolsos que no cuadran con sus renglones', `SELECT count(*) FROM aportes.desembolsos x
       WHERE x.monto_bruto <> (SELECT sum(i.monto_bruto) FROM aportes.desembolso_items i WHERE i.desembolso_id = x.id)`],
    ['pagos aprobados con dueño y sin aporte', `SELECT count(*) FROM aportes.pasarela_transacciones
       WHERE estado = 'aprobada' AND persona_id IS NOT NULL AND aporte_id IS NULL`],
    ['avisos de aportes pendientes desde antes de hoy', `SELECT count(*) FROM plataforma.notificaciones
       WHERE origen_modulo = 'aportes' AND estado = 'pendiente' AND creada_en < CURRENT_DATE`],
  ];
  for (const [que, sql] of chequeos) {
    const { rows: [r] } = await c.query(sql);
    if (Number(Object.values(r)[0]) !== 0) throw new Error(`Comprobación fallida: ${que} (${Object.values(r)[0]}).`);
  }
}
