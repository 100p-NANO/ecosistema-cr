/**
 * El cliente de la API.
 *
 * ⛔ 19 sep 2026 · Lo que cambió. El prototipo mandaba la identidad en la
 * cabecera `X-Persona-Id`, leída de `localStorage`. Un permiso que se puede
 * editar con el inspector del navegador no es un permiso. Ahora va un token
 * firmado, se renueva solo, y si la base dice que la sesión murió, se cae la
 * sesión aquí también: la verdad está en el servidor.
 */
const BASE = window.CASAROCA_API ?? 'http://127.0.0.1:3000';
const LLAVE_ACCESO = 'cr.acceso';
const LLAVE_REFRESCO = 'cr.refresco';

/* ⛔ Los tokens viven en memoria y se espejan en sessionStorage, no en
   localStorage: sessionStorage muere al cerrar la pestaña, que es lo que
   uno espera de una sesión en un computador compartido de recepción. */
let acceso = sessionStorage.getItem(LLAVE_ACCESO) ?? null;
let refresco = sessionStorage.getItem(LLAVE_REFRESCO) ?? null;
let renovando = null;

export const hayTokens = () => !!acceso;

export function guardarTokens(t) {
  acceso = t?.acceso ?? null; refresco = t?.refresco ?? null;
  if (acceso) sessionStorage.setItem(LLAVE_ACCESO, acceso); else sessionStorage.removeItem(LLAVE_ACCESO);
  if (refresco) sessionStorage.setItem(LLAVE_REFRESCO, refresco); else sessionStorage.removeItem(LLAVE_REFRESCO);
}

export function borrarTokens() { guardarTokens(null); }

export class ErrorApi extends Error {
  constructor(mensaje, estado, peticionId, datos) {
    super(mensaje); this.estado = estado; this.peticionId = peticionId; this.datos = datos;
  }
}

async function crudo(ruta, opciones = {}, reintentar = true) {
  const cabeceras = { 'Content-Type': 'application/json', ...(opciones.headers ?? {}) };
  if (acceso) cabeceras.Authorization = `Bearer ${acceso}`;

  let r;
  try {
    r = await fetch(BASE + ruta, { ...opciones, headers: cabeceras });
  } catch {
    throw new ErrorApi('No hay conexión con el servidor. Revise su red e inténtelo otra vez.', 0, null);
  }

  /* 401 con token: se intenta renovar UNA vez. Si el refresco tampoco
     sirve, la sesión murió de verdad (la cerraron, venció, o se revocó). */
  if (r.status === 401 && reintentar && refresco) {
    if (!renovando) {
      renovando = fetch(BASE + '/api/v1/auth/refrescar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresco }),
      }).then(async res => {
        if (!res.ok) throw new Error('refresco rechazado');
        guardarTokens(await res.json());
      }).finally(() => { renovando = null; });
    }
    try { await renovando; return crudo(ruta, opciones, false); }
    catch { borrarTokens(); window.dispatchEvent(new CustomEvent('cr:sesion-caida')); }
  }

  const peticionId = r.headers.get('X-Peticion-Id');
  let cuerpo = null;
  try { cuerpo = await r.json(); } catch { /* sin cuerpo */ }

  if (!r.ok) {
    const mensaje = cuerpo?.mensaje ?? cuerpo?.message ?? `Error ${r.status}`;
    throw new ErrorApi(mensaje, r.status, peticionId, cuerpo);
  }
  return cuerpo;
}

export const api = {
  obtener: (ruta) => crudo(ruta),
  enviar:  (ruta, datos) => crudo(ruta, { method: 'POST', body: JSON.stringify(datos ?? {}) }),
  cambiar: (ruta, datos) => crudo(ruta, { method: 'PUT',  body: JSON.stringify(datos ?? {}) }),
  borrar:  (ruta) => crudo(ruta, { method: 'DELETE' }),
  base: BASE,
};
