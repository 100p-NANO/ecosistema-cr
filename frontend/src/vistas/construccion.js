import { api } from '../api.js';
import { pantalla, formulario, tabla, chipEstado, sedes, valoresDe, campoPersona, cabezaFicha, zonaFicha,
         esc, vacio, avisar } from './comun.js';

const dinero = (v, moneda = 'COP') => v == null ? '—'
  : Number(v).toLocaleString('es-CO', { style: 'currency', currency: moneda, maximumFractionDigits: 0 });

/** Avance contra ejecutado, en la misma escala: una obra que gasta más de
    lo que avanza se ve sin leer números. */
const progreso = (avance, ejecutadoPct) => `<div class="progreso">
  <div class="progreso__fila"><span>Avance</span><span class="progreso__barra"><span style="width:${Math.min(100, Number(avance) || 0)}%"></span></span><b>${esc(avance)} %</b></div>
  <div class="progreso__fila"><span>Gastado</span><span class="progreso__barra progreso__barra--gasto"><span style="width:${Math.min(100, Number(ejecutadoPct) || 0)}%"></span></span><b>${ejecutadoPct == null ? '—' : esc(ejecutadoPct) + ' %'}</b></div>
</div>`;

export function pintarConstruccion(c) {
  let form;
  const { recargar } = pantalla(c, {
    titulo: 'Construcción',
    intro: 'Las obras de cada sede. El avance y lo gastado salen de los hitos.',
    cargar: () => api.obtener('/api/v1/construccion?limite=100'),
    pintar: (d) => (d.puede_crear ? form?.html ?? '' : '') + (d.obras.length
      ? tabla(d.obras, [
          { titulo: 'Obra', pintar: o => `<a class="enlace-fila" href="#/construccion/${esc(o.id)}"><strong>${esc(o.nombre)}</strong></a>
              <br><span class="ayuda">${esc(o.tipo_nombre ?? o.tipo)} · ${esc(o.sede)}</span>` },
          { titulo: 'Avance', pintar: o => progreso(o.avance_pct, o.ejecutado_pct) },
          { titulo: 'Presupuesto', pintar: o => `${dinero(o.presupuesto, o.moneda)}<br><span class="ayuda">gastado ${dinero(o.ejecutado, o.moneda)}</span>` },
          { titulo: 'Estado', pintar: o => chipEstado(o.estado) },
          { titulo: 'Fin estimado', pintar: o => esc(o.termina_estimado ?? '—') },
        ])
      : vacio('🏗', 'Ninguna obra', 'Registre la primera obra con el formulario de arriba.')),
  });
  Promise.all([sedes(), valoresDe('tipo_obra')]).then(([op, tipos]) => {
    form = formulario({
      titulo: 'Registrar una obra',
      campos: [
        { nombre: 'sedeId', etiqueta: 'Sede', opciones: op, obligatorio: true },
        { nombre: 'nombre', etiqueta: 'Nombre de la obra', obligatorio: true, minimo: 3 },
        { nombre: 'tipo', etiqueta: 'Tipo', opciones: tipos, obligatorio: true },
        { nombre: 'presupuesto', etiqueta: 'Presupuesto', tipo: 'number', ayuda: 'Sin puntos ni símbolos: 50000000' },
        { nombre: 'moneda', etiqueta: 'Moneda', opciones: ['COP', 'USD', 'EUR'].map(v => ({ valor: v, texto: v })), vacio: 'COP' },
        { nombre: 'inicia', etiqueta: 'Empieza', tipo: 'date' },
        { nombre: 'terminaEstimado', etiqueta: 'Fin estimado', tipo: 'date' },
        campoPersona('responsableId', 'Responsable'),
        { nombre: 'descripcion', etiqueta: 'Descripción', multilinea: true },
      ],
      boton: 'Registrar obra',
      al: (d) => api.enviar('/api/v1/construccion', d),
    });
    recargar().then(() => form.enganchar(c, recargar));
  }).catch(e => avisar('No se pudo preparar el formulario: ' + e.message, 'error'));
}

export function pintarObra(c, id) {
  const z = zonaFicha(c, 'construccion', 'Volver a construcción');
  const form = formulario({
    titulo: 'Registrar un hito',
    campos: [
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', obligatorio: true },
      { nombre: 'descripcion', etiqueta: 'Qué se logró', obligatorio: true, minimo: 5 },
      { nombre: 'avancePct', etiqueta: 'Avance total de la obra (%)', tipo: 'number', numero: true },
      { nombre: 'gasto', etiqueta: 'Gasto de este hito', tipo: 'number' },
    ],
    boton: 'Registrar hito',
    al: (d) => api.enviar(`/api/v1/construccion/${id}/hitos`, d),
  });
  const { recargar } = pantalla(z, {
    titulo: 'Obra',
    cargar: () => api.obtener(`/api/v1/construccion/${id}`),
    pintar: (d) => {
      const o = d.obra;
      const pct = o.presupuesto > 0 ? Math.round(100 * o.ejecutado / o.presupuesto) : null;
      const viva = !['terminada', 'cancelada'].includes(o.estado);
      return `<div class="tarjeta">
        ${cabezaFicha(o.nombre, `${o.tipo_nombre ?? o.tipo} · ${o.sede}${o.responsable ? ' · responsable ' + o.responsable : ''}`, [chipEstado(o.estado)])}
        ${progreso(o.avance_pct, pct)}
        <p style="margin-top:.75rem">Presupuesto <strong>${dinero(o.presupuesto, o.moneda)}</strong> · gastado <strong>${dinero(o.ejecutado, o.moneda)}</strong></p>
        ${o.descripcion ? `<p class="texto-largo">${esc(o.descripcion)}</p>` : ''}
      </div>
      ${d.puede_editar && viva ? `<div class="acciones">
        ${o.estado === 'en_curso' ? `<button class="boton boton--suave" data-enviar="/api/v1/construccion/${esc(id)}/estado" data-cuerpo='{"estado":"suspendida"}'
            data-confirmar="¿Suspender la obra?">Suspender</button>
          <button class="boton" data-enviar="/api/v1/construccion/${esc(id)}/estado" data-cuerpo='{"estado":"terminada"}'
            data-confirmar="¿Dar la obra por terminada? Ya no recibirá hitos.">Terminada</button>` : ''}
        ${o.estado === 'suspendida' ? `<button class="boton" data-enviar="/api/v1/construccion/${esc(id)}/estado" data-cuerpo='{"estado":"en_curso"}'>Reanudar</button>` : ''}
      </div>` : ''}
      <h2 style="margin-top:1.5rem">Hitos</h2>
      ${d.puede_editar && viva ? form.html : ''}
      ${d.hitos.length ? tabla(d.hitos, [
          { titulo: 'Hito', pintar: h => `<strong>${esc(h.descripcion)}</strong>` },
          { titulo: 'Fecha', campo: 'fecha' },
          { titulo: 'Avance', pintar: h => h.avance_pct == null ? '—' : esc(h.avance_pct) + ' %' },
          { titulo: 'Gasto', pintar: h => dinero(h.gasto, o.moneda) },
          { titulo: 'Registró', campo: 'registro' },
        ]) : vacio('📐', 'Ningún hito', 'El primer hito pone la obra en curso.')}`;
    },
  });
  form.enganchar(z, recargar);
}
