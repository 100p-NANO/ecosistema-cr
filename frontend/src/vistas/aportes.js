import { api } from '../api.js';
import { pantalla, formulario, tabla, chip, chipEstado, sedes, valoresDe, campoPersona, esc, vacio, avisar } from './comun.js';

const dinero = (v, m = 'COP') => Number(v ?? 0).toLocaleString('es-CO', { style: 'currency', currency: m || 'COP', maximumFractionDigits: 0 });

/**
 * Aportes · N3 · Tesorería.
 * ⛔ Quien registra no confirma: registrar es REGISTRAR_APORTE y confirmar
 * es CONFIRMAR_APORTE, y la base no deja confirmar lo que uno mismo
 * registró. Lo confirmado es inmutable y entra al certificado.
 */
export function pintarAportes(c) {
  let form, anio = new Date().getFullYear(), estadoF = '';
  const { recargar } = pantalla(c, {
    titulo: 'Aportes',
    intro: 'Dato sensible (N3). Registrar y confirmar son dos manos distintas.',
    barra: `<div class="filtros">
      <label class="sr-solo" for="f-anio">Año</label>
      <select id="f-anio">${[0, 1, 2].map(k => { const a = new Date().getFullYear() - k; return `<option value="${a}">${a}</option>`; }).join('')}</select>
      <label class="sr-solo" for="f-ap-estado">Estado</label>
      <select id="f-ap-estado"><option value="">Todos</option><option value="registrado">Por confirmar</option>
        <option value="confirmado">Confirmados</option><option value="certificado">Certificados</option></select></div>`,
    cargar: () => api.obtener(`/api/v1/aportes?limite=200&anio=${anio}${estadoF ? '&estado=' + estadoF : ''}`),
    pintar: (d) => (form?.html ?? '') + `
      <div class="cifras"><div class="cifra"><b>${esc(dinero(d.total_monto))}</b><span>${esc(d.total_filas)} aporte(s) en la lista</span></div></div>
      ${d.donaciones.length ? tabla(d.donaciones, [
        { titulo: 'Aporte', pintar: a => `<strong>${esc(dinero(a.monto, a.moneda))}</strong> · ${esc(String(a.tipo_aporte ?? '').toLowerCase())}
            <br><span class="ayuda">${esc(a.nombre_completo ?? 'Anónimo')}</span>
            ${String(a.estado).toLowerCase() === 'registrado' ? `<div class="acciones" style="margin:.4rem 0 0">
              <button class="boton boton--suave" data-enviar="/api/v1/aportes/${esc(a.id)}/confirmar"
                data-confirmar="¿Confirmar el aporte? Confirmado ya no se edita.">Confirmar</button></div>` : ''}` },
        { titulo: 'Fecha', pintar: a => esc(String(a.fecha_aporte ?? '').slice(0, 10)) },
        { titulo: 'Medio', pintar: a => esc(String(a.metodo_pago ?? '').toLowerCase()) },
        { titulo: 'Estado', pintar: a => chipEstado(String(a.estado).toLowerCase()) + (a.inmutable ? ' ' + chip('inmutable') : '') },
        { titulo: 'Referencia', pintar: a => esc(a.referencia ?? '—') },
      ]) : vacio('💠', 'Ningún aporte en este filtro', 'Registre el primero con el formulario de arriba.')}`,
  });
  c.querySelector('#f-anio').addEventListener('change', ev => { anio = Number(ev.target.value); recargar(); });
  c.querySelector('#f-ap-estado').addEventListener('change', ev => { estadoF = ev.target.value; recargar(); });

  /* Tipo y medio salen del CATÁLOGO: la base los amarra con llave
     foránea, así que una lista escrita aquí se desfasaría en silencio. */
  Promise.all([sedes(), valoresDe('tipo_aporte'), valoresDe('medio_pago')]).then(([op, tipos, medios]) => {
    const campos = [
      campoPersona('persona_id', 'A nombre de', { ayuda: 'Déjelo vacío y marque «anónimo» si no hay nombre.' }),
      { nombre: 'es_anonimo', etiqueta: 'Es un aporte anónimo', tipo: 'checkbox' },
      { nombre: 'sede_id', etiqueta: 'Sede que lo recibió (solo si es anónimo)', opciones: op },
      { nombre: 'tipo_aporte', etiqueta: 'Tipo', obligatorio: true, opciones: tipos },
      { nombre: 'monto', etiqueta: 'Monto', tipo: 'number', obligatorio: true },
      { nombre: 'moneda', etiqueta: 'Moneda', opciones: ['COP', 'USD', 'EUR'].map(v => ({ valor: v, texto: v })), vacio: 'COP' },
      { nombre: 'metodo_pago', etiqueta: 'Medio', opciones: medios, vacio: 'efectivo' },
      { nombre: 'fecha_aporte', etiqueta: 'Fecha', tipo: 'date' },
      { nombre: 'referencia', etiqueta: 'Referencia o recibo' },
    ];
    campos.validar = (d) => !d.persona_id && !d.es_anonimo ? 'Elija a la persona o marque «anónimo».'
      : d.es_anonimo && !d.sede_id ? 'Un aporte anónimo necesita la sede que lo recibió.' : null;
    form = formulario({ titulo: 'Registrar un aporte', campos, boton: 'Registrar',
      al: (d) => { if (!d.es_anonimo) delete d.es_anonimo; return api.enviar('/api/v1/aportes', d); } });
    recargar().then(() => form.enganchar(c, recargar));
  }).catch(e => avisar('No se pudo preparar el formulario: ' + e.message, 'error'));
}
