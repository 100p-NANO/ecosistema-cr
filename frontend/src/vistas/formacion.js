import { api } from '../api.js';
import { pantalla, formulario, tabla, chip, sedes, valoresDe, esc, vacio, avisar } from './comun.js';

/** Formación · el catálogo es de la red, las cohortes son de cada sede. */
export function pintarFormacion(c) {
  let form;
  const { recargar } = pantalla(c, {
    titulo: 'Formación',
    intro: 'Los programas y cursos los define la central. Cada sede abre sus cohortes.',
    cargar: async () => {
      const [cohortes, programas] = await Promise.all([
        api.obtener('/api/v1/formacion/cohortes?limite=100'),
        api.obtener('/api/v1/formacion/programas'),
      ]);
      return { ...cohortes, programas: programas.programas };
    },
    pintar: (d) => (form?.html ?? '') + `
      <h2>Cohortes abiertas</h2>
      ${d.cohortes.length
        ? tabla(d.cohortes, [
            { titulo: 'Cohorte', pintar: h => `<a class="enlace-fila" href="#/formacion/${esc(h.id)}">
                <strong>${esc(h.codigo)}</strong></a><br><span class="ayuda">${esc(h.curso)}</span>` },
            { titulo: 'Programa', campo: 'programa' },
            { titulo: 'Sede', campo: 'sede' },
            { titulo: 'Inicia', campo: 'inicia' },
            { titulo: 'Inscritos', pintar: h => h.cupo
                ? `${h.inscritos} / ${h.cupo} ${Number(h.inscritos) > h.cupo ? chip('pasado', 'distintivo--n4') : ''}`
                : String(h.inscritos) },
          ])
        : vacio('🎓', 'Ninguna cohorte abierta', 'Abra una con el formulario de arriba.')}

      <h2 style="margin-top:2rem">Programas de la red</h2>
      ${d.programas.length
        ? tabla(d.programas, [
            { titulo: 'Programa', pintar: p => `<strong>${esc(p.nombre)}</strong>` },
            { titulo: 'Código', pintar: p => `<code>${esc(p.codigo)}</code>` },
            { titulo: 'Tipo', pintar: p => chip(p.tipo) },
            { titulo: 'Semestres', pintar: p => p.semestres ?? '·' },
            { titulo: 'Cursos', campo: 'cursos' },
          ])
        : vacio('📚', 'Ningún programa', 'La central todavía no ha cargado el catálogo.')}`,
  });

  Promise.all([sedes(), api.obtener('/api/v1/formacion/cursos'), valoresDe('modalidad_formacion')]).then(([op, cur, modalidades]) => {
    form = formulario({
      titulo: 'Abrir una cohorte',
      campos: [
        { nombre: 'sedeId', etiqueta: 'Sede', opciones: op, obligatorio: true },
        { nombre: 'cursoId', etiqueta: 'Curso', obligatorio: true,
          opciones: cur.cursos.map(u => ({ valor: u.id, texto: `${u.nombre} (${u.programa})` })) },
        { nombre: 'codigo', etiqueta: 'Código de la cohorte', obligatorio: true, placeholder: '2026-2' },
        /* La modalidad sale del catálogo `modalidad_formacion`, que es lo que la base acepta. */
        { nombre: 'modalidad', etiqueta: 'Modalidad', obligatorio: true, opciones: modalidades },
        { nombre: 'inicia', etiqueta: 'Inicia', tipo: 'date', obligatorio: true },
        { nombre: 'termina', etiqueta: 'Termina', tipo: 'date' },
        { nombre: 'cupo', etiqueta: 'Cupo', tipo: 'number', numero: true },
        { nombre: 'valor', etiqueta: 'Valor (COP)', tipo: 'number', numero: true },
      ],
      al: (d) => api.enviar('/api/v1/formacion/cohortes', d),
    });
    recargar().then(() => form.enganchar(c, recargar));
  }).catch(e => avisar('No se pudo preparar el formulario: ' + e.message, 'error'));
}

