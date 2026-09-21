# ADR-004 · Un solo tema, claro, en las dos plataformas

- **Estado:** Aceptado
- **Fecha:** 21 de septiembre de 2026 (la regla es del 20; aquí queda la decisión y su porqué)
- **Origen:** regla de Daniel del 20 de septiembre, escrita en `docs/DISENO.md`: *«tiene que ser regla: el tema del diseño, colores, formas, encuadre, letra»*.

## Contexto

El producto son dos plataformas: la aplicación de las sedes y la consola del Sistema Master. Cuando se separaron, la consola quedó blanca y la aplicación quedó en papel cálido con titulares en serif y con **tema oscuro automático** (`prefers-color-scheme`). En la misma iglesia, unos veían la aplicación blanca y otros marrón oscuro, según cómo tuvieran el teléfono. Dos personas no podían hablar de la misma pantalla, y el soporte no podía guiar a nadie por teléfono («el botón azul de arriba» no existía en la mitad de los teléfonos).

## Decisión

- **Un solo tema, claro, siempre.** Ninguna hoja de estilos del repositorio usa `@media (prefers-color-scheme: dark)`, y los dos `index.html` declaran `<meta name="color-scheme" content="light">`.
- La paleta es la de la iglesia (azul #134291, mostaza #E3A52C) y las formas son las de `docs/DISENO.md`: radios de 6 y 8 px, cero sombras, relieve por filetes, sin serif de display, ninguna fuente pedida a un tercero.
- El contenido de las dos plataformas es distinto a propósito; el aspecto es el mismo.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Tema oscuro automático | Dos iglesias distintas en la misma iglesia. Es el problema que originó la regla. |
| Selector claro/oscuro por persona | Duplica el trabajo de contraste AA en cada pantalla nueva y reintroduce el «yo lo veo distinto» en el soporte. El beneficio (lectura nocturna) no está en ningún caso de uso real de las sedes. |
| Fuentes de Google | Cada carga enviaba la IP del maestro de RocaKids a un tercero sin consentimiento; la sede de Barcelona está bajo el RGPD. Se sirven locales o se cae a la pila del sistema. |

## Consecuencias

- Cada pantalla se diseña y se verifica una vez (contraste AA sobre fondo claro), no dos.
- Quien necesite alto contraste lo obtiene del sistema operativo (zoom, contraste aumentado), que la aplicación respeta porque usa unidades relativas y no fija colores sobre imágenes.
- Una hoja de estilos que reintroduzca el modo oscuro contradice esta decisión: se corrige el código, no la regla.

## Revisar si

- La iglesia pide expresamente un modo oscuro para un uso concreto (por ejemplo, una sala de proyección) y hay un responsable de mantener el segundo juego de contrastes. Cambiar la regla es decisión de Daniel y se escribe aquí.
