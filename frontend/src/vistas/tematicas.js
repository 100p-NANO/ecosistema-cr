import { api } from '../api.js';
import { pantalla, formulario, tabla, chip, chipEstado, sedes, cabezaFicha, zonaFicha, esc, vacio, avisar } from './comun.js';

/** Temáticas y enseñanza: qué se predica, serie por serie. Una serie de la
    red la ven todas las sedes para predicar alineadas. */
export function pintarTematicas(c, sesion) {
  let form;
  const redEntera = !!sesion?.alcance?.todaLaRed;
  const { recargar } = pantalla(c, {
    titulo: 'Temáticas',
    intro: 'Series de enseñanza de su sede y de la red.',
    cargar: () => api.obtener('/api/v1/tematicas?limite=100'),
    pintar: (d) => (d.puede_crear ? form?.html ?? '' : '') + (d.series.length
      ? tabla(d.series, [
          { titulo: 'Serie', pintar: s => `<a class="enlace-fila" href="#/tematicas/${esc(s.id)}"><strong>${esc(s.titulo)}</strong></a>
              ${s.alcance_red ? ' ' + chip('toda la red', 'distintivo--aviso') : ''}` },
          { titulo: 'Estado', pintar: s => chipEstado(s.estado) },
          { titulo: 'Enseñanzas', pintar: s => `${esc(s.ensenanzas)}${s.ultima ? `<br><span class="ayuda">última ${esc(s.ultima)}</span>` : ''}` },
          { titulo: 'Fechas', pintar: s => s.inicia ? `${esc(s.inicia)} a ${esc(s.termina ?? '…')}` : '—' },
          { titulo: 'Sede', campo: 'sede' },
        ])
      : vacio('📖', 'Ninguna serie todavía', 'Cree la primera serie con el formulario de arriba.')),
  });
  sedes().then(op => {
    form = formulario({
      titulo: 'Crear una serie',
      campos: [
        { nombre: 'sedeId', etiqueta: 'Sede', opciones: op, obligatorio: true },
        { nombre: 'titulo', etiqueta: 'Título', obligatorio: true, minimo: 3 },
        { nombre: 'descripcion', etiqueta: 'De qué trata', multilinea: true },
        { nombre: 'inicia', etiqueta: 'Empieza', tipo: 'date' },
        { nombre: 'termina', etiqueta: 'Termina', tipo: 'date' },
        ...(redEntera ? [{ nombre: 'alcanceRed', etiqueta: 'Es una serie de toda la red', tipo: 'checkbox' }] : []),
      ],
      boton: 'Crear serie',
      al: (d) => api.enviar('/api/v1/tematicas', d),
    });
    recargar().then(() => form.enganchar(c, recargar));
  }).catch(e => avisar('No se pudieron cargar las sedes: ' + e.message, 'error'));
}

export function pintarSerie(c, id) {
  const z = zonaFicha(c, 'tematicas', 'Volver a temáticas');
  const form = formulario({
    titulo: 'Agregar una enseñanza',
    campos: [
      { nombre: 'titulo', etiqueta: 'Título', obligatorio: true, minimo: 3 },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', obligatorio: true },
      { nombre: 'predicador', etiqueta: 'Quién la predicó' },
      { nombre: 'pasaje', etiqueta: 'Pasaje', placeholder: 'Mateo 7:24-27' },
      { nombre: 'resumen', etiqueta: 'Resumen', multilinea: true },
      { nombre: 'recursos', etiqueta: 'Enlaces o recursos' },
    ],
    boton: 'Agregar',
    al: (d) => api.enviar(`/api/v1/tematicas/${id}/ensenanzas`, d),
  });
  const { recargar } = pantalla(z, {
    titulo: 'Serie',
    cargar: () => api.obtener(`/api/v1/tematicas/${id}`),
    pintar: (d) => `<div class="tarjeta">
        ${cabezaFicha(d.serie.titulo, `${d.serie.sede}${d.serie.alcance_red ? ' · toda la red' : ''}`, [chipEstado(d.serie.estado)])}
        ${d.serie.descripcion ? `<p class="texto-largo">${esc(d.serie.descripcion)}</p>` : ''}
      </div>
      ${d.puede_editar ? `<div class="acciones">
        ${d.serie.estado !== 'en_curso' ? `<button class="boton boton--suave" data-enviar="/api/v1/tematicas/${esc(id)}/estado" data-cuerpo='{"estado":"en_curso"}'>En curso</button>` : ''}
        ${d.serie.estado !== 'terminada' ? `<button class="boton boton--suave" data-enviar="/api/v1/tematicas/${esc(id)}/estado" data-cuerpo='{"estado":"terminada"}'>Terminada</button>` : ''}
      </div>` : ''}
      <h2 style="margin-top:1.5rem">Enseñanzas</h2>
      ${form.html}
      ${d.ensenanzas.length ? tabla(d.ensenanzas, [
          { titulo: 'Enseñanza', pintar: e => `<strong>${esc(e.titulo)}</strong>${e.resumen ? `<br><span class="ayuda">${esc(e.resumen.slice(0, 140))}</span>` : ''}` },
          { titulo: 'Fecha', campo: 'fecha' },
          { titulo: 'Pasaje', pintar: e => esc(e.pasaje ?? '—') },
          { titulo: 'Predicó', pintar: e => esc(e.predicador ?? '—') },
        ]) : vacio('🗒', 'Ninguna enseñanza', 'Agregue la primera con el formulario de arriba.')}`,
  });
  form.enganchar(z, recargar);
}
