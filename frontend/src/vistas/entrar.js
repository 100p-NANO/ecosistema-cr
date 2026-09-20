import { api, guardarTokens } from '../api.js';
import { esc, unaVez } from '../ui.js';

/**
 * Entrar. Tres pasos posibles, y el segundo casi nadie lo cuenta:
 *   1 · usuario y contraseña
 *   2 · si el rol alcanza datos N3 o N4 y el segundo factor no está activo,
 *       se configura AQUÍ. No se deja a la persona fuera de su cuenta, pero
 *       tampoco entra a los datos.
 *   3 · código de seis dígitos en cada entrada.
 */
export function pintarEntrar(contenedor, alEntrar, mensajeInicial = '') {
  let paso = 'clave';
  let tokenLimitado = null, secreto = null, uri = null;

  function pintar(mensaje = '', tipo = 'error') {
    contenedor.innerHTML = `
      <main class="entrar">
        <div class="entrar__caja">
          <div class="entrar__marca">
            <h1>Casa Sobre la Roca</h1>
            <p>Sistema de la red · 36 sedes</p>
          </div>
          <div class="tarjeta">
            ${mensaje ? `<div class="aviso aviso--${tipo}" role="alert">${esc(mensaje)}</div>` : ''}
            ${paso === 'clave' ? formularioClave()
            : paso === 'configurar' ? formularioConfigurar()
            : formularioCodigo()}
          </div>
          <p class="pie">Versión <code>${esc(window.CASAROCA_VERSION ?? 'dev')}</code></p>
        </div>
      </main>`;
    contenedor.querySelector('form')?.addEventListener('submit', enviar);
    contenedor.querySelector('input')?.focus();
  }

  const formularioClave = () => `
    <form novalidate>
      <div class="campo">
        <label for="usuario">Usuario</label>
        <input id="usuario" name="usuario" type="email" autocomplete="username"
               inputmode="email" required autocapitalize="off" spellcheck="false">
      </div>
      <div class="campo">
        <label for="clave">Contraseña</label>
        <input id="clave" name="clave" type="password" autocomplete="current-password" required>
        <span class="ayuda">Una frase larga que usted recuerde protege más que un jeroglífico.</span>
      </div>
      <button class="boton boton--ancho" type="submit">Entrar</button>
    </form>`;

  const formularioCodigo = () => `
    <form novalidate>
      <p>Escriba el código de seis dígitos de su aplicación de autenticación.</p>
      <div class="campo">
        <label for="codigo">Código</label>
        <input id="codigo" name="codigo" inputmode="numeric" pattern="[0-9]{6}" maxlength="6"
               autocomplete="one-time-code" required style="font-family:var(--cr-fuente-mono);font-size:1.4rem;letter-spacing:.3em;text-align:center">
      </div>
      <button class="boton boton--ancho" type="submit">Continuar</button>
    </form>`;

  const formularioConfigurar = () => `
    <form novalidate>
      <h2>Active su segundo factor</h2>
      <p>Su rol alcanza datos sensibles: menores, consejería o aportes de la red.
         Antes de entrar tiene que activar el segundo factor.</p>
      <ol style="padding-left:1.1rem;color:var(--cr-texto-suave);font-size:var(--cr-tx-sm)">
        <li>Abra su aplicación de autenticación.</li>
        <li>Agregue una cuenta con esta clave:</li>
      </ol>
      <p style="font-family:var(--cr-fuente-mono);background:var(--cr-superficie-2);padding:.8rem;
                border-radius:var(--cr-radio-md);word-break:break-all;text-align:center;letter-spacing:.08em">
        ${esc(secreto ?? '')}
      </p>
      <div class="campo">
        <label for="codigo">Escriba el código que le muestra</label>
        <input id="codigo" name="codigo" inputmode="numeric" pattern="[0-9]{6}" maxlength="6"
               autocomplete="one-time-code" required style="font-family:var(--cr-fuente-mono);font-size:1.4rem;letter-spacing:.3em;text-align:center">
      </div>
      <button class="boton boton--ancho" type="submit">Activar y entrar</button>
    </form>`;

  let usuario = '', clave = '';

  async function enviar(ev) {
    ev.preventDefault();
    const boton = ev.target.querySelector('button');
    unaVez(boton, async () => {
      try {
        if (paso === 'clave') {
          usuario = ev.target.usuario.value.trim();
          clave = ev.target.clave.value;
          const r = await api.enviar('/api/v1/auth/entrar', { usuario, clave });
          if (r.debeConfigurarSegundoFactor) {
            tokenLimitado = r.acceso;
            guardarTokens({ acceso: r.acceso, refresco: null });
            const ini = await api.enviar('/api/v1/auth/segundo-factor/iniciar', {});
            secreto = ini.secreto; uri = ini.uri; paso = 'configurar';
            return pintar('', 'info');
          }
          guardarTokens(r); return alEntrar(r);
        }

        if (paso === 'configurar') {
          await api.enviar('/api/v1/auth/segundo-factor/activar', { codigo: ev.target.codigo.value });
          const r = await api.enviar('/api/v1/auth/entrar', { usuario, clave, codigo: ev.target.codigo.value });
          guardarTokens(r); return alEntrar(r);
        }

        const r = await api.enviar('/api/v1/auth/entrar', { usuario, clave, codigo: ev.target.codigo.value });
        guardarTokens(r); return alEntrar(r);
      } catch (e) {
        if (e.datos?.faltaSegundoFactor) { paso = 'codigo'; return pintar('', 'info'); }
        pintar(e.message);
      }
    });
  }

  pintar(mensajeInicial, mensajeInicial ? 'error' : 'info');
}
