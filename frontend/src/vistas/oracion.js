import { api } from '../api.js';
import { pantalla, formulario, tabla, chip, chipEstado, sedes, valoresDe, campoPersona, cabezaFicha, historial,
         zonaFicha, pedirTexto, esc, vacio, avisar } from './comun.js';

/**
 * Oración · N3.
 *
 * ⛔ Lo que alguien confía al pedir oración no circula. Las tres puertas
 * están en la base: lo confidencial solo lo ven quien lo registró y los
 * pastores; lo que no se compartió no lo ve el intercesor; toda lectura
 * deja rastro. Esta pantalla solo lo dice claro: la lista no trae el
 * detalle, la ficha sí, y la ficha avisa que su lectura queda registrada.
 */
export function pintarOracion(c) {
  let form, estado = 'abiertas';
  const { recargar } = pantalla(c, {
    titulo: 'Oración',
    intro: 'Dato sensible (N3). La lista no muestra el detalle; abrir una petición queda registrado.',
    barra: `<div class="filtros">
      <label class="sr-solo" for="f-estado-or">Mostrar</label>
      <select id="f-estado-or">
        <option value="abiertas">Abiertas y en oración</option>
        <option value="respondida">Respondidas</option>
        <option value="cerrada">Cerradas</option>
        <option value="">Todas</option>
      </select></div>`,
    cargar: async () => {
      const q = estado === 'abiertas' ? '' : estado ? '&estado=' + estado : '';
      const d = await api.obtener('/api/v1/oracion?limite=100' + q);
      if (estado === 'abiertas') d.peticiones = d.peticiones.filter(p => ['abierta', 'en_oracion'].includes(p.estado));
      return d;
    },
    pintar: (d) => (d.puede_registrar ? form?.html ?? '' : '') + (d.peticiones.length
      ? tabla(d.peticiones, [
          { titulo: 'Petición', pintar: p => `<a class="enlace-fila" href="#/oracion/${esc(p.id)}"><strong>${esc(p.resumen)}</strong></a>
              <br><span class="ayuda">${esc(p.quien ?? '')} · ${esc(p.fecha)}</span>
              ${p.confidencial ? ' ' + chip('confidencial', 'distintivo--n3') : ''}${p.compartida ? ' ' + chip('compartida') : ''}` },
          { titulo: 'Categoría', pintar: p => esc(p.categoria_nombre ?? p.categoria) },
          { titulo: 'Estado', pintar: p => chipEstado(p.estado) },
          { titulo: 'Oraciones', pintar: p => p.veces_orada
              ? `<strong>${p.veces_orada}</strong><br><span class="ayuda">última ${esc(p.ultima_oracion)}</span>`
              : chip('nadie ha orado', 'distintivo--aviso') },
          { titulo: 'Sede', campo: 'sede' },
        ])
      : vacio('🙏', estado === 'abiertas' ? 'Ninguna petición abierta' : 'Nada en esta lista',
              'Las peticiones del formulario público y las que registre el equipo aparecen aquí.')),
  });

  c.querySelector('#f-estado-or').addEventListener('change', ev => { estado = ev.target.value; recargar(); });

  Promise.all([sedes(), valoresDe('categoria_oracion')]).then(([op, cats]) => {
    const campos = [
      { nombre: 'sedeId', etiqueta: 'Sede', opciones: op, obligatorio: true },
      campoPersona('personaId', 'Quién pide (si ya está registrada)', { ayuda: 'Opcional: si no está en el sistema, escriba su nombre abajo.' }),
      { nombre: 'nombreContacto', etiqueta: 'Nombre (si no está registrada)' },
      { nombre: 'contacto', etiqueta: 'Teléfono o correo para acompañarla', ayuda: 'Solo lo verá quien abra la ficha.' },
      { nombre: 'categoria', etiqueta: 'Categoría', opciones: cats, obligatorio: true },
      { nombre: 'resumen', etiqueta: 'Resumen en una línea', obligatorio: true, minimo: 3, placeholder: 'Salud de su hija' },
      { nombre: 'detalle', etiqueta: 'Detalle', multilinea: true },
      { nombre: 'confidencial', etiqueta: 'Confidencial: solo la leen los pastores', tipo: 'checkbox' },
      { nombre: 'compartir', etiqueta: 'Compartirla con el equipo de intercesión', tipo: 'checkbox' },
    ];
    campos.validar = (d) => {
      if (!d.personaId && !d.nombreContacto) return 'Diga quién pide la oración: elija a la persona o escriba su nombre.';
      if (d.confidencial && d.compartir) return 'Una petición confidencial no se comparte con el equipo de intercesión.';
      return null;
    };
    form = formulario({ titulo: 'Registrar una petición', campos, boton: 'Registrar',
      al: (d) => api.enviar('/api/v1/oracion', d) });
    recargar().then(() => form.enganchar(c, recargar));
  }).catch(e => avisar('No se pudo preparar el formulario: ' + e.message, 'error'));
}

