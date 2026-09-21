import { api } from '../api.js';
import { esc, cargando, error, errorDeBloque, engancharReintentar } from '../ui.js';
import { tabla, vacio } from './comun.js';

/**
 * Analítica · el tablero de lo que usted alcanza.
 * ⛔ Toda cifra menor de 5 sale como «<5»: un conteo pequeño identifica a
 * las personas. Y la lista de quién se está perdiendo va aparte, porque
 * es para LLAMAR, no para medir.
 */
export async function pintarAnalitica(c) {
  c.innerHTML = `<h1>Analítica</h1><p class="etiqueta">Lo que usted alcanza. Las cifras menores de 5 se muestran como «&lt;5».</p>${cargando(4)}`;
  const [rT, rP] = await Promise.allSettled([
    api.obtener('/api/v1/analitica/tablero'),
    api.obtener('/api/v1/crm/se-estan-perdiendo?limite=50'),
  ]);
  if (rT.status === 'rejected' && rP.status === 'rejected') {
    c.innerHTML = `<h1>Analítica</h1>${error(rT.reason.message, rT.reason.peticionId)}`;
    return engancharReintentar(c, () => pintarAnalitica(c));
  }
  const t = rT.status === 'fulfilled' ? rT.value : null;
  const p = rP.status === 'fulfilled' ? rP.value : null;
  const semanas = t?.asistencia_por_semana ?? [];
  const tope = Math.max(1, ...semanas.map(s => Number(s.contados) || 0));
  const alerta = (v) => v && v !== '0' ? 'cifra--alerta' : '';
  c.innerHTML = `
    <h1>Analítica</h1>
    <p class="etiqueta">Lo que usted alcanza. Las cifras menores de 5 se muestran como «&lt;5».</p>
    ${t ? `
    <div class="cifras">
      <div class="cifra"><b>${esc(t.personas_activas)}</b><span>personas activas</span></div>
      <div class="cifra"><b>${esc(t.grupos_activos)}</b><span>grupos activos</span></div>
      <div class="cifra ${alerta(t.grupos_sin_reunion_45_dias)}"><b>${esc(t.grupos_sin_reunion_45_dias)}</b><span>grupos sin reunión en 45 días</span></div>
      <div class="cifra"><b>${esc(t.peticiones_oracion_abiertas)}</b><span>peticiones de oración abiertas</span></div>
      <div class="cifra ${alerta(t.requerimientos_vencidos)}"><b>${esc(t.requerimientos_vencidos)}</b><span>requerimientos vencidos</span></div>
      <div class="cifra ${alerta(t.tareas_vencidas)}"><b>${esc(t.tareas_vencidas)}</b><span>tareas vencidas</span></div>
    </div>
    <h2>Asistencia contada, últimas 12 semanas</h2>
    ${semanas.length ? `<div class="barras" role="img" aria-label="Asistencia por semana: ${semanas.map(s => `${s.semana} ${s.contados}`).join(', ')}">
      ${semanas.map(s => `<div class="barras__col" title="${esc(s.semana)}: ${esc(s.contados)}">
        <i style="height:${Math.round(100 * (Number(s.contados) || 0) / tope)}%"></i><small>${esc(String(s.semana).slice(5))}</small></div>`).join('')}
    </div>` : '<p class="ayuda">Ningún conteo de puerta reportado en las últimas 12 semanas.</p>'}
    <h2 style="margin-top:1.5rem">Niños por domingo</h2>
    ${(t.ninos_por_domingo ?? []).length ? tabla(t.ninos_por_domingo, [
        { titulo: 'Fecha', campo: 'fecha' }, { titulo: 'Niños recibidos', campo: 'ninos' }])
      : '<p class="ayuda">Ningún check-in en las últimas 8 semanas.</p>'}
    ` : errorDeBloque('el tablero', rT.reason?.message ?? '')}

    <h2 style="margin-top:2rem">¿Quién se nos está perdiendo?</h2>
    ${p ? `<p class="ayuda">${esc(p.criterio)}</p>
      ${p.personas.length ? tabla(p.personas, [
          { titulo: 'Persona', pintar: x => `<strong>${esc(x.nombre)}</strong>${x.telefono ? `<br><a href="tel:${esc(x.telefono)}">${esc(x.telefono)}</a>` : ''}` },
          { titulo: 'Vino antes', pintar: x => `${esc(x.veces_antes)} veces` },
          { titulo: 'Última vez', pintar: x => `${esc(x.ultima_vez)}<br><span class="ayuda">hace ${esc(x.dias_sin_venir)} días</span>` },
          { titulo: 'Sede', campo: 'sede' },
        ]) : vacio('🤝', 'Nadie se está perdiendo', 'Nadie que venía seguido dejó de venir en el último mes.')}`
      : errorDeBloque('quién se está perdiendo', rP.reason?.message ?? '')}`;
  engancharReintentar(c, () => pintarAnalitica(c));
}
