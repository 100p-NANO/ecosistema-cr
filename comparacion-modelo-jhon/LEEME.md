# Comparación con el modelo del equipo 100p

Rama `modelo-jhon`. **Nada de esto es una propuesta de reemplazo ni toca lo que está en `main`.**
Es el material de Jhon construido y puesto a correr, para que la mesa decida mirando, no
discutiendo en abstracto.

Fuentes, las dos del Drive «Sistema 100p Casa Roca Global»:

- `01 Estructura Datos / ESTRUCTURA DE DATOS - USUARIOS (PERSONAS)`, v1.2, 25 ago 2026.
- `02 Módulos / CSS / Arquitectura Fronted y Backed`, v1.0, 1 sept 2026.

## Qué hay aquí

```
backend/
  01-modelo-jhon-v1.2.sql     Sus 5 tablas, transcritas literalmente. Corre.
  02-prueba-lado-a-lado.sql   Los mismos datos en los dos modelos, ocho preguntas.
frontend/
  src/styles/                 Su estructura de estilos, exacta
    variables.css             Design Tokens
    base.css                  Reset y cuerpo
    modules/                  auth · nuevos · donaciones · crm-pastoral · ui-components
  demo.html                   Los módulos funcionando, para verlos
  auth.html                   La pantalla de ingreso que él propone
```

## Cómo verlo

**Backend:**
```
psql -U postgres -p 5433 -d casaroca_dev -f backend/01-modelo-jhon-v1.2.sql
psql -U postgres -p 5433 -d casaroca_dev -f backend/02-prueba-lado-a-lado.sql
```
Su modelo queda en el esquema `jhon`, al lado del nuestro. No se pisan.

**Frontend:**
```
cd frontend && python3 -m http.server 5302 --bind 127.0.0.1
```
Luego `http://127.0.0.1:5302/demo.html`

## Resultado de las ocho preguntas

Ejecutado el 11 de septiembre de 2026. Las dos columnas son la misma pregunta contra las dos bases.

| # | Pregunta | Backend construido | Modelo v1.2 del equipo |
|---|---|---|---|
| 1 | Filtrar personas por sede | Sí: `personas.sede_id` | **No existe la columna** |
| 2 | ¿La base impide el cruce entre sedes? | Sí: 103 políticas | **0 políticas: depende del programador** |
| 3 | Registrar a alguien sin correo | Se registra | **Rechazado: el correo es obligatorio** |
| 4 | Dos hermanos con el correo de la mamá | Se registran | **Rechazado: el correo es único** |
| 5 | Saber de qué sistema vino cada fila | Sí: `source_system` + `source_id` | **No hay linaje** |
| 6 | Filas de permiso para 25.000 personas | Decenas (rol × alcance) | **Hasta 25.000 × nº de usuarios** |
| 7 | Copias de la fecha de nacimiento | 1 | **2 (`personas` y `minores`)** |
| 8 | Consentimiento con finalidad y canal | Sí, append-only | **Solo booleanos** |

Las filas 3 y 4 no son teoría: son el caso de un niño de RocaKids sin correo propio y el de dos
hermanos que comparten el correo de la mamá. Con el modelo v1.2 **ninguno de los dos se puede
registrar**, y es justo la población que el sistema tiene que atender.

## Lo que hay que reconocer de su propuesta

No todo es divergencia. Tres cosas suyas son mejores o son capacidad nueva:

1. ⭐ **`ui-components.css`**: una capa de botones, tarjetas, campos e insignias compartida.
   El prototipo Fase 0 no la tiene: cada hoja por rol repite sus propios componentes. Esto hay
   que adoptarlo, venga de donde venga la decisión de fondo.
2. ⭐ **`auth.css`**: el prototipo no tiene autenticación, el ingreso es una selección de rol.
   Su módulo cubre un hueco real que ya estaba en nuestra lista de deuda.
3. ⭐ **En la v1.2 corrigió dos observaciones nuestras**: `edad` pasó a ser derivada y añadió
   `fecha_consentimiento_gdpr`. Se movió hacia el modelo, y conviene decírselo.

## El desacuerdo de fondo, que no es de CSS

Él parte el sistema por **función**: auth, nuevos, donaciones, crm-pastoral.
El prototipo lo parte por **rol jerárquico**: central, pastor, director, líder, nicodemo,
rocakids, consejería.

Las dos son legítimas y no se contradicen técnicamente: un módulo por función puede consumirse
desde varias pantallas por rol. Pero hay que decidirlo **antes** de escribir la interfaz
definitiva, porque define cómo se reparte el trabajo y cómo se prueba.

La estructura por rol no salió de una preferencia técnica: salió de la jerarquía pastoral real
de la iglesia, que es lo que el pastor aprobó y lo que hace que el Director General pueda abrir
la aplicación y reconocerla.

## Dos notas de honestidad

- **La tipografía Geomanist no está.** Es comercial, de atipo foundry, y no se puede descargar
  sin licencia. `variables.css` la declara primero y cae a Inter. Para verla de verdad hace falta
  comprar la licencia o que Jhon comparta el archivo.
- **Los valores de color son los del prototipo**, no inventados, para que lo que se compare sea
  la estructura y no dos paletas distintas.
