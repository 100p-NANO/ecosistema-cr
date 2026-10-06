/* detalles.js · Lo que aparece al pulsar cada cifra pastoral.

   Lo usan el Panel y Analítica: la misma cifra abre el mismo detalle en
   las dos pantallas. Cada detalle pide su dato al abrirse, no antes: una
   pantalla de inicio no puede cargar seis listas por si alguien las pulsa.

   ⛔ Privacidad: de una petición de oración CONFIDENCIAL solo se muestra la
      categoría y la fecha. Ni el resumen ni quién la pidió. */

import { api } from './api.js';
import { esc } from './ui.js';
import { listaDetalle } from './detalle.js';
import { linea, columnas, barrasH, SERIE } from './graficos.js';
import { n, fmt, fechaCorta } from './tablero.js';

const TIPO_GRUPO = { hogar: 'Hogares', pequeno: 'Grupos pequeños', celula: 'Células', ministerio: 'Ministerio' };
const nota = (t) => `<p class="cajon__nota">${t}</p>`;

export function detallesPastorales(tab) {
  const semanas = tab?.asistencia_por_semana ?? [];
  const vals = semanas.map(s => n(s.contados));
  const prom = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;

  return {
    personas: async () => ({
      titulo: `${fmt(tab?.personas_activas)} personas activas`,
      explica: 'Personas con actividad reciente en las sedes que usted alcanza: asistencia, grupo, servicio o formación.',
      cuerpo: `${linea('Asistencia contada por semana', semanas.map(s => ({ x: s.semana, v: s.contados })), { formatoX: fechaCorta, alto: 180 })}
        ${nota(`El promedio de las últimas 12 semanas es <b>${fmt(prom)}</b> personas por semana.`)}`,
      ir: { t: 'Abrir Personas', ruta: 'personas' },
    }),

    grupos: async () => {
      const r = await api.obtener('/api/v1/grupos?limite=200');
      const g = r.grupos ?? [];
      const porTipo = Object.entries(g.reduce((a, x) => { a[x.tipo] = (a[x.tipo] ?? 0) + 1; return a; }, {}))
        .map(([k, v], i) => ({ t: TIPO_GRUPO[k] ?? k, v, color: SERIE[i % SERIE.length] }));
      const orden = [...g].sort((a, b) => (b.dias_sin_reunirse ?? 9999) - (a.dias_sin_reunirse ?? 9999));
      return {
        titulo: `${fmt(tab?.grupos_activos ?? g.length)} grupos activos`,
        explica: 'Primero los que llevan más tiempo sin reportar reunión. Un grupo que no se reúne se está apagando.',
        cuerpo: `${barrasH('Grupos por tipo', porTipo)}
          <h3 class="cajon__sub">Uno por uno</h3>
          ${listaDetalle(orden.map(x => ({
            t: esc(x.nombre), sub: `${esc(x.sede ?? '')} · ${esc(x.dia_reunion ?? '')} ${esc(x.hora ?? '')} · ${esc(x.miembros ?? 0)} miembros`,
            der: x.dias_sin_reunirse == null ? 'nunca se ha reunido' : `hace ${x.dias_sin_reunirse} días`,
            tono: x.dias_sin_reunirse == null || x.dias_sin_reunirse > 45 ? 'mal' : x.dias_sin_reunirse > 14 ? 'ojo' : 'bien',
            ir: 'grupos/' + x.id })), 'No hay grupos registrados.')}`,
        ir: { t: 'Abrir Grupos', ruta: 'grupos' },
      };
    },

    sinReunion: async () => {
      const r = await api.obtener('/api/v1/grupos?limite=200');
      const g = (r.grupos ?? []).filter(x => x.dias_sin_reunirse == null || x.dias_sin_reunirse > 45)
        .sort((a, b) => (b.dias_sin_reunirse ?? 9999) - (a.dias_sin_reunirse ?? 9999));
      return {
        titulo: `${fmt(tab?.grupos_sin_reunion_45_dias ?? g.length)} grupos sin reunión en 45 días`,
        explica: 'Hable con el líder de cada uno esta semana: pregunte qué pasó y si necesita apoyo.',
        cuerpo: listaDetalle(g.map(x => ({
          t: esc(x.nombre), sub: `${esc(x.sede ?? '')} · ${esc(x.miembros ?? 0)} miembros`,
          der: x.dias_sin_reunirse == null ? 'nunca' : `${x.dias_sin_reunirse} días`, tono: 'mal', ir: 'grupos/' + x.id })),
          'Todos los grupos se reunieron en los últimos 45 días.'),
        ir: { t: 'Abrir Grupos', ruta: 'grupos' },
      };
    },

    oracion: async () => {
      const r = await api.obtener('/api/v1/oracion?limite=100');
      const abiertas = (r.peticiones ?? []).filter(p => ['abierta', 'en_oracion'].includes(p.estado));
      const porCat = Object.entries(abiertas.reduce((a, p) => { const k = p.categoria_nombre ?? p.categoria; a[k] = (a[k] ?? 0) + 1; return a; }, {}))
        .map(([t, v], i) => ({ t, v, color: SERIE[i % SERIE.length] }));
      return {
        titulo: `${fmt(tab?.peticiones_oracion_abiertas ?? abiertas.length)} peticiones de oración abiertas`,
        explica: 'Las confidenciales solo muestran su categoría: el resumen y el nombre los ven los pastores dentro de Oración.',
        cuerpo: `${barrasH('Peticiones abiertas por categoría', porCat)}
          <h3 class="cajon__sub">Esperando acompañamiento</h3>
          ${listaDetalle(abiertas.map(p => p.confidencial
            ? { t: '🔒 Petición confidencial', sub: `${esc(p.categoria_nombre ?? '')} · ${esc(fechaCorta(p.fecha))}`, der: 'N3', tono: 'n3', ir: 'oracion/' + p.id }
            : { t: esc(p.resumen), sub: `${esc(p.quien ?? '')} · ${esc(p.categoria_nombre ?? '')} · ${esc(fechaCorta(p.fecha))}`,
                der: n(p.veces_orada) ? `orada ${p.veces_orada} veces` : 'nadie ha orado aún', tono: n(p.veces_orada) ? 'bien' : 'ojo', ir: 'oracion/' + p.id }),
            'No hay peticiones abiertas.')}`,
        ir: { t: 'Abrir Oración', ruta: 'oracion' },
      };
    },

    promedio: async () => ({
      titulo: `${fmt(prom)} personas por semana`,
      explica: 'El promedio de las últimas 12 semanas. Las columnas muestran cada semana; la oscura es la más reciente.',
      cuerpo: `${columnas('Asistencia por semana', semanas.map((s, i) => ({ x: s.semana, v: s.contados, destacar: i === semanas.length - 1 })), { formatoX: fechaCorta, alto: 200 })}
        ${vals.length ? nota(`La semana más alta fue de <b>${fmt(Math.max(...vals))}</b> y la más baja de <b>${fmt(Math.min(...vals))}</b>.`) : ''}`,
      ir: { t: 'Abrir Asistencia', ruta: 'asistencia' },
    }),

    requerimientos: async () => {
      const r = await api.obtener('/api/v1/requerimientos?abiertos=si&limite=100');
      const l = (r.requerimientos ?? []).sort((a, b) => Number(b.vencido) - Number(a.vencido));
      return {
        titulo: `${fmt(tab?.requerimientos_vencidos)} requerimientos vencidos`,
        explica: 'Todo lo abierto, con los vencidos primero. Un requerimiento vencido es algo roto que alguien está esperando.',
        cuerpo: listaDetalle(l.map(x => ({
          t: esc(x.asunto), sub: `${esc(x.sede ?? '')} · ${esc(x.categoria_nombre ?? '')} · ${esc(x.asignado ?? 'sin asignar')}`,
          der: x.vencido ? 'vencido' : esc(x.prioridad ?? ''), tono: x.vencido ? 'mal' : x.prioridad === 'urgente' ? 'ojo' : '',
          ir: 'requerimientos/' + x.id })), 'No hay requerimientos abiertos.'),
        ir: { t: 'Abrir Requerimientos', ruta: 'requerimientos' },
      };
    },

    tareas: async () => {
      const r = await api.obtener('/api/v1/tareas?abiertas=si&limite=100');
      const l = (r.tareas ?? []).sort((a, b) => Number(b.vencida) - Number(a.vencida));
      return {
        titulo: n(tab?.tareas_vencidas) ? `${fmt(tab.tareas_vencidas)} tareas vencidas` : 'Ninguna tarea vencida',
        explica: 'Las tareas abiertas, con las vencidas primero.',
        cuerpo: listaDetalle(l.map(x => ({
          t: esc(x.titulo), sub: `${esc(x.asignada ?? '')} · vence ${esc(x.vence ? fechaCorta(x.vence) : 'sin fecha')}`,
          der: x.vencida ? 'vencida' : esc(x.prioridad ?? ''), tono: x.vencida ? 'mal' : '' })), 'No hay tareas abiertas.'),
        ir: { t: 'Abrir Tareas', ruta: 'tareas' },
      };
    },
  };
}
