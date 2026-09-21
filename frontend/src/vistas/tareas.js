import { api } from '../api.js';
import { pantalla, formulario, tabla, chip, chipEstado, sedes, campoPersona, esc, vacio, avisar } from './comun.js';

/** Tareas: las suyas primero. Quien tiene una tarea la puede marcar aunque
    su rol no edite tareas: es suya. */
export function pintarTareas(c) {
  let form, soloMias = false, abiertas = true;
  const { recargar } = pantalla(c, {
    titulo: 'Tareas',
    intro: 'Primero las suyas; después las de la sede, por vencimiento.',
    barra: `<div class="filtros">
      <label class="casilla" for="f-t-mias"><input id="f-t-mias" type="checkbox"><span>Solo las mías</span></label>
      <label class="casilla" for="f-t-abiertas"><input id="f-t-abiertas" type="checkbox" checked><span>Solo pendientes</span></label></div>`,
    cargar: () => api.obtener('/api/v1/tareas?limite=100' + (soloMias ? '&mias=si' : '') + (abiertas ? '&abiertas=si' : '')),
    pintar: (d) => (form?.html ?? '') + (d.tareas.length
      ? tabla(d.tareas, [
          /* La acción va en la primera celda (docs/DISENO.md). */
          { titulo: 'Tarea', pintar: t => `<strong>${esc(t.titulo)}</strong>${t.es_mia ? ' ' + chip('suya') : ''}
              ${['pendiente', 'en_curso'].includes(t.estado) ? `<div class="acciones" style="margin:.4rem 0 0">
                <button class="boton boton--suave" data-enviar="/api/v1/tareas/${esc(t.id)}/estado" data-cuerpo='{"estado":"hecha"}'>Hecha</button>
                ${t.estado === 'pendiente' ? `<button class="boton boton--suave" data-enviar="/api/v1/tareas/${esc(t.id)}/estado" data-cuerpo='{"estado":"en_curso"}'>Empezar</button>` : ''}
              </div>` : ''}` },
          { titulo: 'Estado', pintar: t => chipEstado(t.estado) },
          { titulo: 'Vence', pintar: t => t.vence ? `${esc(t.vence)}${t.vencida ? ' ' + chip('vencida', 'distintivo--n4') : ''}` : '—' },
          { titulo: 'Responsable', pintar: t => esc(t.asignada ?? 'sin asignar') },
          { titulo: 'Sede', campo: 'sede' },
        ])
      : vacio('✔', 'Nada pendiente', 'Las tareas que le asignen, o que cree, aparecen aquí.')),
  });
  c.querySelector('#f-t-mias').addEventListener('change', ev => { soloMias = ev.target.checked; recargar(); });
  c.querySelector('#f-t-abiertas').addEventListener('change', ev => { abiertas = ev.target.checked; recargar(); });

  sedes().then(op => {
    form = formulario({
      titulo: 'Crear una tarea',
      campos: [
        { nombre: 'sedeId', etiqueta: 'Sede', opciones: op, obligatorio: true },
        { nombre: 'titulo', etiqueta: 'Qué hay que hacer', obligatorio: true, minimo: 3 },
        { nombre: 'detalle', etiqueta: 'Detalle', multilinea: true },
        campoPersona('asignadaA', 'Responsable'),
        { nombre: 'venceEn', etiqueta: 'Para cuándo', tipo: 'date' },
        { nombre: 'prioridad', etiqueta: 'Prioridad', opciones: ['baja', 'normal', 'alta'].map(v => ({ valor: v, texto: v })), vacio: 'normal' },
      ],
      boton: 'Crear tarea',
      al: (d) => api.enviar('/api/v1/tareas', d),
    });
    recargar().then(() => form.enganchar(c, recargar));
  }).catch(e => avisar('No se pudieron cargar las sedes: ' + e.message, 'error'));
}
