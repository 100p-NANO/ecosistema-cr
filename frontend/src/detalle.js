/* detalle.js · Toda cifra se puede abrir.

   Pedido de Daniel (5 oct 2026): «todo debe ser interactivo; cada cuadro de
   información debe ser dinámico y cuando yo le dé clic deberá aparecer
   todo». Una cifra que no se puede abrir obliga a ir a buscar en otra
   pantalla de dónde sale; aquí se pulsa y aparece el detalle: qué
   significa, quiénes o cuáles son, y el botón para ir a resolverlo.

   Cómo se usa en una vista:
     html:  cifraViva({ clave: 'grupos', rotulo: 'Grupos activos', valor: 86, explica: '…' })
     luego: engancharDetalles(contenedor, { grupos: async () => ({ titulo, explica, cuerpo, ir }) })

   El cajón es un diálogo de verdad: se cierra con Esc, con la X o tocando
   fuera; el foco entra al abrir y vuelve al cuadro al cerrar. En escritorio
   sale por la derecha; en el teléfono sube desde abajo. */

import { esc } from './ui.js';
import { animarVista } from './movimiento.js';

const fmt = (v) => (typeof v === 'string' && v.trim().startsWith('<')) ? v
  : Number(String(v ?? '').replace(/[^\d.-]/g, '') || 0).toLocaleString('es-CO');

/** Un cuadro con cifra que se pulsa. tono: '' | 'ojo' (pide atención). */
export function cifraViva({ clave, rotulo, valor, explica = '', tono = '', ancho = 'c-3', extra = '' }) {
  const entero = /^\d+$/.test(String(valor));
  return `<button type="button" class="bento__celda bento__celda--accion ${ancho} kpi ${tono === 'ojo' ? 'bento__celda--ojo' : ''}"
      data-detalle="${esc(clave)}" aria-haspopup="dialog">
    <p class="bento__rotulo">${esc(rotulo)}</p>
    <p class="bento__cifra"${entero ? ` data-cifra="${esc(valor)}"` : ''}>${esc(fmt(valor))}</p>
    ${extra}
    <p class="bento__pie">${esc(explica)}</p>
    <span class="bento__flecha">Ver el detalle →</span>
  </button>`;
}

/** Engancha los cuadros con `data-detalle` de un contenedor a su contenido. */
export function engancharDetalles(contenedor, mapa) {
  contenedor.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-detalle]');
    if (!b || !contenedor.contains(b) || !mapa[b.dataset.detalle]) return;
    abrirDetalle(mapa[b.dataset.detalle], b);
  });
}

let abierto = null;

/** Abre el cajón. `fuente` es una función (async) que devuelve
    { titulo, explica, cuerpo, ir: { t, ruta } }. */
export async function abrirDetalle(fuente, origen = null) {
  cerrarDetalle(false);
  const raiz = document.createElement('div');
  raiz.className = 'cajon';
  raiz.innerHTML = `
    <div class="cajon__fondo" data-cerrar></div>
    <section class="cajon__panel" role="dialog" aria-modal="true" aria-labelledby="cajon-titulo" tabindex="-1">
      <header class="cajon__cab">
        <div><p class="bento__rotulo">Detalle</p><h2 id="cajon-titulo">Cargando…</h2></div>
        <button type="button" class="cajon__cerrar" data-cerrar aria-label="Cerrar el detalle">✕</button>
      </header>
      <div class="cajon__cuerpo"><div class="esqueleto"></div><div class="esqueleto" style="margin-top:8px"></div></div>
    </section>`;
  document.body.appendChild(raiz);
  abierto = { raiz, origen };
  document.body.classList.add('con-cajon');
  const panel = raiz.querySelector('.cajon__panel');
  requestAnimationFrame(() => raiz.classList.add('is-on'));
  panel.focus();
  raiz.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-cerrar]')) cerrarDetalle();
    if (ev.target.closest('.cajon__cuerpo a[href^="#/"]')) cerrarDetalle(false);
  });
  raiz.addEventListener('keydown', atraparFoco);

  try {
    const d = await fuente();
    if (abierto?.raiz !== raiz) return;              // se cerró mientras cargaba
    raiz.querySelector('#cajon-titulo').textContent = d.titulo ?? '';
    const cuerpo = raiz.querySelector('.cajon__cuerpo');
    cuerpo.innerHTML = `
      ${d.explica ? `<p class="cajon__explica">${d.explica}</p>` : ''}
      <div class="cajon__contenido">${d.cuerpo ?? ''}</div>
      ${d.ir ? `<a class="cajon__ir" href="#/${esc(d.ir.ruta)}">${esc(d.ir.t)} →</a>` : ''}`;
    animarVista(cuerpo.querySelector('.cajon__contenido'));
  } catch (e) {
    if (abierto?.raiz !== raiz) return;
    raiz.querySelector('#cajon-titulo').textContent = 'No se pudo cargar';
    raiz.querySelector('.cajon__cuerpo').innerHTML =
      `<p class="cajon__explica">${esc(e.message ?? 'Error desconocido')}</p>`;
  }
}

export function cerrarDetalle(devolverFoco = true) {
  if (!abierto) return;
  const { raiz, origen } = abierto;
  abierto = null;
  document.body.classList.remove('con-cajon');
  raiz.classList.remove('is-on');
  const quitar = () => raiz.remove();
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) quitar();
  else setTimeout(quitar, 220);
  if (devolverFoco && origen?.isConnected) origen.focus();
}

function atraparFoco(ev) {
  if (ev.key === 'Escape') { ev.preventDefault(); cerrarDetalle(); return; }
  if (ev.key !== 'Tab') return;
  const f = [...ev.currentTarget.querySelectorAll('a[href],button,[tabindex="0"],summary,input,select,textarea')]
    .filter(x => !x.disabled && x.offsetParent !== null);
  if (!f.length) return;
  const [primero, ultimo] = [f[0], f.at(-1)];
  if (ev.shiftKey && document.activeElement === primero) { ev.preventDefault(); ultimo.focus(); }
  else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primero.focus(); }
}

/* Si cambia la vista con el cajón abierto, el cajón se va con ella. */
window.addEventListener('hashchange', () => cerrarDetalle(false));

/** Lista de filas para el cajón: [{ t, sub, der, tono, ir }]. */
export function listaDetalle(filas, vacio = 'Nada por mostrar.') {
  if (!filas.length) return `<p class="cajon__vacio">${esc(vacio)}</p>`;
  return `<ul class="cajon__lista">${filas.map(f => {
    const dentro = `<span class="cajon__fila-t"><b>${f.t}</b>${f.sub ? `<small>${f.sub}</small>` : ''}</span>
      ${f.der ? `<span class="cajon__der ${f.tono ? 'cajon__der--' + f.tono : ''}">${f.der}</span>` : ''}`;
    return `<li>${f.ir ? `<a class="cajon__fila" href="#/${esc(f.ir)}">${dentro}</a>` : `<div class="cajon__fila">${dentro}</div>`}</li>`;
  }).join('')}</ul>`;
}
