/* graficos.js · Gráficos de las dos plataformas, en SVG propio.

   ⛔ Sin librerías de terceros ni CDN: la política del sitio solo deja
      correr scripts propios, y en un sistema con datos de menores cada
      petición a un servidor ajeno manda la IP de quien mira.

   Cada función devuelve HTML (las vistas se pintan con plantillas). La
   interacción —tooltip al pasar, línea guía, foco con teclado— la pone UN
   escuchador delegado en el documento, así sirve para cualquier gráfico
   que se pinte después.

   Reglas de la guía de visualización que se cumplen aquí:
   - Marcas finas: columnas de máximo 24 px con la punta redondeada de 4 px
     y la base recta; líneas de 2 px; puntos de 8 px con anillo blanco.
   - Una sola escala por gráfico. Rejilla de 1 px, sólida y tenue.
   - El texto nunca lleva el color de la serie.
   - Todo gráfico trae su tabla («Ver los datos») para lectores de pantalla.
   - Paleta categórica validada (azul, mostaza, verde, violeta, en ese orden). */

import { esc } from './ui.js';

export const SERIE = ['#2A66C4', '#E3A52C', '#1E8A55', '#7E57C2'];
const AZUL = '#134291';
const REJILLA = '#ECECEF';
const TINTA = '#55555C';

