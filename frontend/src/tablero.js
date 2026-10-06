/* tablero.js · Las piezas con que se arma un panel que EXPLICA.

   Pedido de Daniel (5 oct 2026): «muchos cuadros sin sentido, solo con
   título; tiene que haber gráficos y cosas explicativas, mucho más
   asertivo». La regla que sale de ahí: ninguna celda es solo un número
   con un rótulo. Toda celda dice qué pasa, contra qué se compara y, si
   hay algo que hacer, el botón para hacerlo. */

import { esc } from './ui.js';

/** Encabezado de celda: título, una frase que explica y un enlace opcional. */
export function cabCelda(titulo, explica = '', enlace = null) {
  return `<div class="bento__cab">
    <div><h2 class="bento__titulo">${esc(titulo)}</h2>
      ${explica ? `<p class="bento__explica">${explica}</p>` : ''}</div>
    ${enlace ? `<a class="bento__enlace" href="#/${esc(enlace.ir)}">${esc(enlace.t)} →</a>` : ''}
  </div>`;
}

/**
 * Un aviso accionable. tono: 'urgente' | 'atender' | 'bien'.
 * El tono va con icono y palabra, nunca solo con color.
 */
export function aviso({ tono = 'atender', titulo, detalle = '', accion = null }) {
  const icono = tono === 'urgente' ? '!' : tono === 'bien' ? '✓' : '•';
  const palabra = tono === 'urgente' ? 'Urgente' : tono === 'bien' ? 'Al día' : 'Para atender';
  return `<li class="cr-aviso cr-aviso--${tono}">
    <span class="cr-aviso__icono" aria-hidden="true">${icono}</span>
    <span class="cr-aviso__texto"><span class="sr-solo">${palabra}: </span><b>${titulo}</b>
      ${detalle ? `<small>${detalle}</small>` : ''}</span>
    ${accion ? `<a class="cr-aviso__accion" href="#/${esc(accion.ir)}">${esc(accion.t)}</a>` : ''}
  </li>`;
}

/** Lista de avisos; si no hay ninguno, lo dice en positivo. */
export function avisos(lista, vacio = 'Nada pendiente por ahora. Todo lo que usted alcanza está al día.') {
  const l = lista.filter(Boolean);
  return `<ul class="cr-avisos">${l.length ? l.join('') : aviso({ tono: 'bien', titulo: esc(vacio) })}</ul>`;
}

/** Número limpio desde lo que manda la API («1284», «<5», 12). */
export const n = (v) => {
  const x = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(x) ? x : 0;
};
export const esPequeno = (v) => typeof v === 'string' && v.trim().startsWith('<');
export const fmt = (v) => esPequeno(v) ? v : n(v).toLocaleString('es-CO');

/** Fecha corta «28 sep» para ejes y tooltips. */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fechaCorta(iso) {
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? String(iso) : `${d.getDate()} ${MESES[d.getMonth()]}`;
}
