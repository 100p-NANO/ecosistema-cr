import { api } from '../api.js';
import { pantalla, formulario, tabla, chip, chipEstado, sedes, campoPersona, pedirTexto, esc, vacio, avisar } from './comun.js';

const TIPO = { consulta: 'Consulta', reclamo: 'Reclamo', supresion: 'Supresión', revocacion: 'Revocación', actualizacion: 'Actualización' };

/**
 * Cumplimiento · los derechos del titular (Ley 1581 de 2012).
 * ⛔ Un derecho que solo puede ejercer quien sabe SQL no es un derecho. La
 * bandeja pone arriba lo que vence: consultas en 10 días hábiles, reclamos
 * en 15. Vencida es un incumplimiento en curso, y se dice.
 */
export function pintarCumplimiento(c) {
  let form, soloVencidas = false;
  const { recargar } = pantalla(c, {
    titulo: 'Habeas Data',
    intro: 'Consultas, reclamos y supresiones de los titulares, con su plazo legal.',
    barra: `<label class="casilla" for="f-vencidas"><input id="f-vencidas" type="checkbox"><span>Solo las vencidas</span></label>`,
    cargar: () => api.obtener('/api/v1/cumplimiento/peticiones?limite=200' + (soloVencidas ? '&vencidas=si' : '')),
    pintar: (d) => (form?.html ?? '') + (d.peticiones.length ? tabla(d.peticiones, [
        { titulo: 'Petición', pintar: p => `<strong>${esc(p.radicado ?? '')}</strong> · ${esc(TIPO[p.tipo] ?? p.tipo)}
            <br><span class="ayuda">${esc(p.titular_nombre)} · ${esc(p.titular_contacto)}</span>
            ${!['atendida', 'rechazada'].includes(p.estado) ? `<div class="acciones" style="margin:.4rem 0 0">
              <button class="boton boton--suave" data-responder="${esc(p.id)}">Responder</button>
              <button class="boton boton--suave" data-prorrogar="${esc(p.id)}">Prorrogar</button>
              ${p.tipo === 'supresion' ? `<button class="boton boton--peligro" data-suprimir="${esc(p.id)}">Ejecutar supresión</button>` : ''}
            </div>` : ''}` },
        { titulo: 'Estado', pintar: p => chipEstado(p.estado) },
        { titulo: 'Vence', pintar: p => `${esc(p.vence_en)}${p.vencida ? '<br>' + chip('vencida', 'distintivo--n4')
            : p.dias_restantes != null && !['atendida', 'rechazada'].includes(p.estado) ? `<br><span class="ayuda">${esc(p.dias_restantes)} día(s)</span>` : ''}` },
        { titulo: 'Recibida', pintar: p => esc(String(p.recibida_en ?? '').slice(0, 10)) },
      ]) : vacio('⚖', soloVencidas ? 'Nada vencido' : 'Ninguna petición', 'Las peticiones de los titulares se radican aquí.')),
  });
  c.querySelector('#f-vencidas').addEventListener('change', ev => { soloVencidas = ev.target.checked; recargar(); });

  const accion = async (ruta, cuerpo, ok) => {
    try { const r = await api.enviar(ruta, cuerpo); avisar(r.mensaje ?? ok, 'exito'); recargar(); }
    catch (e) { avisar(e.message, 'error'); }
  };
  c.addEventListener('click', async ev => {
    const r = ev.target.closest('[data-responder]'), p = ev.target.closest('[data-prorrogar]'), s = ev.target.closest('[data-suprimir]');
    if (r) {
      const respuesta = pedirTexto('Respuesta al titular (mínimo 15 caracteres; queda escrita)', 15);
      if (respuesta) await accion(`/api/v1/cumplimiento/peticiones/${r.dataset.responder}/responder`, { respuesta }, 'Respondida.');
    } else if (p) {
      const motivo = pedirTexto('Motivo de la prórroga (mínimo 15 caracteres). Debe informarse al titular.', 15);
      if (motivo) await accion(`/api/v1/cumplimiento/peticiones/${p.dataset.prorrogar}/prorrogar`, { motivo, informada: true }, 'Prorrogada.');
    } else if (s) {
      const conf = prompt('La supresión borra datos y NO se deshace. Escriba SUPRIMIR para ejecutarla.');
      if (conf === 'SUPRIMIR') await accion(`/api/v1/cumplimiento/peticiones/${s.dataset.suprimir}/suprimir`, { confirmacion: conf }, 'Supresión ejecutada.');
      else if (conf !== null) avisar('No se ejecutó: hay que escribir SUPRIMIR.', 'aviso');
    }
  });

  sedes().then(op => {
    form = formulario({
      titulo: 'Radicar una petición',
      campos: [
        { nombre: 'tipo', etiqueta: 'Qué pide el titular', obligatorio: true, opciones: Object.entries(TIPO).map(([valor, texto]) => ({ valor, texto })) },
        { nombre: 'canal', etiqueta: 'Por dónde llegó', obligatorio: true,
          opciones: ['presencial', 'correo', 'telefono', 'web', 'whatsapp'].map(v => ({ valor: v, texto: v })) },
        { nombre: 'titularNombre', etiqueta: 'Nombre del titular', obligatorio: true, minimo: 3 },
        { nombre: 'titularContacto', etiqueta: 'Correo o teléfono para responderle', obligatorio: true, minimo: 5 },
        campoPersona('titularId', 'Es esta persona del sistema (si ya está registrada)'),
        { nombre: 'titularDocumento', etiqueta: 'Documento del titular' },
        { nombre: 'sedeId', etiqueta: 'Sede', opciones: op },
        { nombre: 'detalle', etiqueta: 'Lo que pide, con sus palabras', multilinea: true, obligatorio: true, minimo: 15 },
      ],
      boton: 'Radicar',
      al: (d) => api.enviar('/api/v1/cumplimiento/peticiones', d),
    });
    recargar().then(() => form.enganchar(c, recargar));
  }).catch(e => avisar('No se pudieron cargar las sedes: ' + e.message, 'error'));
}
