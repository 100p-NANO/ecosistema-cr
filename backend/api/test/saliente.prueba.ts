/**
 * Prueba del cliente de terceros (`src/comun/saliente.ts`).
 *
 * Un servidor local hace de proveedor y se porta mal a propósito: tarda,
 * se cae, pide esperar o rechaza para siempre. Se comprueba que cada caso
 * se clasifique bien y que el cortacircuitos se abra y se cierre.
 * Corre sin red y sin llaves: `npm run probar:saliente`.
 */
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { llamarTercero, circuitoAbierto, reiniciarCircuitos } from '../src/comun/saliente';

const res: Array<{ n: number; caso: string; esperado: string; obtenido: string; pasa: boolean }> = [];
const rg = (n: number, caso: string, esperado: string, obtenido: string, pasa: boolean) =>
  res.push({ n, caso, esperado, obtenido, pasa });

async function main() {
  const servidor: Server = createServer((req, r) => {
    const ruta = req.url ?? '/';
    if (ruta === '/lento') { setTimeout(() => { r.writeHead(200); r.end('tarde'); }, 800); return; }
    if (ruta === '/caido') { r.writeHead(503); r.end('servicio no disponible'); return; }
    if (ruta === '/espera') { r.writeHead(429, { 'Retry-After': '42' }); r.end('despacio'); return; }
    if (ruta === '/malo') { r.writeHead(400); r.end('direccion invalida'); return; }
    r.writeHead(202); r.end('ok');
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', () => ok()));
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

  reiniciarCircuitos();
  const bien = await llamarTercero('prueba', `${base}/bien`, { method: 'POST' });
  rg(1, 'Una respuesta 2xx se toma como éxito', 'ok 202', `${bien.ok ? 'ok' : 'falla'} ${bien.ok ? bien.estado : ''}`, bien.ok && bien.estado === 202);

  const lento = await llamarTercero('lento', `${base}/lento`, { method: 'GET' }, { esperaMs: 200 });
  rg(2, 'Un proveedor lento se corta por tiempo', 'pasajero · no respondió a tiempo',
     lento.ok ? 'respondió' : `${lento.pasajero ? 'pasajero' : 'definitivo'} · ${lento.error}`,
     !lento.ok && lento.pasajero && /no respondió a tiempo/.test(lento.error));

  const caido = await llamarTercero('caido', `${base}/caido`, { method: 'GET' });
  rg(3, 'Un 503 es pasajero (se reintenta)', 'pasajero', caido.ok ? 'ok' : (caido.pasajero ? 'pasajero' : 'definitivo'),
     !caido.ok && caido.pasajero);

  const espera = await llamarTercero('espera', `${base}/espera`, { method: 'GET' });
  rg(4, 'Un 429 respeta el Retry-After del proveedor', 'pasajero · 42 s',
     espera.ok ? 'ok' : `${espera.pasajero ? 'pasajero' : 'definitivo'} · ${espera.esperarSegundos} s`,
     !espera.ok && espera.pasajero && espera.esperarSegundos === 42);

  const malo = await llamarTercero('malo', `${base}/malo`, { method: 'GET' });
  rg(5, 'Un 400 es definitivo (repetirlo no lo arregla)', 'definitivo',
     malo.ok ? 'ok' : (malo.pasajero ? 'pasajero' : 'definitivo'), !malo.ok && !malo.pasajero);

  // El cortacircuitos: tres fallos pasajeros seguidos (umbral de la prueba) lo abren.
  reiniciarCircuitos();
  for (let i = 0; i < 3; i++) await llamarTercero('sendgrid-falso', `${base}/caido`, { method: 'GET' });
  rg(6, 'Tras N fallos seguidos, el cortacircuitos se abre', 'abierto',
     circuitoAbierto('sendgrid-falso') ? 'abierto' : 'cerrado', circuitoAbierto('sendgrid-falso'));
  const bloqueada = await llamarTercero('sendgrid-falso', `${base}/bien`, { method: 'GET' });
  rg(7, 'Con el circuito abierto no se llama al proveedor', 'rechazada sin llamar',
     bloqueada.ok ? 'llamó' : (bloqueada.ms === 0 ? 'rechazada sin llamar' : 'llamó y falló'),
     !bloqueada.ok && bloqueada.ms === 0 && /Cortacircuitos abierto/.test(bloqueada.error));
  const otro = await llamarTercero('otro', `${base}/bien`, { method: 'GET' });
  rg(8, 'El circuito de un tercero no afecta a otro', 'ok', otro.ok ? 'ok' : 'bloqueado', otro.ok);

  await new Promise((ok) => setTimeout(ok, 600));   // CORTACIRCUITOS_MS=500 en la prueba
  const vuelve = await llamarTercero('sendgrid-falso', `${base}/bien`, { method: 'GET' });
  rg(9, 'Pasado el tiempo, el circuito se cierra y vuelve a llamar', 'ok',
     vuelve.ok ? 'ok' : vuelve.error, vuelve.ok && !circuitoAbierto('sendgrid-falso'));

  reiniciarCircuitos();
  await llamarTercero('mixto', `${base}/malo`, { method: 'GET' });
  await llamarTercero('mixto', `${base}/malo`, { method: 'GET' });
  await llamarTercero('mixto', `${base}/malo`, { method: 'GET' });
  rg(10, 'Los errores definitivos NO abren el circuito', 'cerrado',
     circuitoAbierto('mixto') ? 'abierto' : 'cerrado', !circuitoAbierto('mixto'));

  servidor.close();
  const fallan = res.filter((r) => !r.pasa);
  console.log('\n===== LLAMADAS A TERCEROS: TIEMPO, CLASE Y CORTACIRCUITOS =====');
  for (const r of res) console.log(` ${String(r.n).padStart(2)} | ${r.caso.padEnd(56)} | ${r.obtenido.padEnd(34)} | ${r.pasa ? 'PASA' : 'FALLA'}`);
  console.log(`\n pasan: ${res.length - fallan.length} · fallan: ${fallan.length} · total: ${res.length}`);
  process.exit(fallan.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
