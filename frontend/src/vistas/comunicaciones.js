import { api } from '../api.js';
import { pantalla, formulario, tabla, chip, chipEstado, sedes, cabezaFicha, zonaFicha, pedirTexto,
         esc, vacio, avisar } from './comun.js';

const FINALIDAD = { convocatoria: 'Convocatoria a actividades', pastoral: 'Acompañamiento pastoral', emergencia: 'Emergencia' };
const DESTINO = { miembros_sede: 'Los miembros de la sede', grupo: 'Un grupo', servidores: 'Los servidores de la sede' };

/**
 * Comunicaciones · envíos a muchas personas.
 * ⛔ Nada masivo sale sin que lo apruebe OTRA persona, y hay un freno que
 * lo detiene todo. A quien no autorizó ese tipo de mensaje no se le
 * escribe: se le cuenta, y la ficha lo dice ANTES de aprobar.
 */
export function pintarComunicaciones(c, sesion) {
  let form;
  const redEntera = !!sesion?.alcance?.todaLaRed;
  const { recargar } = pantalla(c, {
    titulo: 'Comunicaciones',
    intro: 'Lo escribe una persona y lo aprueba otra. Solo le llega a quien autorizó ese tipo de mensaje.',
    cargar: () => api.obtener('/api/v1/comunicaciones?limite=100'),
    pintar: (d) => `
      <div class="freno ${d.freno?.activo ? 'freno--puesto' : ''}">
        <span>${d.freno?.activo ? `<strong>Freno puesto:</strong> no sale ningún envío masivo. ${esc(d.freno.motivo ?? '')}`
          : 'El freno de envíos masivos está quieto: lo aprobado se puede enviar.'}</span>
        ${redEntera ? `<button class="boton ${d.freno?.activo ? '' : 'boton--peligro'}" data-freno="${d.freno?.activo ? 'quitar' : 'poner'}">
          ${d.freno?.activo ? 'Quitar el freno' : 'Poner el freno'}</button>` : ''}
      </div>
      ${form?.html ?? ''}
      ${d.comunicaciones.length ? tabla(d.comunicaciones, [
          { titulo: 'Comunicación', pintar: k => `<a class="enlace-fila" href="#/comunicaciones/${esc(k.id)}"><strong>${esc(k.asunto)}</strong></a>
              <br><span class="ayuda">${esc(FINALIDAD[k.finalidad] ?? k.finalidad)} · ${esc(k.grupo ?? DESTINO[k.destinatarios] ?? '')}</span>` },
          { titulo: 'Estado', pintar: k => chipEstado(k.estado) },
          { titulo: 'Escribió', pintar: k => `${esc(k.autor ?? '—')}${k.es_mia ? ' (usted)' : ''}` },
          { titulo: 'Aprobó', pintar: k => esc(k.aprobo ?? '—') },
          { titulo: 'Resultado', pintar: k => k.estado === 'enviada'
              ? `${esc(k.encolados)} en cola${k.omitidos_sin_consentimiento ? `<br><span class="ayuda">${esc(k.omitidos_sin_consentimiento)} sin autorización</span>` : ''}` : '—' },
        ])
      : vacio('✉', 'Ninguna comunicación', 'Escriba la primera con el formulario de arriba.')}`,
  });

  c.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-freno]');
    if (!b) return;
    const poner = b.dataset.freno === 'poner';
    const motivo = pedirTexto(poner ? '¿Por qué se detienen los envíos? (queda en la auditoría)' : '¿Por qué se quita el freno?', 5);
    if (!motivo) return;
    try {
      const r = await api.enviar('/api/v1/comunicaciones/freno', { activo: poner, motivo });
      avisar(r.mensaje, poner ? 'aviso' : 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });

  Promise.all([sedes(), api.obtener('/api/v1/grupos?limite=200').catch(() => ({ grupos: [] }))]).then(([op, g]) => {
    const campos = [
      { nombre: 'sedeId', etiqueta: 'Sede', opciones: op, obligatorio: true },
      { nombre: 'finalidad', etiqueta: 'Para qué es', obligatorio: true,
        opciones: Object.entries(FINALIDAD).map(([valor, texto]) => ({ valor, texto })),
        ayuda: 'Solo le llega a quien autorizó este tipo de mensaje (Ley 1581).' },
      { nombre: 'destinatarios', etiqueta: 'A quién', obligatorio: true,
        opciones: Object.entries(DESTINO).map(([valor, texto]) => ({ valor, texto })) },
      { nombre: 'grupoId', etiqueta: 'Grupo (solo si es para un grupo)', vacio: 'Ninguno',
        opciones: (g.grupos ?? []).filter(x => !x.cerrado).map(x => ({ valor: x.id, texto: `${x.nombre} · ${x.sede}` })) },
      { nombre: 'asunto', etiqueta: 'Asunto', obligatorio: true, minimo: 5 },
      { nombre: 'cuerpo', etiqueta: 'Mensaje', multilinea: true, obligatorio: true, minimo: 20,
        ayuda: 'Deje una línea en blanco entre párrafos.' },
    ];
    campos.validar = (d) => d.destinatarios === 'grupo' && !d.grupoId ? 'Elija el grupo al que va el envío.'
      : d.destinatarios !== 'grupo' && d.grupoId ? 'Quite el grupo: el envío no es para un grupo.' : null;
    form = formulario({ titulo: 'Escribir una comunicación', campos, boton: 'Guardar borrador',
      al: (d) => api.enviar('/api/v1/comunicaciones', d) });
    recargar().then(() => form.enganchar(c, recargar));
  }).catch(e => avisar('No se pudo preparar el formulario: ' + e.message, 'error'));
}

