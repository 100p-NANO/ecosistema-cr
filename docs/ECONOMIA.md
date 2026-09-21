# Economía · cuánto cuesta operar CasaRoca System

> Cifras de la infraestructura escrita (`infra/gcp/fases.tf`, plan de costos de Jhon) y de lo que Daniel confirmó sobre 99-o (29 de julio de 2026). Donde hay una diferencia entre documentos, se dice.

## Lo que cuesta la nube, por fase

| Fase | Para qué | Base de datos | API | Extras | USD al mes |
|---|---|---|---|---|---|
| 0 · Maqueta | Mostrar, sin tráfico real | Cloud SQL mínima | 1 instancia pequeña | ninguno | **35** |
| 1 · Pruebas | Sede piloto y ensayo de migración | 1 vCPU · 3,75 GB, alta disponibilidad | 2 a 4 instancias | Redis básico 1 GB, Cloud Armor | **218** |
| 2 · Producción | Las 36 sedes | 2 vCPU · 7,5 GB, alta disponibilidad | 2 a 5 instancias | Redis alta disponibilidad 2 GB, Cloud Armor, CDN | **526** (473 con compromiso de un año) |

En la fase 2 son unos **14,6 USD al mes por sede**. Terraform crea un presupuesto con avisos al 50, 90 y 100 % de la cifra de cada fase: si la factura se sale del plan, alguien se entera antes de que llegue.

## Lo que no está en la cifra de la nube

| Servicio | Para qué | Costo |
|---|---|---|
| SendGrid | Correos del sistema y comunicaciones | Plan gratuito para empezar; un plan pago cuando las comunicaciones masivas lo pidan |
| reCAPTCHA | Formularios públicos (nuevos, oración) | Gratuito en el volumen de la iglesia |
| PayU | Donaciones en línea | Comisión por transacción, según el contrato de la iglesia |
| Dominio | casaroca.org | Ya lo tiene la iglesia |
| Inteligencia artificial | No hay en las fases 1 y 2 (ADR-005) | 0 |

## Contra lo que se paga hoy

99-o cuesta **9.500.000 COP al mes** (114 millones al año).

⚠️ **Hay una diferencia entre documentos que Daniel tiene que resolver antes de presentarla a la iglesia.** El documento de retorno dice que la infraestructura propia cuesta **1.500.000 COP al mes**. La fase 2 de Terraform cuesta **526 USD**, que a una tasa entre 3.900 y 4.200 COP por dólar son **entre 2.050.000 y 2.210.000 COP al mes**. Con esa cifra el ahorro frente a 99-o sigue siendo grande (unos 7,3 a 7,5 millones al mes, cerca de 88 millones al año), pero no es el que dice el documento. Con el compromiso de un año (473 USD) queda entre 1.840.000 y 1.990.000 COP.

## Lo que mueve la cifra

- **La alta disponibilidad de la base** (fases 1 y 2) es de las partidas más grandes. Es lo que hace que un domingo una falla del servidor no deje a 36 sedes sin sistema.
- **Las conexiones a la base** limitan cuántas instancias de la API caben; la prueba de Terraform se niega a aprobar una fase en la que no quepan.
- **Los registros** se guardan 7 días en la fase 0, 30 en la fase 1 y 90 en la fase 2.

## Lo que falta para que la cifra sea real

Que la iglesia habilite la facturación del proyecto de Google Cloud y elija la región. Hasta entonces, todo lo de arriba está escrito y probado (`terraform test`), pero no aplicado.