/** Una cohorte: quién está inscrito, cómo va y quién pagó. */
export function pintarCohorte(c, id) {
  c.innerHTML = `<p><a href="#/formacion">← Volver a formación</a></p><div id="h"></div>`;
  const z = c.querySelector('#h');

  const { recargar } = pantalla(z, {
    titulo: 'Cohorte',
    cargar: () => api.obtener(`/api/v1/formacion/cohortes/${id}`),
    pintar: (d) => `
      <div class="tarjeta" style="margin-bottom:1rem">
        <h2 style="margin:0 0 .3rem">${esc(d.cohorte.curso)}</h2>
        <p class="etiqueta">${esc(d.cohorte.codigo)} · ${esc(d.cohorte.programa)} · ${esc(d.cohorte.sede)}
           · ${esc(d.cohorte.modalidad)} · inicia ${esc(d.cohorte.inicia)}
           ${d.cohorte.docente ? ' · docente ' + esc(d.cohorte.docente) : ''}</p>
        <p><strong>${d.ocupacion.inscritos}</strong>${d.ocupacion.cupo ? ` de ${d.ocupacion.cupo}` : ''} inscrito(s)
           ${d.cohorte.otorga_certificado ? chip('otorga certificado') : ''}</p>
      </div>

      <form id="inscribir" style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap">
        <label class="sr-solo" for="qf">Buscar persona</label>
        <input id="qf" type="search" placeholder="Buscar a quien se inscribe" autocomplete="off" style="flex:1;min-width:200px">
        ${Number(d.cohorte.valor) > 0 ? `
        <!-- ⛔ 21 sep 2026 · Con la cohorte de pago, la base exige el estado
             del pago y este formulario no lo mandaba: inscribir fallaba siempre. -->
        <label class="sr-solo" for="qf-pago">Pago al inscribir</label>
        <select id="qf-pago" style="min-height:40px">
          <option value="pendiente">Pago pendiente</option><option value="pagado">Ya pagó</option>
          <option value="parcial">Pagó una parte</option><option value="exonerado">Exonerado</option>
        </select>` : ''}
      </form>
      ${Number(d.cohorte.valor) > 0 ? `<p class="ayuda" style="margin-top:-.5rem">Valor de la cohorte:
        ${esc(Number(d.cohorte.valor).toLocaleString('es-CO'))} ${esc(d.cohorte.moneda ?? 'COP')}</p>` : ''}
      <div id="sug-f"></div>

      ${d.inscritos.length
        ? tabla(d.inscritos, [
            /* ⛔ 21 sep 2026 · «Calificar» estaba en la última columna (fuera de
               la pantalla en el teléfono) y pedía el estado escribiéndolo en un
               prompt. Ahora va en la primera celda, con lista y campo de nota. */
            { titulo: 'Nombre', pintar: i => `<strong>${esc(i.nombre_completo)}</strong>
                <form class="acciones" data-calificar="${esc(i.id)}" style="margin:.4rem 0 0;align-items:center">
                  <label class="sr-solo" for="cal-${esc(i.id)}">Estado</label>
                  <select id="cal-${esc(i.id)}" name="estado" style="min-height:40px">
                    ${['inscrito', 'cursando', 'aprobado', 'reprobado', 'retirado'].map(e =>
                      `<option value="${e}"${e === i.estado ? ' selected' : ''}>${e}</option>`).join('')}
                  </select>
                  <label class="sr-solo" for="nota-${esc(i.id)}">Nota</label>
                  <input id="nota-${esc(i.id)}" name="nota" type="number" step="0.1" min="0" max="5" placeholder="Nota"
                         value="${esc(i.nota_final ?? '')}" style="width:5.5rem;min-height:40px">
                  <button class="boton boton--suave" type="submit">Guardar</button>
                  ${['pendiente', 'parcial'].includes(i.estado_pago) ? `<button class="boton boton--suave" type="button" data-pago="${esc(i.id)}">Registrar pago</button>` : ''}
                </form>` },
            { titulo: 'Estado', pintar: i => chip(i.estado,
                i.estado === 'aprobado' ? '' : i.estado === 'reprobado' || i.estado === 'retirado' ? 'distintivo--aviso' : '') },
            { titulo: 'Pago', pintar: i => chip(String(i.estado_pago ?? '').replace('_', ' '),
                i.estado_pago === 'pendiente' ? 'distintivo--aviso' : '') },
            { titulo: 'Nota', pintar: i => i.nota_final ?? '·' },
          ])
        : vacio('👥', 'Nadie inscrito', 'Busque arriba a la primera persona.')}`,
  });

  z.addEventListener('submit', async ev => {
    const f = ev.target.closest('[data-calificar]');
    if (!f) return;
    ev.preventDefault();
    const d = { estado: f.elements.estado.value };
    /* Sin nota escrita, la base conserva la anterior (no la borra). */
    if (f.elements.nota.value.trim()) d.nota = f.elements.nota.value.trim();
    try {
      const r = await api.enviar(`/api/v1/formacion/inscripciones/${f.dataset.calificar}/calificar`, d);
      avisar(r.mensaje, 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });
  z.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-pago]');
    if (!b) return;
    const total = confirm('¿Pagó el valor completo? Aceptar = pagado · Cancelar = pagó una parte');
    const referencia = prompt('Referencia o número de recibo (opcional)') ?? '';
    try {
      const r = await api.enviar(`/api/v1/formacion/inscripciones/${b.dataset.pago}/pago`,
        { estadoPago: total ? 'pagado' : 'parcial', ...(referencia.trim() ? { referencia: referencia.trim() } : {}) });
      avisar(r.mensaje, 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });

  let t;
  z.addEventListener('input', ev => {
    if (ev.target.id !== 'qf') return;
    clearTimeout(t);
    const q = ev.target.value.trim();
    t = setTimeout(async () => {
      const sug = z.querySelector('#sug-f');
      if (!sug) return;
      if (q.length < 2) { sug.innerHTML = ''; return; }
      try {
        const r = await api.obtener('/api/v1/personas?limite=8&q=' + encodeURIComponent(q));
        const filas = Array.isArray(r) ? r : (r?.datos ?? r?.filas ?? []);
        sug.innerHTML = filas.length ? `<div class="tarjeta" style="display:grid;gap:.4rem;margin-bottom:1rem">
          ${filas.map(p => `<button class="boton boton--suave" data-inscribir="${esc(p.id)}" style="text-align:left">
             ${esc(p.nombre ?? p.nombre_completo ?? '')}</button>`).join('')}</div>`
          : `<p class="ayuda">Nadie coincide.</p>`;
        sug.querySelectorAll('[data-inscribir]').forEach(b => b.addEventListener('click', async () => {
          try {
            const pago = z.querySelector('#qf-pago')?.value;
            const r = await api.enviar(`/api/v1/formacion/cohortes/${id}/inscribir`,
              { personaId: b.dataset.inscribir, ...(pago ? { estadoPago: pago } : {}) });
            avisar(r.repetido ? r.mensaje : 'Inscrito.', r.repetido ? 'aviso' : 'exito');
            if (r.aviso) avisar(r.aviso, 'aviso');
            z.querySelector('#qf').value = ''; sug.innerHTML = ''; recargar();
          } catch (e) { avisar(e.message, 'error'); }
        }));
      } catch (e) { sug.innerHTML = `<p class="ayuda">${esc(e.message)}</p>`; }
    }, 300);
  });
}
