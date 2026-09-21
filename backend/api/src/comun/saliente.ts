import { Logger } from '@nestjs/common';

/**
 * Llamadas a terceros: SendGrid, Google reCAPTCHA y los que vengan.
 *
 * ⛔ Estación 21 del manual. Antes cada `fetch` salía desnudo: sin tiempo
 * de espera (un proveedor lento dejaba la petición colgada hasta que el
 * balanceador la cortara), sin distinguir un error pasajero de uno
 * definitivo, y sin cortacircuitos: con SendGrid caído, cada aviso del
 * lote esperaba su propio fallo.
 *
 * Tres reglas, en un solo sitio:
 *  1. Tiempo de espera en TODA llamada.
 *  2. Pasajero (red, 429, 5xx) frente a definitivo (el resto de 4xx): lo
 *     definitivo no se reintenta, porque repetirlo no lo arregla.
 *  3. Cortacircuitos por tercero: tras N fallos pasajeros seguidos se deja
 *     de llamar un rato y se responde en modo degradado.
 */

const log = new Logger('Saliente');

export type Resultado =
  | { ok: true; estado: number; respuesta: Response; ms: number }
  | { ok: false; pasajero: boolean; estado: number | null; error: string; esperarSegundos: number | null; ms: number };

interface Circuito { fallosSeguidos: number; abiertoHasta: number }
const circuitos = new Map<string, Circuito>();

/** El último intento de cada tercero, para la vista de salud del operador. */
export interface Ultimo { en: string; ok: boolean; estado: number | null; ms: number; error: string | null }
const ultimos = new Map<string, Ultimo>();
export function estadoDeTerceros(): Record<string, { ultimo: Ultimo | null; circuitoAbierto: boolean; fallosSeguidos: number }> {
  const salida: Record<string, any> = {};
  for (const t of new Set([...ultimos.keys(), ...circuitos.keys()])) {
    salida[t] = { ultimo: ultimos.get(t) ?? null, circuitoAbierto: circuitoAbierto(t),
                  fallosSeguidos: circuitos.get(t)?.fallosSeguidos ?? 0 };
  }
  return salida;
}

const UMBRAL = Number(process.env.CORTACIRCUITOS_UMBRAL ?? 5);
const ABIERTO_MS = Number(process.env.CORTACIRCUITOS_MS ?? 60_000);

export function circuitoAbierto(tercero: string): boolean {
  const c = circuitos.get(tercero);
  return !!c && c.abiertoHasta > Date.now();
}

/** Solo para las pruebas: vuelve al estado inicial. */
export function reiniciarCircuitos(): void { circuitos.clear(); }

function anotar(tercero: string, pasajero: boolean, exito: boolean) {
  const c = circuitos.get(tercero) ?? { fallosSeguidos: 0, abiertoHasta: 0 };
  if (exito || !pasajero) { c.fallosSeguidos = 0; circuitos.set(tercero, c); return; }
  c.fallosSeguidos += 1;
  if (c.fallosSeguidos >= UMBRAL) {
    c.abiertoHasta = Date.now() + ABIERTO_MS;
    log.warn(`⛔ cortacircuitos ABIERTO para ${tercero}: ${c.fallosSeguidos} fallos seguidos. No se le llama durante ${ABIERTO_MS / 1000} s.`);
  }
  circuitos.set(tercero, c);
}

function esperaDe(r: Response): number | null {
  const v = r.headers.get('retry-after');
  if (!v) return null;
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(1, Math.round(n));
  const fecha = Date.parse(v);
  return Number.isFinite(fecha) ? Math.max(1, Math.round((fecha - Date.now()) / 1000)) : null;
}

/**
 * Llama a un tercero con tiempo de espera, clasifica el resultado y lleva
 * la cuenta del cortacircuitos. NUNCA lanza: devuelve un Resultado, para
 * que quien llama decida qué es el modo degradado en su caso.
 */
export async function llamarTercero(
  tercero: string, url: string, init: RequestInit,
  opciones: { esperaMs?: number; peticionId?: string } = {},
): Promise<Resultado> {
  const inicio = Date.now();
  if (circuitoAbierto(tercero)) {
    return { ok: false, pasajero: true, estado: null, esperarSegundos: Math.ceil(ABIERTO_MS / 1000),
             error: `Cortacircuitos abierto: ${tercero} falló ${UMBRAL} veces seguidas; se reintenta más tarde.`, ms: 0 };
  }
  try {
    const respuesta = await fetch(url, { ...init, signal: AbortSignal.timeout(opciones.esperaMs ?? 10_000) });
    const ms = Date.now() - inicio;
    const estado = respuesta.status;
    log.log(`${opciones.peticionId ?? '-'} ${tercero} ${init.method ?? 'GET'} → ${estado} · ${ms} ms`);
    ultimos.set(tercero, { en: new Date().toISOString(), ok: estado >= 200 && estado < 300, estado, ms,
                           error: estado >= 200 && estado < 300 ? null : `respondió ${estado}` });
    if (estado >= 200 && estado < 300) {
      anotar(tercero, false, true);
      return { ok: true, estado, respuesta, ms };
    }
    const pasajero = estado === 429 || estado >= 500;
    anotar(tercero, pasajero, false);
    const cuerpo = (await respuesta.text().catch(() => '')).slice(0, 300);
    return { ok: false, pasajero, estado, esperarSegundos: esperaDe(respuesta),
             error: `${tercero} respondió ${estado}${cuerpo ? ': ' + cuerpo : ''}`, ms };
  } catch (e: any) {
    const ms = Date.now() - inicio;
    const agotado = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    log.warn(`${opciones.peticionId ?? '-'} ${tercero} ${init.method ?? 'GET'} → ${agotado ? 'SIN RESPUESTA' : 'ERROR DE RED'} · ${ms} ms`);
    anotar(tercero, true, false);
    ultimos.set(tercero, { en: new Date().toISOString(), ok: false, estado: null, ms,
                           error: agotado ? 'sin respuesta a tiempo' : 'error de red' });
    return { ok: false, pasajero: true, estado: null, esperarSegundos: null, ms,
             error: agotado ? `${tercero} no respondió a tiempo (${opciones.esperaMs ?? 10_000} ms)` : `${tercero}: ${String(e?.message ?? e)}` };
  }
}