export function pintarPeticionOracion(c, id) {
  const z = zonaFicha(c, 'oracion', 'Volver a oración');
  const { recargar } = pantalla(z, {
    titulo: 'Petición de oración',
    intro: 'Esta lectura quedó registrada en la bitácora (dato N3).',
    cargar: () => api.obtener(`/api/v1/oracion/${id}`),
    pintar: (d) => {
      const p = d.peticion;
      const abierta = ['abierta', 'en_oracion'].includes(p.estado);
      return `
      <div class="tarjeta">
        ${cabezaFicha(p.resumen, `${p.categoria_nombre ?? p.categoria} · ${p.sede} · ${p.creada}${p.origen === 'formulario_publico' ? ' · llegó por el formulario público' : ''}`,
          [chipEstado(p.estado), p.confidencial ? chip('confidencial', 'distintivo--n3') : '',
           p.compartida ? chip('compartida con intercesores') : ''].filter(Boolean))}
        <p><strong>${esc(p.quien ?? '')}</strong>${p.contacto ? ` · ${esc(p.contacto)}` : ''}</p>
        ${p.detalle ? `<p class="texto-largo">${esc(p.detalle)}</p>` : '<p class="ayuda">Sin detalle.</p>'}
        ${p.respuesta ? `<h3 style="margin-top:1rem">Respuesta</h3><p class="texto-largo">${esc(p.respuesta)}</p>
          <p class="ayuda">Respondida el ${esc(p.respondida_en)}</p>` : ''}
        ${p.registrada_por ? `<p class="ayuda">Registrada por ${esc(p.registrada_por)}</p>` : ''}
      </div>

      ${abierta ? `
      <details class="tarjeta" style="margin-top:1rem" open>
        <summary style="cursor:pointer;font-weight:600">Oré por esta petición</summary>
        <form id="orar" style="margin-top:1rem;display:grid;gap:.75rem">
          <div class="campo"><label for="o-nota">Nota (opcional)</label>
            <input id="o-nota" name="nota" maxlength="300" placeholder="Oramos en la vigilia del jueves"></div>
          <button class="boton" type="submit">Registrar que oré</button>
        </form>
      </details>` : ''}

      ${d.puede_responder && p.estado !== 'cerrada' ? `
      <div class="acciones">
        ${p.estado === 'abierta' ? `<button class="boton boton--suave" data-enviar="/api/v1/oracion/${esc(p.id)}/estado"
            data-cuerpo='{"estado":"en_oracion"}'>Marcar en oración</button>` : ''}
        ${p.estado !== 'respondida' ? `<button class="boton" data-responder>Registrar la respuesta</button>` : ''}
        <button class="boton boton--suave" data-enviar="/api/v1/oracion/${esc(p.id)}/estado" data-cuerpo='{"estado":"cerrada"}'
            data-confirmar="¿Cerrar la petición? Cerrada ya no cambia.">Cerrar</button>
      </div>` : ''}

      <h2 style="margin-top:1.5rem">Quién ha orado</h2>
      <div class="tarjeta">${historial(d.oraciones.map(o => ({ cuando: o.cuando, quien: o.quien, texto: o.nota ?? '' })),
        'Nadie ha registrado oración todavía.')}</div>`;
    },
  });

  z.addEventListener('submit', async ev => {
    if (ev.target.id !== 'orar') return;
    ev.preventDefault();
    try {
      const r = await api.enviar(`/api/v1/oracion/${id}/orar`, { nota: ev.target.elements.nota.value.trim() || undefined });
      avisar(r.mensaje, 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });
  z.addEventListener('click', async ev => {
    if (!ev.target.closest('[data-responder]')) return;
    const respuesta = pedirTexto('¿Cómo respondió Dios? (queda como testimonio con la petición)', 3);
    if (!respuesta) return;
    try {
      const r = await api.enviar(`/api/v1/oracion/${id}/estado`, { estado: 'respondida', respuesta });
      avisar(r.mensaje, 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });
}