const fmt = (n) => Number(n).toLocaleString('es-CO');
const num = (v) => {
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
/* Las cifras pequeñas llegan como «<5» por privacidad: se dibujan como 0 y
   se muestran tal cual llegaron. */
const etiqueta = (v) => (typeof v === 'string' && v.startsWith('<')) ? v : fmt(num(v));

/** Tope «redondo» del eje: 380 → 400, 1.284 → 1.500. */
function topeRedondo(max) {
  if (max <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  const pasos = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  return pasos.map(x => x * p).find(x => x >= max) ?? max;
}

function tablaDatos(titulo, filas, cols) {
  return `<details class="gr__datos"><summary>Ver los datos</summary>
    <table><caption class="sr-solo">${esc(titulo)}</caption>
      <thead><tr>${cols.map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${filas.map(f => `<tr>${f.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></details>`;
}

/**
 * Línea con área: la forma para «cómo viene cambiando» (asistencia por semana).
 * puntos: [{ x: 'etiqueta', v: número }]
 */
export function linea(titulo, puntos, { alto = 200, formatoX = (x) => x } = {}) {
  if (!puntos.length) return '';
  const W = 640, H = alto, mi = 40, md = 16, ms = 14, mb = 26;
  const vals = puntos.map(p => num(p.v));
  const tope = topeRedondo(Math.max(...vals));
  const x = (i) => mi + (puntos.length === 1 ? 0 : i * (W - mi - md) / (puntos.length - 1));
  const y = (v) => ms + (H - ms - mb) * (1 - v / tope);
  const camino = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${camino} L${x(vals.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const marcas = [0, tope / 2, tope];
  const banda = (W - mi - md) / Math.max(1, puntos.length - 1);
  const ultimo = vals.length - 1;
  return `<figure class="gr gr--linea" data-gr><div class="gr__lienzo" style="--alto:${H}px">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titulo)}" preserveAspectRatio="none">
      ${marcas.map(m => `<line x1="${mi}" x2="${W - md}" y1="${y(m)}" y2="${y(m)}" stroke="${REJILLA}" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('')}
      <path class="gr__area" d="${area}" fill="${SERIE[0]}" fill-opacity=".10"/>
      <path class="gr__trazo" d="${camino}" fill="none" stroke="${SERIE[0]}" stroke-width="2"
            stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" pathLength="1"/>
      <line class="gr__guia" x1="0" x2="0" y1="${ms}" y2="${H - mb}" stroke="${AZUL}" stroke-width="1" vector-effect="non-scaling-stroke"/>
      ${puntos.map((p, i) => `<rect class="gr__zona" x="${Math.max(0, x(i) - banda / 2)}" y="0" width="${banda}" height="${H}"
          fill="transparent" tabindex="0" data-cx="${x(i)}"
          data-tip="${esc(formatoX(p.x))}: ${esc(etiqueta(p.v))}" aria-label="${esc(formatoX(p.x))}: ${esc(etiqueta(p.v))}"/>`).join('')}
    </svg>
    <span class="gr__punto" style="left:${(x(ultimo) / W * 100).toFixed(2)}%;top:${(y(vals[ultimo]) / H * 100).toFixed(2)}%"></span>
    <div class="gr__eje-y">${marcas.slice().reverse().map(m => `<span>${fmt(Math.round(m))}</span>`).join('')}</div>
    <div class="gr__eje-x"><span>${esc(formatoX(puntos[0].x))}</span><span>${esc(formatoX(puntos[ultimo].x))}</span></div>
    <div class="gr__tip" role="status" aria-live="polite"></div></div>
    ${tablaDatos(titulo, puntos.map(p => [formatoX(p.x), etiqueta(p.v)]), ['Fecha', 'Valor'])}
  </figure>`;
}

/**
 * Columnas: la forma para comparar pocas magnitudes en el tiempo (niños por domingo).
 * barras: [{ x: 'etiqueta', v: número, destacar?: bool }]
 */
export function columnas(titulo, barras, { alto = 180, formatoX = (x) => x } = {}) {
  if (!barras.length) return '';
  const W = 640, H = alto, mi = 40, md = 8, ms = 18, mb = 26;
  const vals = barras.map(b => num(b.v));
  const tope = topeRedondo(Math.max(...vals));
  const banda = (W - mi - md) / barras.length;
  const ancho = Math.min(24 * 2.2, banda * 0.55);
  const y = (v) => ms + (H - ms - mb) * (1 - v / tope);
  const base = y(0);
  const marcas = [0, tope / 2, tope];
  return `<figure class="gr gr--columnas" data-gr><div class="gr__lienzo" style="--alto:${H}px">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titulo)}" preserveAspectRatio="none">
      ${marcas.map(m => `<line x1="${mi}" x2="${W - md}" y1="${y(m)}" y2="${y(m)}" stroke="${REJILLA}" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('')}
      ${barras.map((b, i) => {
        const cx = mi + banda * i + banda / 2, top = y(vals[i]), h = Math.max(0, base - top);
        const r = Math.min(4, h);
        const d = h <= 0 ? '' : `M${cx - ancho / 2},${base} V${top + r} Q${cx - ancho / 2},${top} ${cx - ancho / 2 + r},${top}
                 H${cx + ancho / 2 - r} Q${cx + ancho / 2},${top} ${cx + ancho / 2},${top + r} V${base} Z`;
        return `<path class="gr__barra" style="--i:${i}" d="${d}" fill="${b.destacar ? AZUL : SERIE[0]}" fill-opacity="${b.destacar ? 1 : .55}"/>
          <rect class="gr__zona" x="${mi + banda * i}" y="0" width="${banda}" height="${H}" fill="transparent" tabindex="0"
            data-cx="${cx}" data-tip="${esc(formatoX(b.x))}: ${esc(etiqueta(b.v))}" aria-label="${esc(formatoX(b.x))}: ${esc(etiqueta(b.v))}"/>`;
      }).join('')}
    </svg>
    <div class="gr__eje-y">${marcas.slice().reverse().map(m => `<span>${fmt(Math.round(m))}</span>`).join('')}</div>
    <div class="gr__eje-x gr__eje-x--todas">${barras.map(b => `<span>${esc(formatoX(b.x))}</span>`).join('')}</div>
    <div class="gr__tip" role="status" aria-live="polite"></div></div>
    ${tablaDatos(titulo, barras.map(b => [formatoX(b.x), etiqueta(b.v)]), ['', 'Valor'])}
  </figure>`;
}

/**
 * Barras horizontales: la forma para «cuánto hay de cada cosa» con nombres
 * largos (nuevos por estado, iglesias por tipo). Etiqueta y cifra al lado.
 * filas: [{ t: 'nombre', v: número, color?: '#hex', ir?: 'ruta' }]
 */
export function barrasH(titulo, filas, { total = null } = {}) {
  if (!filas.length) return '';
  const tope = Math.max(1, ...filas.map(f => num(f.v)));
  const suma = total ?? filas.reduce((a, f) => a + num(f.v), 0);
  return `<figure class="gr gr--barrash" aria-label="${esc(titulo)}">
    <ul class="gr__filas">
      ${filas.map((f, i) => {
        const pct = suma ? Math.round(100 * num(f.v) / suma) : 0;
        const cuerpo = `<span class="gr__nombre">${esc(f.t)}</span>
          <span class="gr__pista"><i style="--ancho:${(100 * num(f.v) / tope).toFixed(1)}%;--i:${i};background:${f.color ?? SERIE[0]}"></i></span>
          <span class="gr__valor"><b>${esc(etiqueta(f.v))}</b> <small>${pct} %</small></span>`;
        return `<li>${f.ir ? `<a href="#/${esc(f.ir)}" class="gr__fila">${cuerpo}</a>` : `<div class="gr__fila">${cuerpo}</div>`}</li>`;
      }).join('')}
    </ul>
  </figure>`;
}

/**
 * Dona: SOLO para partes de un todo con 2 a 4 partes. Leyenda siempre.
 * partes: [{ t, v, color? }] (color propio cuando el color ES la identidad, p. ej. N3 y N4)
 */
export function dona(titulo, partes, { centro = null, pie = '' } = {}) {
  const vals = partes.map(p => num(p.v));
  const suma = vals.reduce((a, b) => a + b, 0);
  if (!suma) return '';
  const R = 52, C = 2 * Math.PI * R, hueco = 2;
  let acum = 0;
  return `<figure class="gr gr--dona" data-gr>
    <div class="gr__dona">
      <svg viewBox="0 0 140 140" role="img" aria-label="${esc(titulo)}">
        <circle cx="70" cy="70" r="${R}" fill="none" stroke="${REJILLA}" stroke-width="16"/>
        ${partes.map((p, i) => {
          const largo = Math.max(0, C * vals[i] / suma - (partes.length > 1 ? hueco : 0));
          const s = `<circle class="gr__arco" style="--i:${i}" cx="70" cy="70" r="${R}" fill="none" stroke="${p.color ?? SERIE[i % SERIE.length]}"
            stroke-width="16" stroke-dasharray="${largo.toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-acum).toFixed(2)}"
            transform="rotate(-90 70 70)" tabindex="0" data-tip="${esc(p.t)}: ${esc(etiqueta(p.v))} (${Math.round(100 * vals[i] / suma)} %)"
            aria-label="${esc(p.t)}: ${esc(etiqueta(p.v))}"/>`;
          acum += C * vals[i] / suma;
          return s;
        }).join('')}
      </svg>
      <div class="gr__centro"><b>${esc(centro ?? fmt(suma))}</b><small>${esc(pie)}</small></div>
    </div>
    <ul class="gr__leyenda">${partes.map((p, i) => `<li><i style="background:${p.color ?? SERIE[i % SERIE.length]}"></i>${esc(p.t)}
      <b>${esc(etiqueta(p.v))}</b></li>`).join('')}</ul>
    <div class="gr__tip" role="status" aria-live="polite"></div>
  </figure>`;
}

/** Mini línea para una cifra (sin ejes ni interacción: la cifra manda). */
export function chispa(valores, { color = SERIE[0] } = {}) {
  const v = valores.map(num);
  if (v.length < 2) return '';
  const W = 120, H = 32, max = Math.max(...v), min = Math.min(...v), rango = max - min || 1;
  const pts = v.map((n, i) => `${(i * W / (v.length - 1)).toFixed(1)},${(H - 3 - (H - 6) * (n - min) / rango).toFixed(1)}`);
  return `<svg class="gr-chispa" viewBox="0 0 ${W} ${H}" aria-hidden="true" preserveAspectRatio="none">
    <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"
      stroke-linecap="round" vector-effect="non-scaling-stroke" pathLength="1" class="gr__trazo"/></svg>`;
}

/** Barra de avance (0-100) con su texto: obras, puesta en marcha, cupos. */
export function avance(pct, texto = '', { color = '#1E8A55' } = {}) {
  const p = Math.max(0, Math.min(100, num(pct)));
  return `<div class="gr-avance" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(texto || p + ' %')}">
    <span class="gr-avance__pista"><i style="--ancho:${p}%;background:${color}"></i></span>
    ${texto ? `<small>${esc(texto)}</small>` : ''}</div>`;
}

/** Variación frente a una referencia, con flecha y palabra (nunca solo color).
    ref: con qué se compara, en minúscula («el promedio de 415»). */
export function variacion(actual, referencia, { ref = 'la referencia' } = {}) {
  const a = num(actual), r = num(referencia);
  if (!r) return '';
  const pct = Math.round(100 * (a - r) / r);
  const clase = pct > 2 ? 'sube' : pct < -2 ? 'baja' : 'igual';
  const texto = clase === 'igual' ? `■ en línea con ${ref}`
    : `${clase === 'sube' ? '▲' : '▼'} ${Math.abs(pct)} % ${clase === 'sube' ? 'más' : 'menos'} que ${ref}`;
  return `<span class="gr-var gr-var--${clase}">${esc(texto)}</span>`;
}

/* ── Interacción: un solo escuchador para todos los gráficos ───────── */
function mostrar(zona) {
  const fig = zona.closest('[data-gr]');
  const tip = fig?.querySelector('.gr__tip');
  if (!tip) return;
  const svg = zona.ownerSVGElement ?? zona.closest('svg');
  const caja = (tip.parentElement ?? fig).getBoundingClientRect();
  const r = zona.getBoundingClientRect();
  tip.textContent = zona.dataset.tip;
  tip.classList.add('is-on');
  let left = r.left + r.width / 2 - caja.left;
  if (zona.dataset.cx && svg) {
    const vb = svg.viewBox.baseVal;
    left = (Number(zona.dataset.cx) / vb.width) * svg.getBoundingClientRect().width
         + (svg.getBoundingClientRect().left - caja.left);
    const guia = svg.querySelector('.gr__guia');
    if (guia) { guia.setAttribute('x1', zona.dataset.cx); guia.setAttribute('x2', zona.dataset.cx); guia.classList.add('is-on'); }
  }
  tip.style.left = Math.max(60, Math.min(caja.width - 60, left)) + 'px';
  fig.querySelectorAll('.is-activa').forEach(e => e.classList.remove('is-activa'));
  (zona.previousElementSibling?.classList.contains('gr__barra') ? zona.previousElementSibling : zona).classList.add('is-activa');
}
function ocultar(fig) {
  fig?.querySelector('.gr__tip')?.classList.remove('is-on');
  fig?.querySelector('.gr__guia')?.classList.remove('is-on');
  fig?.querySelectorAll('.is-activa').forEach(e => e.classList.remove('is-activa'));
}
if (typeof document !== 'undefined' && !window.__crGraficos) {
  window.__crGraficos = true;
  const sobre = (ev) => { const z = ev.target.closest?.('[data-tip]'); if (z && z.closest('[data-gr]')) mostrar(z); };
  document.addEventListener('pointerover', sobre);
  document.addEventListener('focusin', sobre);
  document.addEventListener('pointerout', (ev) => {
    const fig = ev.target.closest?.('[data-gr]');
    if (fig && !fig.contains(ev.relatedTarget)) ocultar(fig);
  });
  document.addEventListener('focusout', (ev) => ocultar(ev.target.closest?.('[data-gr]')));
}
