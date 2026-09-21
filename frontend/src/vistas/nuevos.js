import { api } from '../api.js';
import { pantalla, tabla, chip, chipEstado, zonaFicha, cabezaFicha, historial, fechaHora, esc, vacio, avisar } from './comun.js';

/**
 * Nuevos · la bandeja del coordinador (documento M-Nuevos).
 * ⛔ Lo que protege: que quien llenó el formulario un domingo reciba la
 * llamada. Primero lo ATRASADO; cada contacto queda escrito con cómo
 * reaccionó la persona y cuál es el siguiente paso.
 */
export function pintarNuevos(c) {
  let estado = '';
  const { recargar } = pantalla(c, {
    titulo: 'Nuevos',
    intro: 'Quien llegó y todavía no está integrado. Primero lo atrasado.',
    barra: `<div class="filtros"><label class="sr-solo" for="f-nuevo-estado">Estado</label>
      <select id="f-nuevo-estado"><option value="">En seguimiento (todos)</option>
        <option value="nuevo">Sin contactar</option><option value="contactado">Contactados</option>
        <option value="en_seguimiento">En seguimiento</option><option value="convertido">Integrados</option>
        <option value="no_interesado">No interesados</option></select></div>`,
    cargar: () => api.obtener('/api/v1/nuevos/dashboard?limite=100' + (estado ? '&estado=' + estado : '')),
    pintar: (d) => d.nuevos.length ? tabla(d.nuevos, [
        { titulo: 'Persona', pintar: n => `<a class="enlace-fila" href="#/nuevos/${esc(n.id)}"><strong>${esc(n.nombre)}</strong></a>
            <br><span class="ayuda">${esc(n.telefono ?? n.email ?? 'sin contacto')}</span>` },
        { titulo: 'Próxima acción', pintar: n => n.proxima_accion === 'ATRASADO'
            ? chip('atrasado', 'distintivo--n4') : esc(n.proxima_accion ?? '·') },
        { titulo: 'Estado', pintar: n => chipEstado(n.estado) },
        { titulo: 'Contactos', pintar: n => `${esc(n.contactos ?? 0)}${n.ultimo_contacto ? `<br><span class="ayuda">último ${esc(String(n.ultimo_contacto).slice(0, 10))}</span>` : ''}` },
        { titulo: 'Llegó', pintar: n => esc(String(n.registrado_en ?? '').slice(0, 10)) },
      ]) : vacio('👋', 'Nadie en esta bandeja', 'Quien llene el formulario de la sede aparece aquí.'),
  });
  c.querySelector('#f-nuevo-estado').addEventListener('change', ev => { estado = ev.target.value; recargar(); });
}

export function pintarNuevo(c, id) {
  const z = zonaFicha(c, 'nuevos', 'Volver a nuevos');
  const { recargar } = pantalla(z, {
    titulo: 'Seguimiento',
    cargar: () => api.obtener(`/api/v1/nuevos/${id}/historial`),
    pintar: (n) => `<div class="tarjeta">
        ${cabezaFicha(n.nombre, `llegó ${String(n.registrado_en ?? '').slice(0, 10)}${n.como_supo ? ' · supo por ' + n.como_supo : ''}`,
          [chipEstado(n.estado), n.prioridad ? chip('prioridad ' + n.prioridad) : ''].filter(Boolean))}
        <p>${n.telefono ? `<a href="tel:${esc(n.telefono)}">${esc(n.telefono)}</a>` : ''}${n.telefono && n.email ? ' · ' : ''}${n.email ? `<a href="mailto:${esc(n.email)}">${esc(n.email)}</a>` : ''}</p>
        ${n.comentarios ? `<p class="texto-largo">${esc(n.comentarios)}</p>` : ''}
      </div>
      ${n.estado !== 'convertido' ? `
      <details class="tarjeta" style="margin-top:1rem" open>
        <summary style="cursor:pointer;font-weight:600">Registrar un contacto</summary>
        <form id="contacto" style="margin-top:1rem;display:grid;gap:.75rem">
          <div class="campo"><label for="nc-tipo">Cómo</label><select id="nc-tipo" name="tipo_contacto" required>
            ${['llamada', 'whatsapp', 'visita', 'email', 'mensaje'].map(t => `<option value="${t}">${t}</option>`).join('')}</select></div>
          <div class="campo"><label for="nc-resumen">Qué se habló</label><textarea id="nc-resumen" name="resumen" rows="2" required></textarea></div>
          <div class="campo"><label for="nc-reaccion">Cómo reaccionó</label><select id="nc-reaccion" name="reaccion" required>
            <option value="interesado">Interesado</option><option value="dudoso">Dudoso</option>
            <option value="no_contesto">No contestó</option><option value="no_interesado">No interesado</option></select></div>
          <div class="campo"><label for="nc-sig">Siguiente paso</label><input id="nc-sig" name="siguiente_paso"></div>
          <div class="campo"><label for="nc-fecha">Próximo contacto</label><input id="nc-fecha" name="fecha_siguiente_contacto" type="date"></div>
          <button class="boton" type="submit">Registrar contacto</button>
        </form>
      </details>
      <div class="acciones"><button class="boton boton--suave" data-convertir>Integrar como miembro</button></div>` : ''}
      <h2 style="margin-top:1.5rem">Contactos</h2>
      <div class="tarjeta">${historial((n.historial_contactos ?? []).map(k => ({
          cuando: fechaHora(k.ocurrido_en), quien: `${k.tipo} · ${String(k.reaccion ?? '').replace('_', ' ')}`,
          texto: k.resumen + (k.siguiente_paso ? `\nSiguiente: ${k.siguiente_paso}` : '') })), 'Nadie lo ha contactado todavía.')}</div>`,
  });
  z.addEventListener('submit', async ev => {
    if (ev.target.id !== 'contacto') return;
    ev.preventDefault();
    const f = ev.target, d = {};
    for (const k of ['tipo_contacto', 'resumen', 'reaccion', 'siguiente_paso', 'fecha_siguiente_contacto']) {
      const v = f.elements[k].value.trim(); if (v) d[k] = v;
    }
    if (!d.resumen) return avisar('Escriba qué se habló.', 'error');
    try {
      const r = await api.enviar(`/api/v1/nuevos/${id}/registrar-contacto`, d);
      avisar(r.mensaje ?? 'Contacto registrado.', 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });
  z.addEventListener('click', async ev => {
    if (!ev.target.closest('[data-convertir]')) return;
    if (!confirm('¿Integrarlo como miembro? Pasa al registro de personas de la sede.')) return;
    try {
      const r = await api.enviar(`/api/v1/nuevos/${id}/convertir-miembro`, {});
      avisar(r.mensaje ?? 'Integrado.', 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });
}
