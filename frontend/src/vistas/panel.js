import { api } from '../api.js';
import { esc, cargando, error, errorDeBloque, engancharReintentar, distintivoNivel } from '../ui.js';
import { linea, columnas, barrasH, chispa, variacion, SERIE } from '../graficos.js';
import { cabCelda, aviso, avisos, n, fmt, esPequeno, fechaCorta } from '../tablero.js';
import { cifraViva, engancharDetalles } from '../detalle.js';
import { detallesPastorales } from '../detalles.js';

/** El panel se pinta contra lo que la BASE dice que esta persona alcanza,
    no contra una lista escrita en el cliente. Ahí estaba el agujero del
    prototipo: se podía abrir una pestaña que el permiso ya negaba.

    5 oct 2026 · Rediseño: el panel dejó de ser cuatro cuadros con un
    número. Ahora abre con lo que hay que ATENDER hoy (cada aviso con su
    botón), sigue con cómo viene la asistencia y los niños, el recorrido de
    los nuevos y, al final, el alcance de la cuenta. Cada bloque pide su
    dato aparte: si uno falla, dice cuál y los demás se pintan. */
export async function pintarPanel(c, sesion) {
  c.innerHTML = cargando(4);
  const tiene = (m) => sesion.alcance?.todaLaRed
    || (sesion.modulos ?? []).some(x => (x.modulo ?? x.codigo ?? x) === m);
  const pedir = (ok, ruta) => ok ? api.obtener(ruta) : Promise.resolve(null);
  try {
    /* ⛔ Antes cada bloque hacía `.catch(() => [])` y la pantalla se pintaba
       como si todo estuviera bien. Ahora cada bloque dice lo suyo. */
    const [rSedes, rSalud, rTab, rPerd, rNuevos] = await Promise.allSettled([
      api.obtener('/api/v1/organizacion/sedes'),
      api.obtener('/salud/detalle'),
      pedir(tiene('analitica'), '/api/v1/analitica/tablero'),
      pedir(tiene('analitica') || tiene('crm'), '/api/v1/crm/se-estan-perdiendo?limite=50'),
      pedir(tiene('crm'), '/api/v1/nuevos/dashboard'),
    ]);
    const val = (r) => r.status === 'fulfilled' ? r.value : null;
    const falla = (r) => r.status === 'rejected' ? r.reason : null;
    const sedes = val(rSedes), salud = val(rSalud), tab = val(rTab), perd = val(rPerd), nue = val(rNuevos);
    const s = sesion.alcance ?? {};
    const modulos = sesion.modulos ?? [];
    const nombre = sesion.persona?.nombre ? ', ' + esc(sesion.persona.nombre.split(' ')[0]) : '';

    /* ── Lo que pide atención hoy ─────────────────────────────── */
    const nuevosLista = nue?.nuevos ?? [];
    const atrasados = nuevosLista.filter(x => String(x.proxima_accion).toUpperCase() === 'ATRASADO');
    const sinLlamar = nuevosLista.filter(x => x.estado === 'nuevo' && !n(x.contactos));
    const perdidos = perd?.personas ?? [];
    const lista = [
      atrasados.length && aviso({ tono: 'urgente',
        titulo: `${atrasados.length} ${atrasados.length === 1 ? 'nuevo tiene' : 'nuevos tienen'} el seguimiento atrasado`,
        detalle: esc(atrasados.slice(0, 3).map(x => x.nombre).join(', ')) + ' · un nuevo que nadie llama en la primera semana casi nunca vuelve',
        accion: { t: 'Contactar', ir: 'nuevos' } }),
      perdidos.length && aviso({ tono: 'urgente',
        titulo: `${perdidos.length} ${perdidos.length === 1 ? 'persona dejó' : 'personas dejaron'} de venir`,
        detalle: esc(perdidos.slice(0, 3).map(x => `${x.nombre} (${x.dias_sin_venir} días)`).join(', ')),
        accion: { t: 'Ver a quién llamar', ir: 'analitica' } }),
      tab && n(tab.grupos_sin_reunion_45_dias) > 0 && aviso({ tono: 'atender',
        titulo: `${fmt(tab.grupos_sin_reunion_45_dias)} grupos llevan más de 45 días sin reunirse`,
        detalle: 'Un grupo que no se reúne es un grupo que se está apagando: hable con su líder.',
        accion: { t: 'Ver grupos', ir: 'grupos' } }),
      tab && (n(tab.tareas_vencidas) > 0 || esPequeno(tab.tareas_vencidas)) && aviso({ tono: 'atender',
        titulo: `${fmt(tab.tareas_vencidas)} tareas vencidas`, accion: { t: 'Ver tareas', ir: 'tareas' } }),
      tab && (n(tab.requerimientos_vencidos) > 0 || esPequeno(tab.requerimientos_vencidos)) && aviso({ tono: 'atender',
        titulo: `${fmt(tab.requerimientos_vencidos)} requerimientos vencidos`, accion: { t: 'Ver requerimientos', ir: 'requerimientos' } }),
      sinLlamar.length > atrasados.length && aviso({ tono: 'atender',
        titulo: `${sinLlamar.length} nuevos todavía sin una primera llamada`, accion: { t: 'Ver nuevos', ir: 'nuevos' } }),
    ];
    const pendientes = lista.filter(Boolean).length;

    /* ── Asistencia: última semana contra el promedio ─────────── */
    const semanas = tab?.asistencia_por_semana ?? [];
    const valores = semanas.map(x => n(x.contados));
    const ultima = valores.at(-1) ?? 0;
    const previas = valores.slice(0, -1);
    const promedio = previas.length ? Math.round(previas.reduce((a, b) => a + b, 0) / previas.length) : 0;
    const maxSem = semanas.length ? semanas[valores.indexOf(Math.max(...valores))] : null;

    const ninos = tab?.ninos_por_domingo ?? [];
    const ninosUlt = n(ninos.at(-1)?.ninos), ninosAnt = n(ninos.at(-2)?.ninos);

    /* ── Nuevos por etapa del seguimiento ─────────────────────── */
    const ETAPAS = [['nuevo', 'Sin contactar'], ['contactado', 'Contactados'], ['en_grupo', 'En un grupo'], ['convertido', 'Integrados']];
    const porEtapa = ETAPAS.map(([k, t], i) => ({ t, v: nuevosLista.filter(x => x.estado === k).length, color: SERIE[i] }));

    c.innerHTML = `
      <div class="bento">
        <section class="bento__celda bento__celda--marca c-8">
          <p class="bento__rotulo">${esc(new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
          <div>
            <h1 style="margin:0 0 .35rem">Buen día${nombre}</h1>
            <p class="bento__pie">${pendientes
              ? `Hoy hay <b>${pendientes} ${pendientes === 1 ? 'asunto' : 'asuntos'}</b> que piden su atención. Empiece por el primero de la lista.`
              : 'Todo lo que usted alcanza está al día. Buen momento para mirar cómo viene la asistencia.'}</p>
          </div>
        </section>
        <section class="bento__celda c-4" aria-label="Estado del sistema">
          ${cabCelda('Estado del sistema', salud?.estado === 'sano'
            ? 'Todo responde: base, colas y servicios.' : salud ? 'Hay algo que no responde bien.' : '')}
          ${falla(rSalud) ? errorDeBloque('el estado del sistema', falla(rSalud).message) : ''}
          ${salud ? `<div>${salud.estado === 'sano'
              ? '<span class="distintivo distintivo--ok">✓ sano</span>'
              : '<span class="distintivo distintivo--aviso">! con problemas</span>'}
              ${(salud.problemas ?? []).map(p => `<br><span class="etiqueta">${esc(p)}</span>`).join('')}</div>` : ''}
        </section>

        <section class="bento__celda c-12" aria-label="Lo que pide atención hoy">
          ${cabCelda('Lo que pide atención hoy', 'Ordenado por urgencia. Cada aviso trae el botón para resolverlo.')}
          ${falla(rTab) ? errorDeBloque('el tablero', falla(rTab).message) : ''}
          ${avisos(lista)}
        </section>

        ${tab ? `
        <section class="bento__celda c-8" aria-label="Asistencia por semana">
          ${cabCelda('Asistencia de las últimas 12 semanas',
            `La semana pasada se contaron <b>${fmt(ultima)}</b> personas. ${variacion(ultima, promedio, { ref: `el promedio de ${fmt(promedio)}` })}
             ${maxSem ? `· El mejor domingo fue el ${esc(fechaCorta(maxSem.semana))}.` : ''}`,
            { t: 'Analítica', ir: 'analitica' })}
          ${linea('Asistencia contada por semana', semanas.map(x => ({ x: x.semana, v: x.contados })), { formatoX: fechaCorta })
            || '<p class="bento__explica">Ningún conteo de puerta reportado en las últimas 12 semanas.</p>'}
        </section>
        <section class="bento__celda c-4" aria-label="Niños por domingo">
          ${cabCelda('Niños en RocaKids', ninos.length
            ? `El último domingo se recibieron <b>${fmt(ninos.at(-1)?.ninos)}</b>. ${variacion(ninosUlt, ninosAnt, { ref: 'el domingo anterior' })}`
            : 'Ningún check-in en las últimas semanas.', tiene('rocakids') ? { t: 'Check-in', ir: 'checkin' } : null)}
          ${columnas('Niños recibidos por domingo', ninos.map((x, i) => ({ x: x.fecha, v: x.ninos, destacar: i === ninos.length - 1 })),
            { formatoX: fechaCorta, alto: 170 })}
        </section>
        ${cifraViva({ clave: 'personas', rotulo: 'Personas activas', valor: tab.personas_activas,
          explica: 'en las sedes que usted alcanza', extra: chispa(valores) })}
        ${cifraViva({ clave: 'grupos', rotulo: 'Grupos activos', valor: tab.grupos_activos,
          explica: n(tab.grupos_sin_reunion_45_dias) ? `${fmt(tab.grupos_sin_reunion_45_dias)} sin reunirse en 45 días` : 'todos se reunieron este mes' })}
        ${cifraViva({ clave: 'oracion', rotulo: 'Oración abierta', valor: tab.peticiones_oracion_abiertas,
          explica: 'peticiones esperando acompañamiento' })}
        ${cifraViva({ clave: 'promedio', rotulo: 'Promedio semanal', valor: String(promedio),
          explica: 'personas por semana, 12 semanas' })}
        ` : ''}

        ${tiene('crm') ? `
        <section class="bento__celda c-6" aria-label="Recorrido de los nuevos">
          ${cabCelda('Recorrido de los nuevos', nuevosLista.length
            ? `De <b>${nuevosLista.length}</b> nuevos, <b>${porEtapa[0].v}</b> siguen sin contactar. La meta es que ninguno pase una semana así.`
            : 'Todavía no hay nuevos registrados.', { t: 'Nuevos', ir: 'nuevos' })}
          ${falla(rNuevos) ? errorDeBloque('los nuevos', falla(rNuevos).message) : ''}
          ${nuevosLista.length ? barrasH('Nuevos por etapa', porEtapa.map(x => ({ ...x, ir: 'nuevos' }))) : ''}
        </section>` : ''}

        <section class="bento__celda ${tiene('crm') ? 'c-6' : 'c-12'}" aria-label="Su acceso">
          ${cabCelda('Su acceso', `${s.todaLaRed ? 'Alcanza <b>toda la red</b>' : `Alcanza <b>${s.sedes?.length ?? 0}</b> sede(s)`},
            con datos hasta el nivel <b>N${s.nivelMax ?? 0}</b> (${esc(textoNivel(s.nivelMax ?? 0))}).`)}
          ${barrasH('Módulos por nivel de sensibilidad', nivelesDe(modulos))
            || '<p class="bento__explica">Todavía no tiene módulos asignados. Comuníquese con la central.</p>'}
          ${modulos.length ? `<details class="gr__datos"><summary>Ver los ${modulos.length} módulos y sus niveles</summary>
            <div class="bento__fichas" style="margin-top:8px">${modulos.map(m => `
              <span class="bento__ficha">${esc(m.nombre ?? m.modulo)} ${distintivoNivel(Number(m.nivel_dato ?? 0))}</span>`).join('')}</div>
          </details>` : ''}
          ${falla(rSedes) ? errorDeBloque('las sedes', falla(rSedes).message) : ''}
          ${sedes?.length ? `<details class="gr__datos"><summary>Ver las ${sedes.length} sedes que alcanza</summary>
            <ul class="bento__lista bento__desliza" style="margin-top:6px">${sedes.slice(0, 40).map(x => `
              <li><span>${esc(x.nombre)} <code>${esc(x.codigo)}</code></span>
                  <span style="color:var(--cr-texto-suave)">${esc(x.ciudad ?? '')}</span></li>`).join('')}</ul>
          </details>` : ''}
        </section>
      </div>
    `;
    if (tab) engancharDetalles(c, detallesPastorales(tab));
    engancharReintentar(c, () => pintarPanel(c, sesion));
  } catch (e) {
    c.innerHTML = error(e.message, e.peticionId);
    engancharReintentar(c, () => pintarPanel(c, sesion));
  }
}

/** Cuántos módulos hay por nivel, agrupados en cuatro partes legibles. */
function nivelesDe(modulos) {
  const c = [0, 0, 0, 0];
  modulos.forEach(m => { const k = Number(m.nivel_dato ?? 0); c[k <= 1 ? 0 : k === 2 ? 1 : k === 3 ? 2 : 3]++; });
  /* Los niveles se pintan con SU color en todo el producto (DISENO.md §2).
     Van en barras con su nombre al lado, no en dona: N2 azul y N3 violeta
     no se distinguen bien como colores solos (validado el 5 oct). */
  return [{ t: 'Internos (N0-N1)', v: c[0], color: '#8A92A6' }, { t: 'Personales (N2)', v: c[1], color: '#2A66C4' },
          { t: 'Sensibles (N3)', v: c[2], color: '#7E57C2' }, { t: 'Menores (N4)', v: c[3], color: '#C13A2B' }].filter(x => x.v);
}

const textoNivel = (n) => n >= 4 ? 'incluye menores y salud'
  : n === 3 ? 'incluye consejería y aportes'
  : n === 2 ? 'datos personales' : 'solo datos internos';
