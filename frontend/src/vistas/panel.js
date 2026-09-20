import { api } from '../api.js';
import { esc, cargando, error, distintivoNivel } from '../ui.js';

/** El panel se pinta contra lo que la BASE dice que esta persona alcanza,
    no contra una lista escrita en el cliente. Ahí estaba el agujero del
    prototipo: se podía abrir una pestaña que el permiso ya negaba. */
export async function pintarPanel(c, sesion) {
  c.innerHTML = cargando(4);
  try {
    const [sedes, salud] = await Promise.all([
      api.obtener('/api/v1/organizacion/sedes').catch(() => []),
      api.obtener('/salud/detalle').catch(() => null),
    ]);
    const s = sesion.alcance ?? {};
    c.innerHTML = `
      <h1>Buen día${sesion.persona?.nombre ? ', ' + esc(sesion.persona.nombre.split(' ')[0]) : ''}</h1>
      <p class="etiqueta">lo que usted alcanza hoy</p>
      <div class="rejilla" style="margin:1rem 0 2rem">
        ${ficha('Sedes', s.todaLaRed ? 'Toda la red' : String(s.sedes?.length ?? 0),
                s.todaLaRed ? 'alcance de organización' : 'sedes asignadas')}
        ${ficha('Nivel de acceso', 'N' + (s.nivelMax ?? 0), textoNivel(s.nivelMax ?? 0))}
        ${ficha('Módulos', String(sesion.modulos?.length ?? 0), 'a los que puede entrar')}
        ${ficha('Roles', String(sesion.asignaciones?.length ?? 0), 'vigentes hoy')}
      </div>

      <h2>Sus módulos</h2>
      ${(sesion.modulos ?? []).length ? `
        <div class="rejilla">
          ${sesion.modulos.map(m => `
            <div class="tarjeta">
              <h3 style="margin-bottom:.4rem">${esc(m.nombre ?? m.modulo)}</h3>
              ${distintivoNivel(Number(m.nivel_dato ?? 0))}
            </div>`).join('')}
        </div>` :
        `<div class="tarjeta"><p>Todavía no tiene módulos asignados. Comuníquese con la central.</p></div>`}

      ${sedes.length ? `
        <h2 style="margin-top:2rem">Sedes que alcanza</h2>
        <div class="tarjeta" style="padding:0;overflow:hidden">
          <table class="tabla">
            <thead><tr><th>Código</th><th>Sede</th><th>Ciudad</th></tr></thead>
            <tbody>${sedes.slice(0, 40).map(x => `
              <tr><td data-th="Código"><code>${esc(x.codigo)}</code></td>
                  <td data-th="Sede">${esc(x.nombre)}</td>
                  <td data-th="Ciudad">${esc(x.ciudad ?? '')}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}

      ${salud ? `
        <h2 style="margin-top:2rem">Estado del sistema</h2>
        <div class="tarjeta">
          <p>${salud.estado === 'sano'
            ? '<span class="distintivo distintivo--ok">sano</span>'
            : '<span class="distintivo distintivo--aviso">con problemas</span>'}
            ${(salud.problemas ?? []).map(p => `<br><span class="etiqueta">${esc(p)}</span>`).join('')}</p>
        </div>` : ''}
    `;
  } catch (e) { c.innerHTML = error(e.message, e.peticionId); }
}

const ficha = (t, v, p) => `
  <div class="tarjeta">
    <p class="etiqueta">${esc(t)}</p>
    <p style="font-family:var(--cr-fuente-display);font-size:1.9rem;line-height:1.1;margin:.2rem 0">${esc(v)}</p>
    <p style="color:var(--cr-texto-suave);font-size:var(--cr-tx-sm);margin:0">${esc(p)}</p>
  </div>`;

const textoNivel = (n) => n >= 4 ? 'incluye menores y salud'
  : n === 3 ? 'incluye consejería y aportes'
  : n === 2 ? 'datos personales' : 'solo datos internos';
