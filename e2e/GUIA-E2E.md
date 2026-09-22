# Guía del auditor de una pestaña de CasaRoca, de punta a punta

Daniel pidió: «prueba los procesos de CasaRoca de punta a punta por pestaña, con un agente por pestaña,
hasta que quede perfecto». Usted es el agente de UNA pestaña. Su trabajo es usarla como la usaría la
persona que la necesita, en un navegador real, y comprobar que cada proceso llega a la base y hace lo que
dice. No se arregla nada aquí: se encuentra, se prueba y se documenta tan bien que el arreglo sea obvio.

Repositorio: `~/Desktop/CasaRoca/ecosistema-cr` (**solo lectura para usted**). Carpeta de trabajo:
la carpeta `e2e` que le da su encargo, con `slot.sh`, `e2e.py`, `directorio.json` y `slots/<nn>/`.

## Su puesto (nadie más lo usa)

    $E2E/slot.sh <n> start          # copia la red de demostración (cr_e2e_base) a su base y levanta API y pantallas
    $E2E/slot.sh <n> env            # puertos y direcciones
    $E2E/slot.sh <n> sql "SELECT …" # preguntarle a la base, como administrador
    $E2E/slot.sh <n> token <id>     # token de una persona (crea su cuenta y resuelve el segundo factor)
    $E2E/slot.sh <n> reset          # si ensució su base y necesita empezar limpio
    $E2E/slot.sh <n> stop           # SIEMPRE al terminar

La base trae una red inventada completa: 36 iglesias, unas 4.000 personas, familias con menores, roles
por sede y datos de todos los módulos. `directorio.json` dice quién tiene cada rol (y ejemplos útiles: un
menor, un miembro sin rol, alguien de otra sede, un líder con su grupo). Para ver qué puede cada rol:
`SELECT rol, accion FROM sistema.matriz_permisos WHERE modulo = '<módulo>'` y `identidad.roles` (techo de
nivel y de alcance).

El navegador (`e2e.py`) entra con el token de la persona que usted elija, captura cada petición a la API
(método, ruta, cuerpo, estado y respuesta), los errores de consola, los diálogos (`confirm`/`prompt`) y
mide si algo se sale del ancho en el teléfono. Direcciones: app `index.html#/<pestaña>`, consola
`master/#/<pestaña>`, portal `portal/#/<pestaña>`; con `demo=True`, la misma pantalla en modo demostración.
Escriba sus scripts en `slots/<nn>/`.

## ⛔ Lo que no se hace

- No edite nada del repositorio. No haga `git` de nada.
- No corra `migrar.sh`, `probar.sh`, `verificar.sh`, los bancos de la API ni `npm run build`: recrean bases y
  compilan la API que usan los otros 42 agentes.
- No toque las bases de otros puestos, ni `casaroca_dev`, ni las plantillas `cr_*_base`.
- No use datos reales de nadie. Lo que cree, invéntelo verosímil («Grupo Familiar Los Alpes», no «prueba»).

## El método (no negociable)

**Un 200 no prueba nada.** Cada proceso se hace en la pantalla, se mira el cuerpo EXACTO que la pantalla
mandó, y después se le pregunta a la base si el dato llegó a la columna correcta, con el autor correcto, y
si el efecto ocurrió: la fila, la auditoría (`plataforma.auditoria`), el hecho en la historia
(`crm.linea_tiempo`), el aviso encolado (`plataforma.notificaciones`), la lectura registrada si el dato es
N3 o N4 (`plataforma.bitacora_lectura`). Si la pantalla dice «Guardado» y la base no tiene nada, eso es un
hallazgo grave, no un detalle.

## Qué se prueba en su pestaña

1. **Inventario.** Lea el código de la pantalla (y el de su API) y liste TODOS los procesos: cargar, cada
   filtro y búsqueda, cada botón, cada formulario con cada campo, cada enlace a una ficha, cada cambio de
   estado, cada confirmación, la paginación, el estado vacío y el de error.
2. **Cada proceso, con el rol que lo debe poder hacer**, en el navegador y verificado en la base.
3. **Con quien NO debe poder**: un rol sin ese permiso, un nivel menor, alguien de OTRA sede, un miembro sin
   rol. La pantalla no debe ofrecerlo, y si se manda el mismo cuerpo directo a la API (con `curl` o `fetch`
   y el token de esa persona), la API debe negarse y la base no debe cambiar. Pruebe ambas cosas.
4. **Datos malos**: obligatorios vacíos, formatos inválidos, textos muy largos, fechas al revés, valores que
   el catálogo no admite, duplicados, doble clic. El mensaje tiene que decir en castellano qué pasó y qué hacer.
5. **Lo que la pestaña muestra es verdad**: contraste cifras, listas y avisos contra la base (con la misma
   persona y su alcance). Una cifra que no cuadra es un hallazgo.
6. **Teléfono (375 px)**: nada se sale del ancho, la acción principal se alcanza sin desplazarse de lado,
   ninguna acción vive solo en la última columna de una tabla.
7. **Modo demostración** (`demo=True`): la pantalla abre con datos, nada dice «no trae datos», y las acciones
   responden con la verdad (un aviso de que en la demostración no se guarda), nunca con un éxito falso.
8. **Texto**: español correcto con tildes, sin rayas largas (— –), sin inglés, sin códigos crudos donde debería
   haber un nombre («union_libre» en vez de «Unión libre»), cifras y fechas legibles.
9. **Consola limpia**: ningún error de JavaScript ni petición fallida inesperada.
10. **Accesibilidad básica**: cada campo con su etiqueta, cada botón con nombre, el foco se ve, lo principal se
    opera con el teclado.

## Cómo se reporta un hallazgo

Cada hallazgo tiene que poder reproducirlo alguien que no estuvo: rol y persona usados, pasos exactos en la
pantalla o la petición exacta, lo esperado, lo obtenido y la evidencia (cuerpo y respuesta de la red, la
consulta y su resultado). Diga dónde cree que está la causa (`archivo:línea`) y cómo se arreglaría.

Gravedad:
- **crítica**: pérdida o fuga de datos (entre sedes, de menores, de salud, de dinero), un proceso central del
  domingo que no se puede hacer, un éxito falso que deja la base sin el dato.
- **alta**: un proceso falla para el rol que lo necesita, o falta un control de seguridad (la API acepta lo
  que debe negar).
- **media**: resultado o mensaje equivocado, un fallo parcial, una pantalla que afirma algo falso, algo roto en
  el teléfono o en la demostración.
- **baja**: texto, ortografía, detalle visual, una mejora de uso.

No reporte como hallazgo una decisión escrita del sistema (en `docs/DECISIONES/`, `docs/HANDOFF.md` o en los
comentarios con ⛔ del código): si le parece mala, dígalo en sus notas. Tampoco lo que ya se sabe que falta
(infraestructura sin aplicar, correo sin llave de SendGrid, PayU sin cuenta).

Liste también lo que SÍ funcionó, proceso por proceso: la cobertura es parte del resultado.
