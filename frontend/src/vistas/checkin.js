import { api } from '../api.js';
import { cola, vigilarConexion } from '../offline.js';
import { esc, vacio, unaVez, avisar } from '../ui.js';

/**
 * Check-in de RocaKids.
 *
 * ⛔ Es el flujo más crítico y el que peor conexión tiene: 2.500 niños
 * entrando a la misma hora, en salones donde el wifi del templo no llega.
 * Por eso escribe primero en la cola local y entrega el comprobante al
 * acudiente SIN esperar al servidor. Lo que no salga ahora, sale al
 * reconectar, y mientras tanto la sala no se detiene.
 */
export function pintarCheckin(c, sesion) {
  c.innerHTML = `
    <h1>Check-in de niños</h1>
    <p class="etiqueta">sala por sala · funciona sin conexión</p>

    <div id="estado-cola" style="margin:1rem 0"></div>

    <div class="tarjeta">
      <form id="f-checkin" novalidate>
        <div class="campo">
          <label for="menor">Nombre del niño o niña</label>
          <input id="menor" name="menor" required autocomplete="off" enterkeyhint="next">
        </div>
        <div class="campo">
          <label for="acudiente">Quién lo entrega</label>
          <input id="acudiente" name="acudiente" required autocomplete="off">
          <span class="ayuda">⛔ Un menor sin acudiente autorizado no se recibe. La base lo rechaza.</span>
        </div>
        <div class="campo">
          <label for="sala">Sala</label>
          <select id="sala" name="sala" required><option value="">Cargando salas…</option></select>
        </div>
        <button class="boton boton--ancho" type="submit">Registrar entrada</button>
      </form>
    </div>

    <div id="comprobante" style="margin-top:1rem"></div>
    <div id="recientes" style="margin-top:1.5rem"></div>`;

  const zonaCola = c.querySelector('#estado-cola');
  const comprobante = c.querySelector('#comprobante');
  const recientes = c.querySelector('#recientes');
  const selectSala = c.querySelector('#sala');
  const hechos = [];

  api.obtener('/api/v1/organizacion/sedes').then(() => {
    /* Las salas vienen del catálogo de la sede. Si la API todavía no expone
       la ruta, se trabaja con las cuatro estándar y se dice claramente. */
    selectSala.innerHTML = `
      <option value="CUNA">Cuna (0 a 2)</option>
      <option value="PARVULOS">Párvulos (3 a 5)</option>
      <option value="EXPLORA">Exploradores (6 a 8)</option>
      <option value="AVENTURA">Aventureros (9 a 11)</option>
      <option value="PREADO">Preadolescentes (12 a 14)</option>`;
  }).catch(() => { selectSala.innerHTML = `<option value="">No se pudieron cargar las salas</option>`; });

  function pintarCola(enLinea) {
    const n = cola.pendientes();
    zonaCola.innerHTML = !enLinea
      ? `<div class="aviso aviso--error" role="status">Sin conexión. <strong>Siga registrando:</strong>
           lo que anote se guarda en este equipo y se envía solo al volver la red.
           ${n ? `Hay ${n} registro(s) esperando.` : ''}</div>`
      : n ? `<div class="aviso aviso--info" role="status">${n} registro(s) esperando envío.
              <button class="boton boton--suave" id="b-vaciar" style="margin-left:.5rem">Enviar ahora</button></div>`
          : `<div class="aviso aviso--ok" role="status">Conectado. Todo enviado.</div>`;
    zonaCola.querySelector('#b-vaciar')?.addEventListener('click', ev => unaVez(ev.target, vaciar));
  }

  async function vaciar() {
    const r = await cola.vaciar(op => api.enviar(op.ruta, op.datos));
    if (r.enviados) avisar(`${r.enviados} registro(s) enviados.`, 'ok');
    for (const x of r.rechazados) avisar(`Un registro fue rechazado: ${x.motivo}`, 'error');
  }

  vigilarConexion(enLinea => { pintarCola(enLinea); if (enLinea && cola.pendientes()) vaciar(); });
  window.addEventListener('cr:cola-cambio', () => pintarCola(navigator.onLine));

  c.querySelector('#f-checkin').addEventListener('submit', ev => {
    ev.preventDefault();
    const f = ev.target;
    const datos = {
      menor: f.menor.value.trim(),
      acudiente: f.acudiente.value.trim(),
      sala: f.sala.value,
      registrado_en: new Date().toISOString(),
    };
    if (!datos.menor || !datos.acudiente || !datos.sala) {
      avisar('Falta el niño, el acudiente o la sala.', 'error'); return;
    }

    unaVez(f.querySelector('button'), async () => {
      /* ⛔ El código de entrega se genera aquí solo para el comprobante en
         papel cuando no hay red. El código que vale es el que cifra la base;
         este se concilia al enviar. */
      const codigo = String(Math.floor(1000 + Math.random() * 9000));
      cola.encolar({ ruta: '/api/v1/rocakids/checkin', datos: { ...datos, codigo_local: codigo } });

      comprobante.innerHTML = `
        <div class="tarjeta" style="text-align:center;border-color:var(--cr-mostaza-500)">
          <p class="etiqueta">comprobante de entrega</p>
          <p style="font-family:var(--cr-fuente-display);font-size:1.4rem;margin:.3rem 0">${esc(datos.menor)}</p>
          <p style="font-family:var(--cr-fuente-mono);font-size:2.4rem;letter-spacing:.2em;margin:.4rem 0">${codigo}</p>
          <p style="color:var(--cr-texto-suave);font-size:var(--cr-tx-sm);margin:0">
            Sala ${esc(datos.sala)} · entregó ${esc(datos.acudiente)}</p>
          <p class="etiqueta" style="margin-top:.6rem">solo con este código se entrega al niño</p>
        </div>`;

      hechos.unshift({ ...datos, codigo });
      recientes.innerHTML = hechos.length ? `
        <p class="etiqueta">registrados en este turno</p>
        <div class="tarjeta" style="padding:0;overflow:hidden;margin-top:.5rem">
          <table class="tabla">
            <thead><tr><th>Niño</th><th>Sala</th><th>Código</th></tr></thead>
            <tbody>${hechos.slice(0, 12).map(h => `
              <tr><td data-th="Niño">${esc(h.menor)}</td>
                  <td data-th="Sala">${esc(h.sala)}</td>
                  <td data-th="Código"><code>${esc(h.codigo)}</code></td></tr>`).join('')}</tbody>
          </table>
        </div>` : '';

      f.reset(); f.menor.focus();
      if (navigator.onLine) vaciar();
    });
  });

  pintarCola(navigator.onLine);
}
