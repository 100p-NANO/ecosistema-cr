# Documentos legales · estado

> ⛔ **Todos son BORRADORES y ninguno está vigente.** Los redactó el equipo técnico a partir de lo que el sistema hace de verdad (21 de septiembre de 2026). Antes de publicarse necesitan dos cosas que no dependen del equipo técnico:
>
> 1. **Los datos del Responsable del Tratamiento**: la razón social exacta de la iglesia (o de cada entidad, si las sedes de otros países son personas jurídicas distintas), su NIT, su domicilio y el canal oficial de atención. Salen del certificado de existencia y representación legal.
> 2. **La revisión de un abogado**, en Colombia y, para Barcelona y Panamá, en cada país.

| Documento | Para qué | Dónde se usa en el sistema |
|---|---|---|
| `AVISO-DE-PRIVACIDAD.md` | Lo corto que se muestra al recoger datos | Formulario de nuevos, formulario de oración, portal |
| `POLITICA-DE-TRATAMIENTO.md` | La política completa (Decreto 1377 de 2013, art. 13) | Enlace fijo en el sitio y en el portal |
| `AUTORIZACION-MENORES.md` | La autorización del representante legal para datos de menores | Inscripción en RocaKids |
| `CONTRATO-DE-TRANSMISION.md` | El contrato entre la iglesia y quien opera la plataforma (Decreto 1377, art. 25) | Firma con el proveedor y con la nube |
| `CLAUSULA-IA.md` | El uso de inteligencia artificial | **Inactiva** hasta la fase 3 (ADR-005) |

## Lo que el sistema ya cumple y estos documentos solo describen

- Consentimiento por canal y por finalidad, con fecha, evidencia y revocación en cualquier momento (`plataforma.consentimientos`, portal del congregante).
- Consultas en 10 días hábiles y reclamos en 15, contados con festivos colombianos (`plataforma.peticiones_titular`).
- Supresión que anonimiza lo que la ley no obliga a conservar (`plataforma.ejecutar_supresion`).
- Bitácora de quién leyó datos sensibles y de menores.
- Retención declarada por tabla y purga que la aplica.

## Registro ante la SIC

Si la iglesia está obligada a inscribir sus bases de datos en el Registro Nacional de Bases de Datos (las entidades sin ánimo de lucro con activos totales superiores a 100.000 UVT, Decreto 090 de 2018), la inscripción la hace el Responsable en el portal de la Superintendencia de Industria y Comercio. El inventario de tablas y finalidades para esa inscripción sale de `plataforma.clasificacion_columna` y `plataforma.finalidades`.
