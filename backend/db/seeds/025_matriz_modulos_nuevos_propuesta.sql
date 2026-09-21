-- =====================================================================
-- Seed 025 · PROPUESTA de permisos para los módulos nuevos (solo demo)
--
-- ⚠️ Es una propuesta técnica para que los módulos nazcan usables en
--    desarrollo y en la demostración. En PRODUCCIÓN no se aplica: está en
--    SEMILLAS_DEMO. Allí la mesa la ratifica o la cambia desde la consola,
--    con acta, que es donde se deciden los permisos.
--
--    · El pastor de una sede atiende la oración de su sede (crear, editar)
--      y ve lo confidencial; aprueba envíos masivos (los pastores van en
--      matrimonio: la pareja pastoral da los cuatro ojos).
--    · La gerencia administrativa atiende la mesa de servicio.
-- =====================================================================
INSERT INTO sistema.matriz_permisos (rol, modulo, accion, acta_ref) VALUES
 ('PASTOR_CONGREGACIONAL','oracion','crear','Propuesta 21 sep 2026 · ratificar en mesa'),
 ('PASTOR_CONGREGACIONAL','oracion','editar','Propuesta 21 sep 2026 · ratificar en mesa'),
 ('PASTOR_CONGREGACIONAL','oracion','VER_CONFIDENCIAL_ORACION','Propuesta 21 sep 2026 · ratificar en mesa'),
 ('PASTOR_CONGREGACIONAL','comunicaciones','APROBAR_COMUNICACION','Propuesta 21 sep 2026 · ratificar en mesa'),
 ('GERENCIA_ADMINISTRATIVA','requerimientos','ver','Propuesta 21 sep 2026 · ratificar en mesa'),
 ('GERENCIA_ADMINISTRATIVA','requerimientos','ATENDER_REQUERIMIENTO','Propuesta 21 sep 2026 · ratificar en mesa')
ON CONFLICT DO NOTHING;
