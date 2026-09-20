/**
 * La cola de lo que no se pudo enviar.
 *
 * ⛔ POR QUÉ EXISTE (checklist B8.06): el pico del sistema es el domingo a
 * las 10 de la mañana, con 2.500 niños entrando a sus salas, y el wifi del
 * templo es exactamente lo que falla a esa hora. Un check-in que depende de
 * la red es un check-in que un domingo no ocurre, y entonces la sala vuelve
 * al papel y el sistema pierde la confianza de quien lo usa.
 *
 * Lo que se encola se guarda en el navegador, se reintenta al volver la
 * conexión, y mientras tanto la persona ya recibió su comprobante.
 */
const LLAVE = 'cr.cola';

function leer() {
  try { return JSON.parse(localStorage.getItem(LLAVE) ?? '[]'); } catch { return []; }
}
function escribir(c) {
  try { localStorage.setItem(LLAVE, JSON.stringify(c)); } catch { /* sin espacio: se pierde la cola, no la app */ }
}

export const cola = {
  pendientes: () => leer().length,

  encolar(operacion) {
    const c = leer();
    c.push({ ...operacion, id: crypto.randomUUID(), encolado_en: new Date().toISOString(), intentos: 0 });
    escribir(c);
    window.dispatchEvent(new CustomEvent('cr:cola-cambio'));
  },

  /** Reintenta en orden. Lo que sigue fallando por RED se queda; lo que
      falla porque el servidor lo RECHAZA se saca y se avisa: reintentar mil
      veces algo que el servidor no acepta solo esconde el problema. */
  async vaciar(enviar) {
    const c = leer();
    if (!c.length) return { enviados: 0, rechazados: [] };
    const quedan = [], rechazados = [];
    let enviados = 0;
    for (const op of c) {
      try { await enviar(op); enviados++; }
      catch (e) {
        if (e?.estado >= 400 && e?.estado < 500) rechazados.push({ op, motivo: e.message });
        else { op.intentos++; quedan.push(op); }
      }
    }
    escribir(quedan);
    window.dispatchEvent(new CustomEvent('cr:cola-cambio'));
    return { enviados, rechazados };
  },
};

export function vigilarConexion(alCambiar) {
  const avisar = () => alCambiar(navigator.onLine);
  window.addEventListener('online', avisar);
  window.addEventListener('offline', avisar);
  avisar();
}
