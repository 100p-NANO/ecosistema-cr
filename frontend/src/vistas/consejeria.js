import { api } from '../api.js';
import { pantalla, formulario, tabla, chip, sedes, campoPersona, buscadorPersona, esc, vacio, avisar } from './comun.js';

/**
 * Consejería · lo más delicado que guarda esta iglesia.
 *
 * ⛔ Esta LISTA no trae notas. Ni una. Las notas viven solo dentro de la
 * ficha de un caso, y abrir esa ficha queda escrito en la bitácora de
 * lectura. No es una restricción técnica: es lo que hace que alguien se lo
 * piense antes de entrar a mirar por curiosidad.
 */
export function pintarConsejeria(c) {
  let form;
  const { recargar } = pantalla(c, {
    titulo: 'Consejería',
    intro: 'Las notas no aparecen en esta lista. Abrir un caso queda registrado.',
    cargar: () => api.obtener('/api/v1/consejeria/casos?limite=100'),
    pintar: (d) => (form?.html ?? '') + (d.casos.length
      ? tabla(d.casos, [
          { titulo: 'Consultante', pintar: k => `<a class="enlace-fila" href="#/consejeria/${esc(k.id)}">
              <strong>${esc(k.consultante)}</strong></a>` },
          { titulo: 'Tópico', pintar: k => `${esc(k.topico_nombre || k.topico)}
              ${k.requiere_profesional ? chip('profesional', 'distintivo--n4') : ''}` },
          { titulo: 'Estado', pintar: k => chip(k.estado, k.estado === 'abierto' ? 'distintivo--aviso' : '') },
          { titulo: 'Consejero', pintar: k => k.consejeros
              ? esc(k.consejeros) : chip('sin asignar', 'distintivo--n4') },
          { titulo: 'Abierto', pintar: k => `${k.dias_abierto} día(s)` },
          { titulo: 'Sesiones', campo: 'sesiones' },
        ])
      : vacio('🕊', 'Ningún caso abierto', 'Cuando alguien pida acompañamiento, ábralo aquí.')),
  });

  Promise.all([sedes(), api.obtener('/api/v1/consejeria/topicos')]).then(([op, t]) => {
    form = formulario({
      titulo: 'Abrir un caso',
      campos: [
        { nombre: 'sedeId', etiqueta: 'Sede', opciones: op, obligatorio: true },
        /* ⛔ 21 sep 2026 · Pedía «pegue aquí su identificador». */
        campoPersona('consultanteId', 'Quién pide acompañamiento', { obligatorio: true }),
        { nombre: 'topico', etiqueta: 'Tópico', obligatorio: true,
          opciones: t.topicos.map(x => ({ valor: x.codigo, texto: `${x.nombre}${x.requiere_profesional ? ' (profesional)' : ''}` })) },
      ],
      al: (d) => api.enviar('/api/v1/consejeria/casos', d),
    });
    recargar().then(() => form.enganchar(c, recargar));
  }).catch(e => avisar('No se pudo preparar el formulario: ' + e.message, 'error'));
}

