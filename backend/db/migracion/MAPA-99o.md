# Mapa de la migración desde 99-o

> Estrategia: `docs/DECISIONES/ADR-006-migracion-desde-99o.md`
> Operación: `backend/scripts/migrar-99o.sh` · Esquema: migración `0076_el_camino_desde_99o.sql`
> Estado: **forma esperada**. Se ajusta el día que la iglesia entregue la exportación real de 99-o.

## Cómo se usa

```bash
# 0 · La iglesia confirma qué iglesia de 99-o es qué sede (tabla migracion.mapa_sedes)
# 1 · Cargar la exportación en el área de aterrizaje (no toca nada vivo)
backend/scripts/migrar-99o.sh cargar /ruta/exportacion "Ola 1 · Chía"
# 2 · Validar: rechazos y avisos, cada uno con la regla que falló
backend/scripts/migrar-99o.sh validar 1
backend/scripts/migrar-99o.sh rechazos 1
# 3 · Aplicar por bloques (se puede cortar y reanudar)
backend/scripts/migrar-99o.sh aplicar 1 1000
# 4 · Conciliar por sede: si una fila no cuadra, la ola no se enciende
backend/scripts/migrar-99o.sh conciliar 1
# 5 · Si algo sale mal: revertir exactamente esa ola
backend/scripts/migrar-99o.sh revertir 1
```

El ensayo completo con datos sintéticos (`migrar-99o.sh ensayo 25000`) corre sobre `casaroca_test` y es una compuerta de `verificar.sh` (con 2.000 personas).

## Archivos de la exportación (CSV con encabezado, UTF-8)

| Archivo | Columnas |
|---|---|
| `personas.csv` | fila, id_origen, church_id, tipo_documento, documento, nombres, apellidos, fecha_nacimiento, genero, estado_civil, email, telefono, direccion, creado_en |
| `acudientes.csv` | menor_id_origen, acudiente_id_origen, parentesco, autoriza_retiro |
| `grupos.csv` | id_origen, church_id, nombre, tipo, dia, hora |
| `membresias.csv` | grupo_id_origen, persona_id_origen, rol, desde, hasta |
| `consentimientos.csv` | fila, persona_id_origen, canal, acto, ocurrido_en |

## Campo por campo

| 99-o | CasaRoca | Transformación |
|---|---|---|
| `id` de la persona | `nucleo.personas.source_id` (con `source_system = '99o'`) | Tal cual. Es el linaje: identifica la fila para siempre. |
| `church_id` | `sede_id` | Por `migracion.mapa_sedes`. **Sin mapa, la persona no entra** (regla `SEDE_SIN_MAPEAR`). |
| tipo de documento | `tipo_documento` | Por `migracion.mapa_valores` (campo `tipo_documento`). Uno sin equivalente entra sin documento, con aviso. |
| documento | `numero_documento` | Tal cual. Repetido en el lote o ya existente en CasaRoca: **rechazo**; lo une una persona con la herramienta de duplicados. |
| nombres | `primer_nombre`, `segundo_nombre` | Primera palabra y el resto, con mayúscula inicial. |
| apellidos | `primer_apellido`, `segundo_apellido` | Igual. |
| fecha de nacimiento | `fecha_nacimiento` | `AAAA-MM-DD` o `DD/MM/AAAA`. Ilegible: entra vacía, con aviso. Nunca se inventa. |
| género | `genero` | Masculino → M, Femenino → F. Otro valor: vacío. |
| estado civil | `estado_civil` | Por el mapa (Soltero(a) → soltero, Unión libre → union_libre…). |
| correo | `email_principal` | En minúscula. Mal escrito, compartido con otra persona del lote (la pareja) o ya usado en CasaRoca: entra sin correo, con aviso. |
| teléfono | `telefono_movil` | Solo dígitos y `+`. |
| fecha de registro | `source_payload.creado_en_99o` | Se guarda como dato de origen. |
| acudiente y parentesco | `nucleo.acudientes` | El parentesco tiene que **conferir custodia** (padre, madre, abuelos, tíos, tutor, acudiente, cuidador). |
| grupo (familiar o pequeño) | `grupos.grupos` | Tipo por el mapa; uno desconocido entra como grupo pequeño, con aviso. El día se guarda sin tilde (miércoles → miercoles). |
| membresía | `grupos.membresias` | Salida anterior a la entrada: **rechazo** (`FECHAS_INVERTIDAS`). |
| consentimiento por canal | `plataforma.consentimientos` | **Conserva la fecha de origen** y queda con evidencia `importado_origen`. 99-o no distingue la finalidad: entra como `convocatoria`, la de menor alcance. Sin fecha cierta: **rechazo**. |

## Reglas que dejan una fila fuera (rechazos)

| Regla | Qué significa | Quién lo resuelve |
|---|---|---|
| `SEDE_SIN_MAPEAR` | La iglesia de 99-o no está en el mapa | La iglesia confirma el mapa |
| `SIN_NOMBRE` | Falta nombre o apellido | Se corrige en 99-o |
| `DOCUMENTO_DUPLICADO` / `DOCUMENTO_YA_EXISTE` | Dos personas con el mismo documento | Se unen con la herramienta de duplicados |
| `MENOR_SIN_ACUDIENTE` | Un menor sin un acudiente con custodia que entre con él | La sede registra al acudiente |
| `PARENTESCO_SIN_CUSTODIA` | El vínculo no da custodia | La sede lo revisa |
| `FECHAS_INVERTIDAS` | Salida del grupo antes de la entrada | Quien conoce el grupo |
| `CONSENTIMIENTO_SIN_FECHA` | Un consentimiento sin fecha cierta no prueba nada | Se recaptura con su fecha real |
| `REFERENCIA_ROTA` | Apunta a una persona o grupo que no entra | Se resuelve la fila de origen |

## Lo que la reversión hace y lo que no

La base **no deja borrar personas** (solo borrado lógico) **ni tocar un consentimiento** (solo se anexa: es evidencia). Por eso revertir una ola:

1. da de baja a las personas de la ola y cambia su linaje a `99o-revertido`, para poder reintentar la ola limpia;
2. borra lo que la ola creó y sí se puede borrar: vínculos de acudiente, membresías, grupos y lo que anotaron los disparadores;
3. deja los consentimientos como evidencia de lo que pasó en 99-o; con la persona de baja ya no autorizan ningún contacto.

Y se niega a revertir si después de la ola la sede ya registró asistencia, aportes, casos, inscripciones o check-ins de esa gente: revertir borraría trabajo nuevo. Forzarlo es una decisión escrita.

## Medido en el ensayo del 21 de septiembre de 2026

Exportación sintética de 25.000 personas en 36 iglesias (tres sin mapear a propósito): carga en menos de 1 s, validación en 3 s, aplicación en 17 s, reaplicación sin duplicar, conciliación cuadrada en las seis sedes de prueba, reversión en 4 s y reintento sin choques de linaje. Tiempo total del ensayo: 39 s.

## Lo que depende de la iglesia

- La exportación real de 99-o (y confirmar que trae identificadores estables por fila).
- El mapa `church_id → sede` de las 36 iglesias.
- La fecha de fin del contrato con 99-o, que fija la última ola.
- La sede piloto (propuesta: Chía) y las personas que validan la conciliación de cada ola.
