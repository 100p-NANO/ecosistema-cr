/* Configuración de ejecución: dónde está la API y qué versión corre.
   ⛔ Va en un archivo aparte, no en un <script> dentro del HTML: la
   política de seguridad del sitio (nginx.conf) prohíbe los scripts en
   línea, y ahí la aplicación se quedaba sin saber dónde estaba la API y
   llamaba a 127.0.0.1. En el contenedor este archivo lo REESCRIBE al
   arrancar `40-configuracion.sh`, con las variables de Cloud Run. Este es
   el valor de desarrollo. */
window.CASAROCA_API = window.CASAROCA_API ?? 'http://127.0.0.1:3000';
window.CASAROCA_VERSION = window.CASAROCA_VERSION ?? 'dev';
