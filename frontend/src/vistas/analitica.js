import { api } from '../api.js';
import { esc, cargando, error, errorDeBloque, engancharReintentar } from '../ui.js';
import { tabla, vacio } from './comun.js';
import { linea, columnas, chispa, variacion } from '../graficos.js';
import { cabCelda, n, fmt, esPequeno, fechaCorta } from '../tablero.js';
import { cifraViva, engancharDetalles } from '../detalle.js';
import { detallesPastorales } from '../detalles.js';

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
  const valores = semanas.map(x => n(x.contados));
  const prom = valores.length > 1 ? Math.round(valores.slice(0, -1).reduce((a, b) => a + b, 0) / (valores.length - 1)) : 0;
  const ninos = t?.ninos_por_domingo ?? [];
  /* 5 oct 2026 · Las seis cifras eran cuadros muertos. Ahora cada una se
     pulsa y abre su detalle (src/detalles.js), y la que pide atención se
     tiñe de aviso con su palabra, no solo con el color. */
  const ojo = (v) => (n(v) > 0 || esPequeno(v)) ? 'ojo' : '';
  c.innerHTML = `
    <h1>Analítica</h1>
    <p class="etiqueta">Lo que usted alcanza. Las cifras menores de 5 se muestran como «&lt;5». Pulse cualquier cuadro para ver el detalle.</p>
    ${t ? `
    <div class="bento">
      ${cifraViva({ clave: 'personas', rotulo: 'Personas activas', valor: t.personas_activas, explica: 'con actividad reciente', ancho: 'c-4', extra: chispa(valores) })}
      ${cifraViva({ clave: 'grupos', rotulo: 'Grupos activos', valor: t.grupos_activos, explica: 'reuniéndose en su alcance', ancho: 'c-4' })}
      ${cifraViva({ clave: 'sinReunion', rotulo: 'Grupos sin reunión', valor: t.grupos_sin_reunion_45_dias,
        explica: ojo(t.grupos_sin_reunion_45_dias) ? 'más de 45 días sin reunirse: hable con su líder' : 'todos se reunieron', ancho: 'c-4', tono: ojo(t.grupos_sin_reunion_45_dias) })}
      ${cifraViva({ clave: 'oracion', rotulo: 'Oración abierta', valor: t.peticiones_oracion_abiertas, explica: 'peticiones esperando acompañamiento', ancho: 'c-4' })}
      ${cifraViva({ clave: 'requerimientos', rotulo: 'Requerimientos vencidos', valor: t.requerimientos_vencidos,
        explica: ojo(t.requerimientos_vencidos) ? 'algo roto que alguien está esperando' : 'nada vencido', ancho: 'c-4', tono: ojo(t.requerimientos_vencidos) })}
      ${cifraViva({ clave: 'tareas', rotulo: 'Tareas vencidas', valor: t.tareas_vencidas,
        explica: ojo(t.tareas_vencidas) ? 'pasaron su fecha' : 'todas al día', ancho: 'c-4', tono: ojo(t.tareas_vencidas) })}
      <section class="bento__celda c-8" aria-label="Asistencia por semana">
        ${cabCelda('Asistencia contada, últimas 12 semanas', semanas.length
          ? `La semana pasada: <b>${fmt(valores.at(-1))}</b>. ${variacion(valores.at(-1), prom, { ref: `el promedio de ${fmt(prom)}` })}`
          : 'Ningún conteo de puerta reportado en las últimas 12 semanas.')}
        ${linea('Asistencia contada por semana', semanas.map(x => ({ x: x.semana, v: x.contados })), { formatoX: fechaCorta })}
      </section>
      <section class="bento__celda c-4" aria-label="Niños por domingo">
        ${cabCelda('Niños por domingo', ninos.length ? `Último domingo: <b>${fmt(ninos.at(-1)?.ninos)}</b>.
          ${variacion(n(ninos.at(-1)?.ninos), n(ninos.at(-2)?.ninos), { ref: 'el domingo anterior' })}` : 'Ningún check-in en las últimas 8 semanas.')}
        ${columnas('Niños recibidos por domingo', ninos.map((x, i) => ({ x: x.fecha, v: x.ninos, destacar: i === ninos.length - 1 })), { formatoX: fechaCorta, alto: 170 })}
      </section>
    </div>
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
  if (t) engancharDetalles(c, detallesPastorales(t));
  engancharReintentar(c, () => pintarAnalitica(c));
}
