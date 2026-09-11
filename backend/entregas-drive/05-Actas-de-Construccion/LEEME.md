# 05 · Actas de construcción

Constancia formal de qué se construyó y qué quedó publicado en el repositorio de la iglesia,
por componente. Corte del 11 de septiembre de 2026.

| Documento | Componente | Páginas |
|---|---|---|
| `Acta-Construccion-Backend.pdf` | Base de datos y servicios | 5 |
| `Acta-Construccion-Frontend.pdf` | Prototipo navegable y sitio web | 4 |

Cada acta va con su fuente en Markdown, por si hay que corregirla. Para regenerar el PDF:

```
python3 herramientas/md-a-html.py ACTA-BACKEND.md salida.html "Título"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --no-pdf-header-footer --hide-scrollbars --run-all-compositor-stages-before-draw \
  --virtual-time-budget=8000 --print-to-pdf=salida.pdf "file://$PWD/salida.html"
```
