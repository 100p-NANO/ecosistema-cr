# RUNBOOK · CasaRoca System AI
### Lo que hay que saber hacer cuando algo pasa, escrito para que lo siga alguien que no construyó esto

> 19 de septiembre de 2026 · Se prueba haciendo que **una persona ajena al proyecto lo siga de principio a fin**. Si tropieza, el runbook está mal, no la persona.

---

## 0 · Los cuatro números que hay que tener a mano

| Qué | Dónde |
|---|---|
| Estado del servicio | `GET /salud/detalle` |
| Panel de la nube | Consola de GCP, proyecto `casaroca-prod` |
| Canal de alertas | El que declare `infra/gcp/observabilidad.tf` (`correos_alertas`) |
| Quién responde el domingo | Ver «Guardia dominical», abajo |

## 1 · Arrancar y parar

### Desarrollo, en el portátil
```bash
cd backend
./scripts/arrancar.sh     # PostgreSQL 16 local, puerto 5433
./scripts/migrar.sh       # recrea la base: migraciones + semillas
./scripts/probar.sh       # los 14 bancos de invariantes
cd api && npm run build && node dist/src/main.js
```

### Producción
La API corre en Cloud Run. **No se arranca a mano:** se despliega.
```bash
cd backend && ./scripts/desplegar.sh staging     # primero pruebas
cd backend && ./scripts/desplegar.sh produccion  # solo con la verificación en verde
```
Parar el servicio en una emergencia: bajar el tráfico a cero en Cloud Run (no borrar el servicio, que perdería la configuración).

## 2 · Antes de entregar, fusionar o desplegar
```bash
cd backend && ./scripts/verificar.sh
```
Nueve compuertas. **Una en rojo y no se despliega.** Lo mismo que corre la integración continua.

## 3 · Copia y restauración

```bash
./scripts/respaldar.sh     # copia cifrada, retención 30 días
./scripts/restaurar.sh     # restaura en una base APARTE y la verifica
```

**⛔ La restauración se ejecuta de verdad al menos una vez al mes**, y deja su fecha y su duración en `docs/EVIDENCIA-restauracion.txt`. La compuerta 9 de `verificar.sh` falla si la última tiene más de 45 días. Una copia que nunca se restauró es un archivo, no una copia.

`restaurar.sh` nunca toca la base viva: restaura en `casaroca_restaurada`, cuenta filas, comprueba que no haya fugas de lectura y la borra.

## 4 · Rotar la llave de cifrado (N4)

La llave que cifra los datos críticos vive en **Cloud KMS** (`infra/gcp/kms.tf`), nunca en el código ni en el entorno ni en la propia base.

1. Crear una versión nueva de la llave en KMS.
2. Actualizar el secreto en Secret Manager y desplegar la revisión de Cloud Run.
3. **No** hay que recifrar los datos: la envoltura usa la versión con la que se cifró cada fila.
4. Registrar la rotación en `docs/DECISIONES/` con fecha y quién la hizo.

**Toda credencial recibida de un tercero se rota el mismo día.** Sin excepción.

## 5 · Agregar una sede

Nunca a mano. Desde la consola de sistemas o por API:
1. Se elige la **plantilla** según el tipo de sede: define con qué módulos y qué roles nace.
2. La sede nace colgada de su **región** (`org.sedes.unidad_id`).
3. Los módulos con compuerta legal (Aportes, RocaKids) **no se encienden sin evidencia legal registrada**: la base lo rechaza.
4. Se siembran sus salas de RocaKids y sus fondos.
5. Todo queda en `sistema.bitacora_aprovisionamiento`, que no se puede alterar.

## 6 · Dar de alta a alguien

```bash
node scripts/crear-cuenta.js "<documento o nombre>" <usuario> "<contraseña larga>"
```
- La contraseña es **temporal**: el sistema exige cambiarla al entrar.
- Si el rol alcanza datos **N3 o N4**, el segundo factor es **obligatorio**: al entrar recibe un token limitado que solo sirve para configurarlo.
- El acceso **cae solo** cuando termina el contrato o el voluntariado, y cuando la persona pasa a fallecida, inactiva o fusionada.

