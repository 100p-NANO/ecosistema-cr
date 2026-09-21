# ADR-005 · La inteligencia artificial entra después, y entra con compuerta

- **Estado:** Aceptado (propuesta técnica; la ratifica la iglesia al firmar el alcance)
- **Fecha:** 21 de septiembre de 2026
- **Origen:** el sistema se presenta como «CasaRoca AI System», y a esta fecha no tiene ninguna función de IA. Hay que decir por qué, y cuándo y cómo entra.

## Contexto

La fase 1 es la fundación: identidad, aislamiento por sede, datos de 36 iglesias y más de 25.000 personas, menores, consejería y aportes. Ninguna función de IA sirve si esa base no es confiable, y varias serían peligrosas sobre ella:

- El dato que más se prestaría a un asistente (consejería, oración, salud de los menores) es N3 y N4. Mandarlo a un modelo alojado por un tercero es una **transferencia internacional de datos sensibles** (Ley 1581, artículos 5 y 26) que la iglesia no ha autorizado ni sus titulares han consentido.
- Varias preguntas que suenan a IA se responden con reglas. «¿Quién se nos está perdiendo?» ya está construido (`crm.se_estan_perdiendo`) con una regla auditable: vino tres veces en dos meses y ninguna en el último.

## Decisión

1. **Fase 1 y 2 sin modelos de lenguaje.** Lo que parece IA y se resuelve con reglas, se entrega con reglas (compuerta cero del Protocolo de Agentes de Aivor: si un filtro resuelve el 85 %, se entrega el filtro).
2. **La IA entra en la fase 3**, caso por caso, y cada caso pasa una compuerta escrita antes de construirse:
   - la decisión que apoya está definida por escrito y tiene un dueño humano en la iglesia;
   - hay una línea base medida sin IA y un conjunto de evaluación con casos reales;
   - **ningún dato N3 o N4 sale de la infraestructura de la iglesia**: si el caso los necesita, el modelo se autoaloja o el caso no se hace;
   - la IA se declara como IA ante quien la lee, sugiere y no decide lo irreversible, y cada corrida deja traza (quién, qué modelo, qué versión del prompt, qué entró y qué salió, en nivel N2 o menor);
   - tiene un interruptor que la apaga por sede, probado, igual que los módulos.
3. **Candidatos, en el orden en que tienen sentido** (ninguno comprometido todavía):
   - resumen semanal para cada pastor con cifras ya agregadas y suprimidas (N2 agregado, sin personas);
   - clasificación sugerida de requerimientos y peticiones internas (N1 y N2);
   - borrador de respuestas a peticiones de Habeas Data, que siempre revisa y firma una persona.
   Consejería, oración y RocaKids quedan **fuera** del uso de modelos externos.

## Consecuencias

- El nombre «AI System» describe el rumbo, no la versión entregada. El `HANDOFF.md` lo dice así, para que nadie firme esperando algo que no está.
- La cláusula de uso de IA (caja 12 del estándar) se redacta ahora como borrador y se activa cuando exista el primer caso.
- El costo de la fase 1 no incluye tokens ni modelos.

## Revisar si

- La iglesia firma el alcance de la fase 3, o aparece un caso con dato N1 o N2 cuya línea base demuestre que las reglas no alcanzan.
