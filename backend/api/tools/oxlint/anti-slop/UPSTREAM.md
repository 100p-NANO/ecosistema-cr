# Procedencia del plugin anti-slop de Oxlint

| | |
|---|---|
| Fuente | `github.com/dmmulroy/anti-slop` (licencia MIT, 4.694 estrellas al 21 sep 2026) |
| Commit copiado | `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b` |
| Cómo se copió | `node .claude/skills/install-anti-slop/scripts/install.mjs tools/oxlint/anti-slop`, desde `backend/api` |
| Dependencias | `oxlint` 1.85.0 y `@oxlint/plugins` 1.85.0, exactas, de desarrollo, en `backend/api/package.json` |
| Configuración | `backend/api/.oxlintrc.json`: las 19 reglas genéricas y `oxc/no-accumulating-spread` en `error`; sin el plugin de Effect, porque el proyecto no usa Effect |
| Revisado | 21 sep 2026, antes de instalar: el instalador solo copia archivos locales; las 36 reglas solo importan `@oxlint/plugins` y sus propios archivos (sin red, sin procesos, sin escritura, sin variables de entorno) |

## Diferencias intencionales con el original

- **Vive en `backend/api/tools/oxlint/anti-slop`**, no en la raíz: las dependencias del repositorio están en
  `backend/api`, y las reglas importan `@oxlint/plugins` desde allí.
- **`package.json` con `"type": "module"`** en esta carpeta: las reglas son módulos ES dentro de un paquete
  CommonJS, y Node avisaba en cada corrida que tenía que volver a leerlas.

## Estado al instalar (21 sep 2026)

`backend/scripts/revisar-slop.sh` revisa la API, sus pruebas y las tres pantallas:

| | API y pruebas | Pantallas |
|---|---|---|
| Espaciado entre sentencias (`require-readable-spacing`, se corrige solo con `--fix`) | 1.034 | 800 |
| Conversiones de tipo sin comentario que las justifique | 56 | · |
| Parámetros `unknown`, `typeof` en ejecución, valores ensanchados, diccionarios inseguros | 36 | 8 |
| Variables sin usar y otras de Oxlint | 12 | 16 |
| `filter().map()` encadenados, objetos vacíos condicionales | 3 | 6 |
| **Total** | **1.141 en 58 archivos** | **830 en 31 archivos** |

Todavía **no es una compuerta** de `verificar.sh`: con esos hallazgos la pondría en rojo. Entra como
compuerta cuando se limpie el código (primero el espaciado, que es mecánico; después los de fondo, uno por
uno, sin silenciar reglas ni poner conversiones para callarlas, como pide el instalador).