## 7 · Quitarle el acceso a alguien, ahora

```sql
-- Sacarlo de un equipo: corta en el instante lo heredado
SELECT org.sacar_del_equipo(<unidad>, <persona>, 'motivo escrito');

-- Revocar un permiso personal
SELECT identidad.revocar_asignacion(<asignacion>, 'motivo escrito');

-- Suspender la cuenta y cerrar TODAS sus sesiones
SELECT identidad.suspender_cuenta(<persona>, 'motivo escrito');
```
**⛔ No use `UPDATE ... SET vigente_hasta`:** una fecha no puede decir «ahora» y el acceso seguiría vivo hasta mañana.

## 8 · Qué mirar cuando «va lento» o «no carga»

En este orden, sin saltarse pasos:

1. `GET /salud/detalle` · ¿responde? ¿qué dice `estado`?
2. ¿La base responde y en cuántos milisegundos? (`baseMs`)
3. ¿Las particiones están en `BIEN`? Un `HUECO` o un `CRITICO` se arregla con
   `SELECT plataforma.asegurar_particiones(3);`
4. ¿`fugasDeLectura` es 0? Si no, hay una tabla legible sin política: **eso se atiende antes que el rendimiento**.
5. Logs de Cloud Run filtrando por el `X-Peticion-Id` que reportó el usuario.
6. `SELECT * FROM identidad.v_alertas_acceso;` · ¿alguien está probando contraseñas?

## 9 · Un año nuevo y el sistema deja de escribir

**Síntoma:** todo `INSERT` falla el 1 de enero.
**Causa:** no existe la partición del año.
**Arreglo inmediato:**
```sql
SELECT plataforma.asegurar_particiones(3);
SELECT * FROM plataforma.v_salud_particiones;   -- todo en BIEN
```
**Por qué no debería pasar nunca:** la tarea mensual lo hace sola, hay partición por defecto como red y el banco `particiones.sql` falla en la integración continua si el colchón baja de dos años.

## 10 · Guardia dominical

**El pico es el domingo de 9:00 a 11:00.** Fuera de esa ventana el sistema puede esperar; dentro, no.

| Cuándo | Quién responde | En cuánto |
|---|---|---|
| Domingo 7:00 a 13:00 | Guardia de turno del equipo de Sistemas de la central | 15 minutos |
| Resto de la semana | Mesa de ayuda | Siguiente día hábil |

**⛔ La ventana de mantenimiento jamás cae en domingo.** Martes o miércoles, 22:00 a 00:00.

**Si el check-in de RocaKids falla un domingo:** se activa el procedimiento en papel de la sede (planilla con nombre del menor, acudiente y código manual), y se carga después. La entrega de un niño **nunca** se hace sin verificar al acudiente, con sistema o sin él.

## 11 · Incidente con datos personales

1. Contener: suspender las cuentas implicadas y cerrar sus sesiones (punto 7).
2. Medir: `SELECT * FROM plataforma.v_quien_vio ...` y `identidad.intentos_acceso`.
3. Registrar el incidente con hora, alcance y datos afectados.
4. **Evaluar la notificación a la autoridad** (en Colombia, la SIC) y al titular. El plazo corre desde que se conoce.
5. Comunicar a la mesa. No se comunica a las sedes sin acuerdo de la mesa.
6. Postmortem escrito en `docs/DECISIONES/`, sin buscar culpables y con la corrección de la CAUSA, no del síntoma.

## 12 · Peticiones de Habeas Data

```sql
SELECT * FROM plataforma.v_peticiones_titular_vencidas;
```
**Una sola fila aquí es un incumplimiento de la Ley 1581, no un pendiente.** Consulta: 10 días hábiles. Reclamo: 15. Los plazos los calcula la base al radicar.

## 13 · Lo que NO se hace nunca

- Conectarse a la base como propietario o superusuario desde la aplicación: la seguridad por fila no se aplica al dueño y se anularía sin un solo aviso.
- Restaurar una copia encima de la base viva «para probar».
- Desplegar sin `verificar.sh` en verde.
- Poner un secreto en el repositorio, en un mensaje o en un correo.
- Dar acceso «temporal» sin fecha de fin.
- Desplegar un domingo.