export function pintarComunicacion(c, id) {
  const z = zonaFicha(c, 'comunicaciones', 'Volver a comunicaciones');
  const { recargar } = pantalla(z, {
    titulo: 'Comunicación',
    cargar: () => api.obtener(`/api/v1/comunicaciones/${id}`),
    pintar: (d) => {
      const k = d.comunicacion, a = d.alcance ?? {};
      return `
      ${cabezaFicha(k.asunto, `${FINALIDAD[k.finalidad] ?? k.finalidad} · ${k.grupo ?? DESTINO[k.destinatarios]} · ${k.sede}`,
        [chipEstado(k.estado), chip('escribió ' + (k.autor ?? '—')), k.aprobo ? chip('aprobó ' + k.aprobo, 'distintivo--ok') : ''].filter(Boolean))}
      <div class="cifras">
        <div class="cifra"><b>${esc(a.personas ?? 0)}</b><span>personas en el destino</span></div>
        <div class="cifra"><b>${esc(a.recibirian ?? 0)}</b><span>lo recibirían</span></div>
        <div class="cifra ${a.sin_autorizacion ? 'cifra--alerta' : ''}"><b>${esc(a.sin_autorizacion ?? 0)}</b><span>no autorizaron este tipo de mensaje</span></div>
        <div class="cifra"><b>${esc(a.sin_correo ?? 0)}</b><span>sin correo registrado</span></div>
      </div>
      <div class="vista-previa"><h3>${esc(k.asunto)}</h3><p class="texto-largo">${esc(k.cuerpo)}</p></div>
      <div class="acciones">
        ${k.estado === 'borrador' && d.puede_aprobar ? `<button class="boton" data-enviar="/api/v1/comunicaciones/${esc(id)}/aprobar"
            data-confirmar="¿Aprobar este envío tal como está? Lo recibirán ${esc(a.recibirian ?? 0)} persona(s).">Aprobar</button>` : ''}
        ${k.estado === 'borrador' && d.es_mia ? '<span class="ayuda">Usted lo escribió: lo aprueba otra persona.</span>' : ''}

        ${k.estado === 'aprobada' ? `<button class="boton" data-enviar="/api/v1/comunicaciones/${esc(id)}/enviar"
            data-confirmar="¿Enviar ahora a ${esc(a.recibirian ?? 0)} persona(s)?">Enviar</button>
          <button class="boton boton--suave" data-enviar="/api/v1/comunicaciones/${esc(id)}/devolver"
            data-confirmar="Volverá a borrador y tendrá que aprobarse otra vez. ¿Seguir?">Devolver a borrador</button>` : ''}
        ${['borrador', 'aprobada'].includes(k.estado) ? `<button class="boton boton--suave" data-enviar="/api/v1/comunicaciones/${esc(id)}/cancelar"
            data-confirmar="¿Cancelar la comunicación?">Cancelar</button>` : ''}
      </div>
      ${k.estado === 'borrador' ? `<details class="tarjeta" style="margin-top:1rem">
        <summary style="cursor:pointer;font-weight:600">Editar el texto</summary>
        <form id="editar-com" style="margin-top:1rem;display:grid;gap:.75rem">
          <div class="campo"><label for="ec-asunto">Asunto</label>
            <input id="ec-asunto" name="asunto" minlength="5" maxlength="160" value="${esc(k.asunto)}" required></div>
          <div class="campo"><label for="ec-cuerpo">Mensaje</label>
            <textarea id="ec-cuerpo" name="cuerpo" rows="8" minlength="20" maxlength="5000" required>${esc(k.cuerpo)}</textarea></div>
          <button class="boton" type="submit">Guardar cambios</button>
        </form>
      </details>` : ''}
      ${k.estado === 'enviada' ? `<p class="ayuda">Enviada el ${esc(String(k.enviada_en ?? '').slice(0, 10))}: ${esc(k.encolados)} en cola,
        ${esc(k.omitidos_sin_consentimiento ?? 0)} sin autorización.</p>` : ''}`;
    },
  });
  z.addEventListener('submit', async ev => {
    if (ev.target.id !== 'editar-com') return;
    ev.preventDefault();
    const f = ev.target;
    const asunto = f.elements.asunto.value.trim(), cuerpo = f.elements.cuerpo.value.trim();
    if (asunto.length < 5 || cuerpo.length < 20) return avisar('El asunto pide 5 caracteres y el mensaje 20.', 'error');
    try {
      const r = await api.enviar(`/api/v1/comunicaciones/${id}/editar`, { asunto, cuerpo });
      avisar(r.mensaje, 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });
}
