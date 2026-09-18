# Frontend · estilos (documento «Arquitectura Fronted y Backed» del Drive 100p)

La estructura es exactamente la que definió Jhon Chávez el 1 de septiembre de 2026:

```
src/styles
  variables.css      Diccionario global: tokens, fuentes y colores
  base.css           Reset y estilos base (body, títulos)
  modules/
    auth.css         Login y recuperación
    nuevos.css       Modal y tablas del Módulo de Nuevos
    donaciones.css   Tablas e inmutabilidad del Módulo de Donaciones
    crm-pastoral.css Seguimiento 4C y notas confidenciales
    ui-components.css Botones, tarjetas, inputs y badges
```

- **Ningún módulo lleva un color, una fuente o un tamaño suelto**: todo sale de `variables.css`
  (prefijo `--cr-`). Los valores son la paleta institucional que ya usa el prototipo.
- **Geomanist es una fuente comercial.** Sus archivos no van en el repositorio: la iglesia
  pone los `.woff2` con licencia web en `/fonts`. Mientras no estén, se ve Inter.
- La app React de `casaroca.io` importa en este orden: `variables.css`, `base.css` y luego los
  módulos que use. La API ya expone el modelo del Drive con sus nombres en
  `GET /api/v1/modelo100p/<tabla>` (ver `backend/`).
