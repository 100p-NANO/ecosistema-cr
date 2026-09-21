import { api } from '../api.js';
import { pantalla, formulario, tabla, chip, chipEstado, sedes, valoresDe, campoPersona, cabezaFicha, historial,
         zonaFicha, pedirTexto, esc, vacio, avisar } from './comun.js';

/** Legal · N3. Que un término no se venza por olvido y que lo actuado
    quede escrito sin poder reescribirse. */
export function pintarLegal(c) {
  let form;
  const { recargar } = pantalla(c, {
    titulo: 'Legal',
    intro: 'Dato sensible (N3). Ordenado por término; toda lectura queda registrada.',
    cargar: () => api.obtener('/api/v1/legal?limite=100'),
    pintar: (d) => (d.puede_crear ? form?.html ?? '' : '') + (d.asuntos.length
      ? tabla(d.asuntos, [
          { titulo: 'Asunto', pintar: a => `<a class="enlace-fila" href="#/legal/${esc(a.id)}"><strong>${esc(a.titulo)}</strong></a>
              <br><span class="ayuda">${esc(a.tipo_nombre ?? a.tipo)} · ${esc(a.sede)}</span>` },
          { titulo: 'Estado', pintar: a => chipEstado(a.estado) },
          { titulo: 'Término', pintar: a => a.vence ? `${esc(a.vence)}${a.vence_pronto ? ' ' + chip('pronto', 'distintivo--n4') : ''}` : '·' },
          { titulo: 'Actuaciones', campo: 'actuaciones' },
          { titulo: 'Responsable', pintar: a => esc(a.responsable ?? '·') },
        ])
      : vacio('⚖', 'Ningún asunto', 'Contratos, arriendos, derechos de petición y tutelas se llevan aquí.')),
  });
  Promise.all([sedes(), valoresDe('tipo_asunto_legal')]).then(([op, tipos]) => {
    form = formulario({
      titulo: 'Abrir un asunto',
      campos: [
        { nombre: 'sedeId', etiqueta: 'Sede', opciones: op, obligatorio: true },
        { nombre: 'tipo', etiqueta: 'Tipo', opciones: tipos, obligatorio: true },
        { nombre: 'titulo', etiqueta: 'Asunto', obligatorio: true, minimo: 5 },
        { nombre: 'contraparte', etiqueta: 'Contraparte' },
        campoPersona('responsableId', 'Responsable'),
        { nombre: 'venceEn', etiqueta: 'Término', tipo: 'date', ayuda: 'La fecha que no se puede pasar.' },
      ],
      boton: 'Abrir asunto',
      al: (d) => api.enviar('/api/v1/legal', d),
    });
    recargar().then(() => form.enganchar(c, recargar));
  }).catch(e => avisar('No se pudo preparar el formulario: ' + e.message, 'error'));
}

export function pintarAsuntoLegal(c, id) {
  const z = zonaFicha(c, 'legal', 'Volver a legal');
  const { recargar } = pantalla(z, {
    titulo: 'Asunto legal',
    intro: 'Esta lectura quedó registrada en la bitácora (dato N3).',
    cargar: () => api.obtener(`/api/v1/legal/${id}`),
    pintar: (d) => {
      const a = d.asunto;
      return `<div class="tarjeta">
        ${cabezaFicha(a.titulo, `${a.tipo_nombre ?? a.tipo} · ${a.sede}${a.contraparte ? ' · contraparte: ' + a.contraparte : ''}`,
          [chipEstado(a.estado), a.vence_en ? chip('término ' + String(a.vence_en).slice(0, 10)) : ''].filter(Boolean))}
        ${a.responsable ? `<p>Responsable: <strong>${esc(a.responsable)}</strong></p>` : ''}
        ${a.resultado ? `<h3>Cómo terminó</h3><p class="texto-largo">${esc(a.resultado)}</p>` : ''}
      </div>
      ${d.puede_editar ? `<div class="acciones">
        ${a.estado === 'abierto' ? `<button class="boton boton--suave" data-enviar="/api/v1/legal/${esc(id)}/estado" data-cuerpo='{"estado":"en_tramite"}'>En trámite</button>` : ''}
        ${a.estado !== 'cerrado' ? '<button class="boton" data-cerrar>Cerrar con resultado</button>'
          : `<button class="boton boton--suave" data-enviar="/api/v1/legal/${esc(id)}/estado" data-cuerpo='{"estado":"en_tramite"}'>Reabrir</button>`}
      </div>
      <details class="tarjeta" style="margin-top:1rem">
        <summary style="cursor:pointer;font-weight:600">Registrar una actuación</summary>
        <form id="actuar" style="margin-top:1rem;display:grid;gap:.75rem">
          <div class="campo"><label for="a-cont">Qué se hizo</label>
            <textarea id="a-cont" name="contenido" rows="3" minlength="5" required></textarea>
            <span class="ayuda">Una actuación no se puede editar ni borrar después.</span></div>
          <button class="boton" type="submit">Registrar</button>
        </form>
      </details>` : ''}
      <h2 style="margin-top:1.5rem">Actuaciones</h2>
      <div class="tarjeta">${historial(d.actuaciones.map(n => ({ cuando: n.cuando, quien: n.autor, texto: n.contenido })),
        'Ninguna actuación registrada.')}</div>`;
    },
  });
  z.addEventListener('submit', async ev => {
    if (ev.target.id !== 'actuar') return;
    ev.preventDefault();
    const contenido = ev.target.elements.contenido.value.trim();
    if (contenido.length < 5) return avisar('Escriba al menos 5 caracteres.', 'error');
    try {
      const r = await api.enviar(`/api/v1/legal/${id}/actuaciones`, { contenido });
      avisar(r.mensaje, 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });
  z.addEventListener('click', async ev => {
    if (!ev.target.closest('[data-cerrar]')) return;
    const resultado = pedirTexto('¿Cómo terminó el asunto?', 5);
    if (!resultado) return;
    try {
      const r = await api.enviar(`/api/v1/legal/${id}/estado`, { estado: 'cerrado', resultado });
      avisar(r.mensaje, 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });
}
