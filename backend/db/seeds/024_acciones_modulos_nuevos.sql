-- =====================================================================
-- Seed 024 · Las acciones propias de los módulos nuevos (migración 0074)
--
-- Solo DEFINE las acciones. Quién las tiene lo decide la mesa desde la
-- consola (Permisos), con acta: en producción no se otorga nada solo.
-- La propuesta para desarrollo y demostración vive en la semilla 025.
-- =====================================================================
INSERT INTO sistema.acciones (codigo, nombre, orden, es_sensible, modulo, descripcion) VALUES
 ('VER_CONFIDENCIAL_ORACION', 'Ver peticiones de oración confidenciales', 60, true, 'oracion',
  'Una petición confidencial solo la ven quien la registró y quien tenga esta acción.'),
 ('DECIDIR_PETICION', 'Aprobar o rechazar una petición interna', 60, false, 'peticiones',
  'Decidir lo que una sede o un equipo le pide a la dirección. Nadie decide lo que él mismo pidió.'),
 ('ATENDER_REQUERIMIENTO', 'Atender un requerimiento', 60, false, 'requerimientos',
  'Asignar, resolver y cerrar requerimientos de la mesa de servicio.'),
 ('APROBAR_COMUNICACION', 'Aprobar un envío masivo', 60, true, 'comunicaciones',
  'Un envío a mucha gente lo aprueba una persona DISTINTA de quien lo escribió.')
ON CONFLICT (codigo) DO NOTHING;
