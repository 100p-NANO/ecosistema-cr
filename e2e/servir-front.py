"""Pantallas de un puesto: sirve frontend/ del repositorio y contesta /config.js
apuntando a la API de ESE puesto. Sin caché, para que un arreglo se vea al recargar."""
import functools, http.server, sys

PUERTO, API, RAIZ = int(sys.argv[1]), sys.argv[2], sys.argv[3]
CONFIG = (f"window.CASAROCA_API = 'http://127.0.0.1:{API}';\n"
          f"window.CASAROCA_VERSION = 'e2e · API {API}';\n").encode()


class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?')[0] == '/config.js':
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript; charset=utf-8')
            self.send_header('Content-Length', str(len(CONFIG)))
            self.end_headers()
            self.wfile.write(CONFIG)
            return
        return super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass


class S(http.server.ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True


S(('127.0.0.1', PUERTO), functools.partial(H, directory=RAIZ)).serve_forever()
