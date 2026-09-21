-- =====================================================================
-- Seed 023 · Los pastores de las sedes de demostración, con N3
--
-- ⛔ Por qué. La auditoría del 20 de septiembre encontró que 10 de las 12
--    asignaciones de PASTOR_CONGREGACIONAL estaban sembradas con N2,
--    mientras el seed 007 les da Consejería (que exige N3) y el seed 010
--    subió el techo del rol a N4 por decisión de la dirección
--    (ACTA-DIR-2026-034). Resultado: un pastor abría la pestaña de su
--    consejería y recibía 403. La intención ya estaba escrita en la matriz;
--    lo que no cuadraba era el dato sembrado.
--
--    Se sube a N3, no a N4: N4 son los datos de menores, y ese nivel exige
--    antecedentes vigentes que en la demostración no están registrados.
--    Va en un seed porque las asignaciones de demostración son datos.
-- =====================================================================
UPDATE identidad.asignaciones
   SET nivel_max = 3
 WHERE rol = 'PASTOR_CONGREGACIONAL'
   AND nivel_max < 3
   AND revocada_en IS NULL;
