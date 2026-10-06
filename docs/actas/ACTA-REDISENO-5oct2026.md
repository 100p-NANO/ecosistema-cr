# Acta de rediseño visual · 5 de octubre de 2026

Repositorio `100p-NANO/ecosistema-cr`, rama `main`, confirmación `cf085b7`.
Sitio de demostración: `casaroca-system.netlify.app/sistema/` una vez se suba el paquete del 5 de octubre (datos inventados).

## Qué se pidió

Daniel Garzón, 5 de octubre de 2026: *«esto se ve muy feo; quiero algo dinámico, sólido, bonito,
interactivo, con gráficos y paneles»*. Precisó después: se mantienen los colores de Casa Roca, pero
nada de *«cuadros sin sentido solo con título»*, y *«cada cuadro de información debe ser dinámico; cuando
le dé clic, que aparezca todo»*.

## Qué se hizo

| Pieza | Qué cambia para quien usa el sistema |
|---|---|
| Panel de la aplicación | Abre con **Lo que pide atención hoy**: avisos ordenados por urgencia, cada uno con su botón (contactar a un nuevo atrasado, llamar a quien dejó de venir, hablar con un grupo sin reunión). Sigue con la asistencia de 12 semanas, los niños por domingo y el recorrido de los nuevos. |
| Analítica | Las seis cifras se pulsan y abren su detalle. La asistencia pasa a un gráfico de línea con su comparación contra el promedio. |
| Tablero de la red (consola) | Avance de la red contra las 36 iglesias, lo que la central tiene que resolver, cómo está compuesta la red y dónde hay más ministerios activos. |
| Cajón de detalle | Al pulsar una cifra se abre un panel con qué significa, su gráfico, la lista de quiénes o cuáles son y el botón para ir al módulo. Se cierra con Esc. |
| Columna de navegación | Emblema arriba, pestañas agrupadas por materia (Inicio, Pastoral, Formación y contenido, Operación, Administración), iconos de un solo set y la persona que entró abajo. |
| Movimiento | Entrada escalonada, cifras que cuentan, gráficos que se dibujan. Con «reducir movimiento» encendido no se mueve nada. |

## Reglas que se respetaron

- Colores de la iglesia, un solo tema claro y la columna a la izquierda (`docs/DISENO.md`).
- Cero sombras salvo en lo que flota de verdad (el cajón de detalle). Radios de 6 y 8 px.
- Gráficos en SVG propio, sin librerías ni servidores de terceros: en un sistema con datos de menores
  cada petición a un servidor ajeno manda la dirección IP de quien mira.
- Paleta de series validada contra daltonismo. Los niveles de sensibilidad N0 a N4 conservan su
  color y van con su nombre al lado.
- Una petición de oración confidencial, al abrir el detalle, solo muestra su categoría y su fecha.
- Toda cifra menor de 5 sigue mostrándose como «<5».

## Defectos encontrados y corregidos en la misma jornada

1. La clase de estilo `.aviso` nueva pisó la que ya usaban Grupos, Consejería y otras pantallas: el
   aviso rojo salía con una palabra por línea. Se renombró la nueva a `.cr-aviso`.
2. El foco que se pone en el contenido al cambiar de pantalla dibujaba un marco azul alrededor de todo.
3. El servidor de desarrollo dejaba que el navegador guardara copias viejas: se veían pantallas de días
   anteriores. Ahora la hoja compartida va con número de versión.

## Archivos

`frontend/src/graficos.js`, `tablero.js`, `detalle.js`, `detalles.js`, `iconos.js`, `movimiento.js`,
`styles/bento-movimiento.css`; cambiaron `src/app.js`, `src/vistas/panel.js`, `src/vistas/analitica.js`,
`master/master.js` y los dos `index.html`. La regla nueva está en `docs/DISENO.md` §7 y §7.1.

## Qué falta

- El mismo tratamiento (gráficos, avisos y detalle al pulsar) en las demás pantallas de la
  aplicación (Personas, Nuevos, Asistencia, Grupos, Niños, Consejería, Formación y las
  administrativas) y de la consola.
- Es solo la capa de presentación: la API y la infraestructura siguen como en el acta del 21 de
  septiembre (infraestructura sin aplicar).
