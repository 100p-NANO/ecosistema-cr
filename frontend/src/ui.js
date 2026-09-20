/** Piezas de interfaz compartidas. Los tres estados de toda vista viven aquí,
    para que ninguna vista se los pueda saltar. */

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

export const cargando = (filas = 3) => `
  <div class="tarjeta" aria-busy="true" aria-live="polite">
    <span class="sr-solo">Cargando…</span>
    ${Array.from({ length: filas }, (_, i) =>
      `<div class="esqueleto" style="width:${90 - i * 18}%;margin-bottom:.6rem"></div>`).join('')}
  </div>`;

export const vacio = (icono, titulo, texto, accion = '') => `
  <div class="estado">
    <div class="estado__icono" aria-hidden="true">${icono}</div>
    <p class="estado__titulo">${esc(titulo)}</p>
    <p>${esc(texto)}</p>
    ${accion}
  </div>`;

export const error = (mensaje, peticionId, alReintentar = 'ui.reintentar()') => `
  <div class="estado estado--error" role="alert">
    <div class="estado__icono" aria-hidden="true">⚠</div>
    <p class="estado__titulo">No se pudo cargar</p>
    <p>${esc(mensaje)}</p>
    ${peticionId ? `<p class="etiqueta">código de la petición: ${esc(peticionId)}</p>` : ''}
    <p style="margin-top:1rem"><button class="boton boton--suave" onclick="${alReintentar}">Reintentar</button></p>
  </div>`;

export const distintivoNivel = (n) => {
  if (n >= 4) return '<span class="distintivo distintivo--n4">N4 · menores</span>';
  if (n === 3) return '<span class="distintivo distintivo--n3">N3 · sensible</span>';
  return `<span class="distintivo">N${n}</span>`;
};

/** ⛔ Tolerancia a la doble pulsación (B8.07): un botón que dispara dos
    veces crea dos aportes o dos check-ins. Se bloquea mientras trabaja. */
export function unaVez(boton, trabajo) {
  if (boton.dataset.trabajando === 'si') return;
  boton.dataset.trabajando = 'si';
  const texto = boton.textContent;
  boton.disabled = true; boton.textContent = 'Un momento…';
  Promise.resolve(trabajo()).finally(() => {
    boton.dataset.trabajando = 'no'; boton.disabled = false; boton.textContent = texto;
  });
}

export function avisar(mensaje, tipo = 'info') {
  const z = document.getElementById('avisos');
  if (!z) return;
  const d = document.createElement('div');
  d.className = `aviso aviso--${tipo}`;
  d.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  d.textContent = mensaje;
  z.prepend(d);
  setTimeout(() => d.remove(), 6000);
}
