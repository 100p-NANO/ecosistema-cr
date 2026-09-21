import { api } from '../api.js';
import { pantalla, formulario, tabla, chip, chipEstado, sedes, valoresDe, cabezaFicha, zonaFicha, pedirTexto,
         esc, vacio, avisar } from './comun.js';

const PRIORIDAD = { urgente: 'distintivo--n4', alta: 'distintivo--aviso', normal: '', baja: '' };

/** Peticiones internas: lo que una sede o un equipo le pide a la dirección.
    Primero lo que espera decisión; nadie decide lo que él mismo pidió. */
export function pintarPeticiones(c) {
  let form, soloMias = false;
  const { recargar } = pantalla(c, {
    titulo: 'Peticiones internas',
    intro: 'Permisos, presupuestos y autorizaciones que se le piden a la dirección, con su decisión escrita.',
    barra: `<label class="casilla" for="f-mias"><input id="f-mias" type="checkbox"><span>Solo las mías</span></label>`,
    cargar: () => api.obtener('/api/v1/peticiones?limite=100' + (soloMias ? '&mias=si' : '')),
    pintar: (d) => (form?.html ?? '') + (d.peticiones.length
      ? tabla(d.peticiones, [
          { titulo: 'Petición', pintar: p => `<a class="enlace-fila" href="#/peticiones/${esc(p.id)}"><strong>${esc(p.asunto)}</strong></a>
              <br><span class="ayuda">${esc(p.tipo_nombre ?? p.tipo)} · ${esc(p.solicitante ?? '')}${p.es_mia ? ' (usted)' : ''}</span>` },
          { titulo: 'Prioridad', pintar: p => chip(p.prioridad, PRIORIDAD[p.prioridad] ?? '') },
          { titulo: 'Estado', pintar: p => chipEstado(p.estado) },
          { titulo: 'Enviada', pintar: p => `${esc(p.fecha)}<br><span class="ayuda">hace ${esc(p.dias)} día(s)</span>` },
          { titulo: 'Decidió', pintar: p => p.decidida_por ? `${esc(p.decidida_por)}<br><span class="ayuda">${esc(p.decidida_en)}</span>` : '·' },
        ])
      : vacio('📨', 'Ninguna petición', 'Lo que se le pida a la dirección aparece aquí con su decisión.')),
  });
  c.querySelector('#f-mias').addEventListener('change', ev => { soloMias = ev.target.checked; recargar(); });

  Promise.all([sedes(), valoresDe('tipo_peticion_interna')]).then(([op, tipos]) => {
    form = formulario({
      titulo: 'Pedirle algo a la dirección',
      campos: [
        { nombre: 'sedeId', etiqueta: 'Sede', opciones: op, obligatorio: true },
        { nombre: 'tipo', etiqueta: 'Tipo', opciones: tipos, obligatorio: true },
        { nombre: 'asunto', etiqueta: 'Asunto', obligatorio: true, minimo: 5 },
        { nombre: 'detalle', etiqueta: 'Qué se necesita y por qué', multilinea: true, obligatorio: true, minimo: 10 },
        { nombre: 'prioridad', etiqueta: 'Prioridad', opciones: ['baja', 'normal', 'alta', 'urgente'].map(v => ({ valor: v, texto: v })), vacio: 'normal' },
      ],
      boton: 'Enviar a la dirección',
      al: (d) => api.enviar('/api/v1/peticiones', d),
    });
    recargar().then(() => form.enganchar(c, recargar));
  }).catch(e => avisar('No se pudo preparar el formulario: ' + e.message, 'error'));
}

export function pintarPeticion(c, id) {
  const z = zonaFicha(c, 'peticiones', 'Volver a peticiones');
  const { recargar } = pantalla(z, {
    titulo: 'Petición interna',
    cargar: () => api.obtener(`/api/v1/peticiones/${id}`),
    pintar: (d) => {
      const p = d.peticion;
      const pendiente = ['enviada', 'en_revision'].includes(p.estado);
      return `<div class="tarjeta">
        ${cabezaFicha(p.asunto, `${p.tipo_nombre ?? p.tipo} · ${p.sede} · pedida por ${p.solicitante ?? 'sin dato'}`,
          [chipEstado(p.estado), chip('prioridad ' + p.prioridad, PRIORIDAD[p.prioridad] ?? '')])}
        <p class="texto-largo">${esc(p.detalle)}</p>
        ${p.decision ? `<h3 style="margin-top:1rem">Decisión</h3><p class="texto-largo">${esc(p.decision)}</p>
          <p class="ayuda">${esc(p.decidida_por_nombre ?? '')}</p>` : ''}
      </div>
      ${pendiente && d.puede_decidir && !d.es_mia ? `<div class="acciones">
        ${p.estado === 'enviada' ? `<button class="boton boton--suave" data-enviar="/api/v1/peticiones/${esc(p.id)}/decidir"
            data-cuerpo='{"estado":"en_revision"}'>Marcar en revisión</button>` : ''}
        <button class="boton" data-decidir="aprobada">Aprobar</button>
        <button class="boton boton--peligro" data-decidir="rechazada">Rechazar</button>
      </div>` : ''}
      ${pendiente && d.puede_decidir && d.es_mia ? '<p class="ayuda">Usted la pidió: la decide otra persona.</p>' : ''}
      ${pendiente && d.es_mia ? `<div class="acciones"><button class="boton boton--suave" data-enviar="/api/v1/peticiones/${esc(p.id)}/cancelar"
          data-confirmar="¿Retirar la petición?">Retirar mi petición</button></div>` : ''}`;
    },
  });
  z.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-decidir]');
    if (!b) return;
    const decision = pedirTexto(b.dataset.decidir === 'aprobada'
      ? '¿Con qué condiciones se aprueba? (lo lee quien la pidió)' : '¿Por qué se rechaza? (lo lee quien la pidió)', 3);
    if (!decision) return;
    try {
      const r = await api.enviar(`/api/v1/peticiones/${id}/decidir`, { estado: b.dataset.decidir, decision });
      avisar(r.mensaje, 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });
}
