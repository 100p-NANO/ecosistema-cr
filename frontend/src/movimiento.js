/* movimiento.js · El movimiento de las dos plataformas, en un solo sitio.
   Lo usan la aplicación de los pastores (src/app.js) y la consola del
   Sistema Master (master/master.js). Las reglas visuales están en
   src/styles/bento-movimiento.css.

   ⛔ Con «reducir movimiento» encendido no se anima nada: las cifras salen
      con su valor final y los bloques aparecen quietos. */

const quieto = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Escalona la entrada de los bloques de una vista recién pintada. */
export function animarVista(nodo) {
  if (!nodo || quieto()) return;
  const escalonar = (padre) => {
    [...padre.children].forEach((h, i) => h.style.setProperty('--i', i));
    padre.classList.remove('cr-entra');
    void padre.offsetWidth;               // reinicia la animación si se repinta
    padre.classList.add('cr-entra');
  };
  escalonar(nodo);
  nodo.querySelectorAll('.bento').forEach(escalonar);
  contarCifras(nodo);
}

/** Las cifras marcadas con `data-cifra` cuentan desde cero hasta su valor.
    Solo enteros: una cifra con decimales o texto se deja como está. */
export function contarCifras(nodo) {
  if (quieto()) return;
  nodo.querySelectorAll('[data-cifra]').forEach(el => {
    const fin = Number(el.dataset.cifra);
    if (!Number.isInteger(fin) || fin <= 0) return;
    const ms = Math.min(900, 380 + fin * 4);
    const t0 = performance.now();
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      el.textContent = Math.round(fin * (1 - Math.pow(1 - p, 3))).toLocaleString('es-CO');
      if (p < 1) requestAnimationFrame(paso);
    };
    el.textContent = '0';
    requestAnimationFrame(paso);
  });
}
