# ADR-006 · Cómo se sale de 99-o sin perder a nadie

- **Estado:** Aceptado como estrategia (la ejecución depende de que la iglesia entregue la exportación de 99-o y la fecha de fin de su contrato)
- **Fecha:** 21 de septiembre de 2026
- **Origen:** la iglesia usa hoy 99-o (`casaroca.99o.io`) en producción para 36 sedes. El objetivo del proyecto es dejarlo. Una migración mal hecha pierde personas, historia y consentimientos, y esos tres no se recuperan.

## Contexto

- 99-o es un sistema multi-iglesia (`church_id`) con ovejas, grupos familiares y pequeños, consejería, cursos con precio y cupo, actividades con registro polimórfico y consentimientos de Habeas Data por canal.
- El modelo de CasaRoca ya trae **linaje** en las tablas que reciben migración: `source_system`, `source_id` y `source_payload` (personas, membresías, grupos). Un registro migrado sabe de dónde vino.
- La Ley 1581 exige conservar la **fecha original** de cada consentimiento: uno recapturado después no cubre el tratamiento anterior.

## Decisión

1. **Área de aterrizaje separada.** La exportación entra primero a un esquema `migracion` sin acceso de la aplicación. Nada toca las tablas vivas hasta pasar la validación.
2. **Mapa de campos escrito y versionado** (`backend/db/migracion/MAPA-99o.md`): cada columna de origen con su destino, su transformación y lo que se descarta con motivo.
3. **Cargador idempotente y reanudable, por lotes.** Cada fila de origen se identifica por `('99o', id_de_origen)`. Volver a correr un lote no duplica nada; un corte a mitad se reanuda desde el último lote confirmado. Cada lote deja constancia (cuántas filas entraron, cuántas se rechazaron y por qué).
4. **Rechazo explicado, no silencioso.** Una fila que no cumple una regla (documento duplicado, menor sin acudiente, correo inválido) va a una bandeja de rechazos con la regla que falló, para corregirla en el origen o a mano.
5. **Conciliación antes de encender.** Por sede: personas, membresías, grupos, consentimientos y aportes contados en origen y en destino. Una diferencia sin explicar detiene la ola.
6. **Por olas de sedes, con marcha en paralelo.** Primero una sede piloto (propuesta: Chía) durante dos domingos con los dos sistemas vivos; después olas de sedes. 99-o sigue siendo la verdad de cada sede hasta que su ola se firma.
7. **Vuelta atrás escrita.** Una ola se revierte borrando lo que trae su marca de lote (`source_system = '99o'` y el lote), porque nada migrado se mezcla con lo creado a mano sin marca.
8. **Ensayo completo con datos sintéticos** del mismo tamaño que la iglesia (25.000 personas) antes de tocar datos reales.

## Consecuencias

- Hasta tener la exportación real, el cargador se prueba con una exportación sintética con la forma de la de 99-o. El mapa definitivo se ajusta cuando llegue el archivo real: eso depende de la iglesia.
- La fecha de fin del contrato de 99-o fija la fecha límite de la última ola; sin esa fecha no hay cronograma honesto.
- Los consentimientos migrados conservan su fecha y su evidencia de origen (`evidencia_tipo = 'importado_origen'`).

## Revisar si

- La exportación de 99-o no trae identificadores estables por registro (entonces el linaje se construye con una llave compuesta y se documenta aquí).
