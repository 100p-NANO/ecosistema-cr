import { api } from '../api.js';
import { pantalla, formulario, tabla, chip, chipEstado, sedes, valoresDe, campoPersona, pedirTexto,
         esc, vacio, avisar } from './comun.js';

/** La agenda de las sedes a su alcance y la de toda la red. La hora se
    escribe como la vive la sede: Bogotá, Panamá y Barcelona no comparten
    reloj, y la base guarda cada evento con la zona de su sede. */
export function pintarCalendario(c, sesion) {
  let form, dias = 60;
  const redEntera = !!sesion?.alcance?.todaLaRed;
  const { recargar } = pantalla(c, {
    titulo: 'Calendario',
    intro: 'Servicios, reuniones y eventos. Los de la red los ven todas las sedes.',
    barra: `<div class="filtros"><label class="sr-solo" for="f-dias">Horizonte</label>
      <select id="f-dias"><option value="14">Próximas 2 semanas</option><option value="60" selected>Próximos 2 meses</option>
      <option value="180">Próximos 6 meses</option></select></div>`,
    cargar: () => api.obtener('/api/v1/calendario?limite=200&dias=' + dias),
    pintar: (d) => (d.puede_crear ? form?.html ?? '' : '') + (d.eventos.length
      ? tabla(d.eventos, [
          { titulo: 'Evento', pintar: e => `<strong>${esc(e.titulo)}</strong>${e.alcance_red ? ' ' + chip('toda la red', 'distintivo--aviso') : ''}
              <br><span class="ayuda">${esc(e.tipo_nombre ?? e.tipo)}${e.lugar ? ' · ' + esc(e.lugar) : ''}</span>
              ${e.estado === 'programado' && d.puede_crear ? `<div class="acciones" style="margin:.4rem 0 0">
                <button class="boton boton--suave" data-enviar="/api/v1/calendario/${esc(e.id)}/realizado">Se hizo</button>
                <button class="boton boton--suave" data-cancelar="${esc(e.id)}">Cancelar</button></div>` : ''}` },
          { titulo: 'Cuándo', pintar: e => `${esc(e.inicia)}<br><span class="ayuda">hasta ${esc(e.termina.slice(11))}</span>` },
          { titulo: 'Estado', pintar: e => chipEstado(e.estado) + (e.motivo_cancelacion ? `<br><span class="ayuda">${esc(e.motivo_cancelacion)}</span>` : '') },
          { titulo: 'Sede', campo: 'sede' },
          { titulo: 'Responsable', pintar: e => esc(e.responsable ?? '—') },
        ])
      : vacio('📅', 'Nada agendado', 'Agende el primer evento con el formulario de arriba.')),
  });
  c.querySelector('#f-dias').addEventListener('change', ev => { dias = Number(ev.target.value); recargar(); });
  c.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-cancelar]');
    if (!b) return;
    const motivo = pedirTexto('¿Por qué se cancela? (se les dice a los inscritos)', 5);
    if (!motivo) return;
    try {
      const r = await api.enviar(`/api/v1/calendario/${b.dataset.cancelar}/cancelar`, { motivo });
      avisar(r.mensaje, 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });

  Promise.all([sedes(), valoresDe('tipo_evento')]).then(([op, tipos]) => {
    const campos = [
      { nombre: 'sedeId', etiqueta: 'Sede', opciones: op, obligatorio: true },
      { nombre: 'tipo', etiqueta: 'Tipo', opciones: tipos, obligatorio: true },
      { nombre: 'titulo', etiqueta: 'Nombre del evento', obligatorio: true, minimo: 3 },
      { nombre: 'inicia', etiqueta: 'Empieza (hora de la sede)', tipo: 'datetime-local', obligatorio: true },
      { nombre: 'termina', etiqueta: 'Termina', tipo: 'datetime-local', obligatorio: true },
      { nombre: 'lugar', etiqueta: 'Lugar' },
      { nombre: 'descripcion', etiqueta: 'Descripción', multilinea: true },
      { nombre: 'cupo', etiqueta: 'Cupo (si tiene)', tipo: 'number', numero: true },
      campoPersona('responsableId', 'Responsable'),
      { nombre: 'publico', etiqueta: 'Se puede anunciar al público', tipo: 'checkbox' },
      ...(redEntera ? [{ nombre: 'alcanceRed', etiqueta: 'Es para toda la red (lo ven las 36 sedes)', tipo: 'checkbox' }] : []),
    ];
    campos.validar = (d) => d.termina <= d.inicia ? 'El evento debe terminar después de empezar.' : null;
    form = formulario({ titulo: 'Agendar un evento', campos, boton: 'Agendar',
      al: (d) => api.enviar('/api/v1/calendario', d) });
    recargar().then(() => form.enganchar(c, recargar));
  }).catch(e => avisar('No se pudo preparar el formulario: ' + e.message, 'error'));
}
