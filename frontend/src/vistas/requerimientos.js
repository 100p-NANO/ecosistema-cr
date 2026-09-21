import { api } from '../api.js';
import { pantalla, formulario, tabla, chip, chipEstado, sedes, valoresDe, cabezaFicha, zonaFicha, pedirTexto,
         buscadorPersona, fechaHora, esc, vacio, avisar } from './comun.js';

const PRIORIDAD = { urgente: 'distintivo--n4', alta: 'distintivo--aviso', media: '', baja: '' };

/** La mesa de servicio: lo que vence primero, arriba. El plazo lo pone la
    base según la prioridad; lo vencido se dice, no se descubre. */
export function pintarRequerimientos(c) {
  let form, abiertos = true;
  const { recargar } = pantalla(c, {
    titulo: 'Requerimientos',
    intro: 'Urgente vence en 4 horas, alta en 24, media en 72 y baja en una semana.',
    barra: `<label class="casilla" for="f-abiertos"><input id="f-abiertos" type="checkbox" checked><span>Solo los abiertos</span></label>`,
    cargar: () => api.obtener('/api/v1/requerimientos?limite=100' + (abiertos ? '&abiertos=si' : '')),
    pintar: (d) => (form?.html ?? '') + (d.requerimientos.length
      ? tabla(d.requerimientos, [
          { titulo: 'Requerimiento', pintar: r => `<a class="enlace-fila" href="#/requerimientos/${esc(r.id)}"><strong>${esc(r.asunto)}</strong></a>
              <br><span class="ayuda">${esc(r.categoria_nombre ?? r.categoria)} · ${esc(r.sede)}</span>` },
          { titulo: 'Prioridad', pintar: r => chip(r.prioridad, PRIORIDAD[r.prioridad] ?? '') },
          { titulo: 'Estado', pintar: r => chipEstado(r.estado) },
          { titulo: 'Vence', pintar: r => `${esc(r.vence)}${r.vencido ? '<br>' + chip('vencido', 'distintivo--n4') : ''}` },
          { titulo: 'Atiende', pintar: r => esc(r.asignado ?? '—') },
        ])
      : vacio('🛠', abiertos ? 'Nada pendiente' : 'Ningún requerimiento', 'Lo que una sede reporte aparece aquí con su plazo.')),
  });
  c.querySelector('#f-abiertos').addEventListener('change', ev => { abiertos = ev.target.checked; recargar(); });

  Promise.all([sedes(), valoresDe('categoria_requerimiento')]).then(([op, cats]) => {
    form = formulario({
      titulo: 'Reportar un requerimiento',
      campos: [
        { nombre: 'sedeId', etiqueta: 'Sede', opciones: op, obligatorio: true },
        { nombre: 'categoria', etiqueta: 'Área', opciones: cats, obligatorio: true },
        { nombre: 'asunto', etiqueta: 'Qué pasa', obligatorio: true, minimo: 5, placeholder: 'Se cayó la consola de sonido' },
        { nombre: 'detalle', etiqueta: 'Detalle', multilinea: true },
        { nombre: 'prioridad', etiqueta: 'Prioridad', opciones: ['baja', 'media', 'alta', 'urgente'].map(v => ({ valor: v, texto: v })), vacio: 'media' },
      ],
      boton: 'Reportar',
      al: (d) => api.enviar('/api/v1/requerimientos', d),
    });
    recargar().then(() => form.enganchar(c, recargar));
  }).catch(e => avisar('No se pudo preparar el formulario: ' + e.message, 'error'));
}

export function pintarRequerimiento(c, id) {
  const z = zonaFicha(c, 'requerimientos', 'Volver a requerimientos');
  const asignar = buscadorPersona('asignadoA', 'Asignar a');
  const { recargar } = pantalla(z, {
    titulo: 'Requerimiento',
    cargar: () => api.obtener(`/api/v1/requerimientos/${id}`),
    pintar: (d) => {
      const r = d.requerimiento;
      const abierto = !['resuelto', 'cerrado', 'cancelado'].includes(r.estado);
      return `<div class="tarjeta">
        ${cabezaFicha(r.asunto, `${r.categoria_nombre ?? r.categoria} · ${r.sede} · reportado por ${r.reportado_por_nombre ?? '—'}`,
          [chipEstado(r.estado), chip('prioridad ' + r.prioridad, PRIORIDAD[r.prioridad] ?? ''), r.vencido ? chip('vencido', 'distintivo--n4') : ''].filter(Boolean))}
        ${r.detalle ? `<p class="texto-largo">${esc(r.detalle)}</p>` : ''}
        <p class="ayuda">Vence ${esc(fechaHora(r.vence_en))}${r.asignado ? ` · lo atiende ${esc(r.asignado)}` : ''}</p>
        ${r.solucion ? `<h3>Solución</h3><p class="texto-largo">${esc(r.solucion)}</p>` : ''}
      </div>
      ${d.puede_atender && abierto ? `
      <details class="tarjeta" style="margin-top:1rem">
        <summary style="cursor:pointer;font-weight:600">Asignar a alguien</summary>
        <form id="asignar" style="margin-top:1rem;display:grid;gap:.75rem">${asignar.html}
          <button class="boton" type="submit">Asignar</button></form>
      </details>
      <div class="acciones">
        ${r.estado !== 'en_curso' ? `<button class="boton boton--suave" data-enviar="/api/v1/requerimientos/${esc(r.id)}/atender"
            data-cuerpo='{"estado":"en_curso"}'>Empezar</button>` : ''}
        <button class="boton" data-resolver>Resolver</button>
        <button class="boton boton--suave" data-enviar="/api/v1/requerimientos/${esc(r.id)}/atender" data-cuerpo='{"estado":"cancelado"}'
            data-confirmar="¿Cancelar el requerimiento?">Cancelar</button>
      </div>` : ''}
      ${d.puede_atender && r.estado === 'resuelto' ? `<div class="acciones">
        <button class="boton" data-enviar="/api/v1/requerimientos/${esc(r.id)}/atender" data-cuerpo='{"estado":"cerrado"}'>Cerrar</button>
        <button class="boton boton--suave" data-enviar="/api/v1/requerimientos/${esc(r.id)}/atender" data-cuerpo='{"estado":"en_curso"}'>Reabrir</button>
      </div>` : ''}`;
    },
  });
  asignar.enganchar(z);
  z.addEventListener('submit', async ev => {
    if (ev.target.id !== 'asignar') return;
    ev.preventDefault();
    const persona = ev.target.elements.asignadoA.value;
    if (!persona) return avisar('Busque y elija a la persona.', 'error');
    try {
      const r = await api.enviar(`/api/v1/requerimientos/${id}/atender`, { estado: 'asignado', asignadoA: persona });
      avisar(r.mensaje, 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });
  z.addEventListener('click', async ev => {
    if (!ev.target.closest('[data-resolver]')) return;
    const solucion = pedirTexto('¿Qué se hizo? (queda escrito para la próxima vez)', 3);
    if (!solucion) return;
    try {
      const r = await api.enviar(`/api/v1/requerimientos/${id}/atender`, { estado: 'resuelto', solucion });
      avisar(r.mensaje, 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });
}