/** La ficha. Aquí SÍ están las notas, y entrar deja rastro. */
export function pintarCaso(c, id) {
  c.innerHTML = `<p><a href="#/consejeria">← Volver a consejería</a></p><div id="k"></div>`;
  const z = c.querySelector('#k');
  const consejero = buscadorPersona('consejeroId', 'Consejero', { obligatorio: true });

  const { recargar } = pantalla(z, {
    titulo: 'Caso de consejería',
    cargar: () => api.obtener(`/api/v1/consejeria/casos/${id}`),
    pintar: (d) => `
      <div class="aviso aviso--aviso" role="status">
        Su entrada a este caso quedó registrada en la bitácora de lectura, con su nombre y la hora.
      </div>
      <div class="tarjeta" style="margin:1rem 0">
        <h2 style="margin:0 0 .3rem">${esc(d.caso.consultante)}</h2>
        <p class="etiqueta">${esc(d.caso.topico_nombre || d.caso.topico)} ·
          ${esc(d.caso.estado)}${d.caso.derivado_a ? ' · derivado a ' + esc(d.caso.derivado_a) : ''}</p>
      </div>

      ${d.caso.cerrado_en ? `<div class="tarjeta" style="margin-bottom:1rem"><p class="etiqueta">Cerrado</p>
          <p class="texto-largo">${esc(d.caso.desenlace ?? '')}</p></div>` : `
      <div class="acciones">
        <button class="boton boton--suave" id="b-sesion">Registrar sesión</button>
      </div>
      <!-- ⛔ 21 sep 2026 · Asignar pedía el identificador en un prompt, la
           nota larga se escribía en un prompt de una línea, y cerrar no
           pedía el desenlace que la base exige: siempre fallaba. -->
      <details class="tarjeta" style="margin-bottom:.75rem">
        <summary style="cursor:pointer;font-weight:600">Asignar consejero</summary>
        <form id="f-asignar" style="margin-top:1rem;display:grid;gap:.75rem">${consejero.html}
          <button class="boton" type="submit">Asignar</button></form>
      </details>
      <details class="tarjeta" style="margin-bottom:.75rem">
        <summary style="cursor:pointer;font-weight:600">Escribir una nota</summary>
        <form id="f-nota" style="margin-top:1rem;display:grid;gap:.75rem">
          <div class="campo"><label for="k-nota">Nota (queda solo dentro de este caso)</label>
            <textarea id="k-nota" name="texto" rows="5" minlength="5" required></textarea></div>
          <button class="boton" type="submit">Guardar nota</button></form>
      </details>
      <details class="tarjeta" style="margin-bottom:1rem">
        <summary style="cursor:pointer;font-weight:600">Cerrar o derivar el caso</summary>
        <form id="f-cerrar" style="margin-top:1rem;display:grid;gap:.75rem">
          <div class="campo"><label for="k-des">Cómo terminó</label>
            <textarea id="k-des" name="desenlace" rows="3" maxlength="400" placeholder="Retomó su grupo y ya no necesita acompañamiento"></textarea>
            <span class="ayuda">Obligatorio si se cierra. Si se deriva, basta con decir a dónde.</span></div>
          <div class="campo"><label for="k-der">Derivado a (solo si se deriva)</label>
            <input id="k-der" name="derivadoA" maxlength="200" placeholder="Psicología · Fundación …"></div>
          <button class="boton" type="submit">Cerrar el caso</button></form>
      </details>`}

      <h2>Consejeros</h2>
      ${d.asignaciones.length
        ? tabla(d.asignaciones, [
            { titulo: 'Consejero', pintar: a => `<strong>${esc(a.consejero)}</strong>` },
            { titulo: 'Rol', pintar: a => chip(a.rol) },
            { titulo: 'Estado', pintar: a => a.hasta ? '<span class="ayuda">terminó</span>' : chip('activo') },
          ])
        : vacio('🤝', 'Sin consejero asignado', 'Un caso sin nadie detrás es una persona esperando.')}

      <h2 style="margin-top:2rem">Sesiones</h2>
      ${d.sesiones.length
        ? tabla(d.sesiones, [
            { titulo: 'Fecha', pintar: s => esc(new Date(s.fecha).toLocaleDateString('es-CO')) },
            { titulo: 'Consejero', campo: 'consejero' },
            { titulo: 'Duración', pintar: s => s.duracion_min ? s.duracion_min + ' min' : '—' },
            { titulo: 'Asistió', pintar: s => s.asistio ? chip('sí') : chip('no', 'distintivo--aviso') },
          ])
        : vacio('🗓', 'Ninguna sesión', 'Registre la primera cuando ocurra.')}

      <h2 style="margin-top:2rem">Notas</h2>
      <p class="etiqueta">Solo se ven aquí dentro. No viajan en ninguna lista.</p>
      ${d.notas.length
        ? d.notas.map(n => `
            <div class="tarjeta" style="margin-bottom:.75rem">
              <p class="etiqueta">${esc(new Date(n.escrita_en).toLocaleString('es-CO'))}
                 ${n.autor ? '· ' + esc(n.autor) : ''}</p>
              <p style="white-space:pre-wrap;margin:.4rem 0 0">${esc(n.texto)}</p>
            </div>`).join('')
        : vacio('📝', 'Ninguna nota', 'Lo que se escriba aquí no sale de aquí.')}`,
  });

  consejero.enganchar(z);
  z.addEventListener('submit', async ev => {
    const f = ev.target;
    if (!['f-asignar', 'f-nota', 'f-cerrar'].includes(f.id)) return;
    ev.preventDefault();
    try {
      let r;
      if (f.id === 'f-asignar') {
        if (!f.elements.consejeroId.value) return avisar('Busque y elija al consejero.', 'error');
        r = await api.enviar(`/api/v1/consejeria/casos/${id}/asignar`, { consejeroId: f.elements.consejeroId.value });
      } else if (f.id === 'f-nota') {
        const texto = f.elements.texto.value.trim();
        if (texto.length < 5) return avisar('La nota necesita al menos 5 caracteres.', 'error');
        r = await api.enviar(`/api/v1/consejeria/casos/${id}/notas`, { texto });
      } else {
        const desenlace = f.elements.desenlace.value.trim(), derivadoA = f.elements.derivadoA.value.trim();
        if (!derivadoA && desenlace.length < 5) return avisar('Escriba cómo terminó el caso (al menos 5 caracteres).', 'error');
        if (!confirm(derivadoA ? `¿Derivar el caso a «${derivadoA}»?` : '¿Cerrar el caso?')) return;
        r = await api.enviar(`/api/v1/consejeria/casos/${id}/cerrar`,
          { ...(desenlace ? { desenlace } : {}), ...(derivadoA ? { derivadoA } : {}) });
      }
      avisar(r.mensaje, 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });
  z.addEventListener('click', async ev => {
    if (!ev.target.closest('#b-sesion')) return;
    const min = prompt('¿Cuántos minutos duró la sesión? (deje vacío si no lo sabe)');
    if (min === null) return;
    const d = {}; if (min && Number(min) > 0) d.duracionMin = Number(min);
    try {
      const r = await api.enviar(`/api/v1/consejeria/casos/${id}/sesiones`, d);
      avisar(r.mensaje, 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });
}
