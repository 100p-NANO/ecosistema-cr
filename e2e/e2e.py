"""Ayudante de pruebas de punta a punta: un navegador real contra el puesto del agente.

    import sys; sys.path.insert(0, '<carpeta e2e>')
    from e2e import Navegador, sql, token
    nav = Navegador(7, persona='<uuid>', movil=False)       # o demo=True para el modo demostración
    nav.ir('index.html#/grupos')                             # consola: 'master/#/cuentas' · portal: 'portal/'
    nav.p.get_by_role('button', name='Guardar').click()      # nav.p es la página de Playwright
    nav.esperar()                                            # red en reposo
    print(nav.red[-1])                                       # la última petición a la API: método, url, cuerpo, estado, respuesta
    print(nav.errores())                                     # errores de consola y de página
    print(nav.desbordes())                                   # elementos que se salen del ancho (móvil)
    nav.captura('grupos-lista')                              # PNG en slots/<nn>/capturas/
    print(sql(7, "SELECT count(*) FROM grupos.grupos"))      # preguntarle a la base
    nav.cerrar()
"""
import json, os, re, subprocess
from playwright.sync_api import sync_playwright

E2E = os.path.dirname(os.path.abspath(__file__))


def puertos(n):
    return 3500 + int(n), 5500 + int(n)


def _slot(n, *args):
    return subprocess.run([os.path.join(E2E, 'slot.sh'), str(n), *args], capture_output=True, text=True)


def token(n, persona):
    r = _slot(n, 'token', persona)
    t = (r.stdout.strip().splitlines() or [''])[-1]
    if not re.match(r'^[\w-]+\.[\w-]+\.[\w-]+$', t):
        raise RuntimeError(f'No hubo token para {persona}: {r.stdout[-400:]} {r.stderr[-400:]}')
    return t


def sql(n, consulta):
    r = _slot(n, 'sql', consulta)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or r.stdout.strip())
    return r.stdout.strip()


class Navegador:
    def __init__(self, n, persona=None, movil=False, demo=False):
        self.n = int(n)
        self.api, front = puertos(n)
        self.base = f'http://127.0.0.1:{front}'
        self.demo = demo
        self.pw = sync_playwright().start()
        self.b = self.pw.chromium.launch()
        vp = {'width': 375, 'height': 812} if movil else {'width': 1280, 'height': 860}
        self.ctx = self.b.new_context(viewport=vp, locale='es-CO', timezone_id='America/Bogota')
        self.red, self.consola = [], []
        if persona and not demo:
            t = token(self.n, persona)
            self.ctx.add_init_script(f"sessionStorage.setItem('cr.acceso', {json.dumps(t)});")
        self.p = self.ctx.new_page()
        self.p.on('console', lambda m: self.consola.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        self.p.on('pageerror', lambda e: self.consola.append(f'pageerror: {e}'))
        # confirm() y prompt() de la aplicación: se aceptan y quedan en self.dialogos. Para un prompt,
        # nav.respuesta_dialogo = 'texto' antes del clic; nav.aceptar_dialogos = False para cancelar.
        self.dialogos, self.respuesta_dialogo, self.aceptar_dialogos = [], '', True

        def dialogo(d):
            self.dialogos.append(f'{d.type}: {d.message}')
            if not self.aceptar_dialogos:
                d.dismiss()
            elif d.type == 'prompt':
                d.accept(self.respuesta_dialogo)
            else:
                d.accept()
        self.p.on('dialog', dialogo)

        def respuesta(r):
            if '/api/' not in r.url and '/salud' not in r.url:
                return
            try:
                cuerpo = r.request.post_data
            except Exception:
                cuerpo = None
            try:
                texto = r.text()[:3000]
            except Exception:
                texto = ''
            self.red.append({'metodo': r.request.method, 'url': r.url.replace(f'http://127.0.0.1:{self.api}', ''),
                             'estado': r.status, 'cuerpo': cuerpo, 'respuesta': texto})
        self.p.on('response', respuesta)

    def ir(self, ruta='index.html#/panel'):
        if self.demo:
            ruta, _, hash_ = ruta.partition('#')
            ruta = ruta + ('&' if '?' in ruta else '?') + 'demo=1' + ('#' + hash_ if hash_ else '')
        self.p.goto(f'{self.base}/{ruta}')
        self.esperar()

    def esperar(self, ms=400):
        try:
            self.p.wait_for_load_state('networkidle', timeout=15000)
        except Exception:
            pass
        self.p.wait_for_timeout(ms)

    def errores(self):
        return list(self.consola)

    def desbordes(self):
        return self.p.evaluate("""() => {
          const w = document.documentElement.clientWidth, fuera = [];
          for (const e of document.querySelectorAll('body *')) {
            if (e.closest('.tabla, table, pre, code, [data-scroll]')) continue;
            const r = e.getBoundingClientRect();
            if (r.width && r.right > w + 1) fuera.push((e.tagName + '.' + (e.className || '')).slice(0, 80));
          }
          return { ancho_documento: document.documentElement.scrollWidth, ancho_vista: w, fuera: fuera.slice(0, 15) };
        }""")

    def texto(self, selector='main'):
        try:
            return self.p.inner_text(selector)
        except Exception:
            return self.p.inner_text('body')

    def captura(self, nombre):
        carpeta = os.path.join(E2E, 'slots', f'{self.n:02d}', 'capturas')
        os.makedirs(carpeta, exist_ok=True)
        ruta = os.path.join(carpeta, f'{nombre}.png')
        self.p.screenshot(path=ruta, full_page=True)
        return ruta

    def cerrar(self):
        try:
            self.b.close()
        finally:
            self.pw.stop()
