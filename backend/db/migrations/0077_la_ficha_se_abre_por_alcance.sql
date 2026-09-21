-- =====================================================================
-- 0077 · LA FICHA DE UNA PERSONA SE ABRE POR ALCANCE, NO POR SEDE
--
-- ⛔ QUÉ PASABA (medido el 21 sep 2026 contra la API). El aislamiento
--    entre iglesias es por SEDE: `identidad.sedes_de` convierte cada
--    alcance fino en la sede entera («grupo: la sede del grupo»,
--    «ministerio: las sedes donde está encendido»). Para separar Bogotá
--    de Medellín eso basta. Para la ficha de una persona, no.
--
--    Un líder de grupo, con alcance sobre UN grupo de cero miembros,
--    pedía `/api/v1/personas` y recibía a las 35 personas de su sede; y
--    `/api/v1/personas/:id` le devolvía la ficha completa de cualquiera
--    de ellas: correo, teléfono, dirección, fecha de nacimiento, estado
--    civil. La arquitectura prevé unos 800 líderes de grupo. Ochocientas
--    personas con el directorio entero de su sede no es «acompañar a los
--    miembros de su grupo», que es lo que dice su rol.
--
--    Y editar (`PUT /personas/:id`) no pedía el permiso «editar» del
--    módulo: bastaba con ver la sede. La política de la base mira la sede
--    y nada más, y el servicio no preguntaba.
--
-- ✅ QUÉ CAMBIA. La ficha, su historia, sus casillas, sus posibles
--    duplicados y su edición exigen que quien pide ALCANCE a esa persona
--    con un rol que tenga permiso sobre el módulo Personas:
--
--      organizacion ........ a todos
--      sede ................ a quien pertenece a esa sede
--      unidad .............. a quien pertenece a una sede de la unidad
--      grupo ............... a los miembros activos de ese grupo
--      segmento ............ a los miembros de los grupos del segmento
--      ministerio .......... a quien sirve en él o está en uno de sus grupos
--      caso_propio ......... a quien consulta en un caso que tiene asignado
--      persona_propia ...... a sí mismo; el acudiente, a sus menores
--
--    Se aplica en la API como segunda cerradura (la primera, la sede,
--    sigue en la base). La BÚSQUEDA de nombres no cambia: el líder la
--    necesita para agregar a alguien a su grupo, y devuelve nombre,
--    documento y sede, no la ficha.
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION identidad.alcanza_persona(p_lector uuid, p_persona uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $$
  WITH permisos AS (
    -- Solo cuentan los roles que tienen algo que hacer con Personas.
    SELECT pe.alcance_tipo::text AS tipo, pe.alcance_id
      FROM identidad.v_permiso_efectivo pe
     WHERE pe.persona_id = p_lector AND pe.vigente
       AND EXISTS (SELECT 1 FROM sistema.matriz_permisos mp
                    WHERE mp.rol = pe.rol AND mp.modulo = 'personas')
  ),
  sedes_de_la_persona AS (
    SELECT p.sede_id AS sede FROM nucleo.personas p
     WHERE p.id = p_persona AND p.eliminado_en IS NULL AND p.sede_id IS NOT NULL
    UNION
    SELECT m.sede_id FROM nucleo.membresias_sede m
     WHERE m.persona_id = p_persona AND m.hasta IS NULL
  ),
  grupos_de_la_persona AS (
    SELECT gr.id, gr.segmento_id, gr.ministerio_id
      FROM grupos.membresias mb JOIN grupos.grupos gr ON gr.id = mb.grupo_id
     WHERE mb.persona_id = p_persona AND mb.fecha_salida IS NULL AND gr.cerrado_en IS NULL
  )
  SELECT p_lector IS NOT NULL AND p_persona IS NOT NULL
     AND EXISTS (SELECT 1 FROM nucleo.personas x WHERE x.id = p_persona AND x.eliminado_en IS NULL)
     AND (
          -- uno mismo, si tiene algún rol con Personas (el portal va por su propio camino)
          (p_lector = p_persona AND EXISTS (SELECT 1 FROM permisos))
       OR EXISTS (SELECT 1 FROM permisos WHERE tipo = 'organizacion')
       OR EXISTS (SELECT 1 FROM permisos pm JOIN sedes_de_la_persona s ON s.sede = pm.alcance_id
                   WHERE pm.tipo = 'sede')
       OR EXISTS (SELECT 1 FROM permisos pm, sedes_de_la_persona s
                   WHERE pm.tipo = 'unidad' AND pm.alcance_id IS NOT NULL
                     AND s.sede = ANY (org.sedes_de_unidad(pm.alcance_id)))
       OR EXISTS (SELECT 1 FROM permisos pm JOIN grupos_de_la_persona g ON g.id = pm.alcance_id
                   WHERE pm.tipo = 'grupo')
       OR EXISTS (SELECT 1 FROM permisos pm JOIN grupos_de_la_persona g ON g.segmento_id = pm.alcance_id
                   WHERE pm.tipo = 'segmento')
       OR EXISTS (SELECT 1 FROM permisos pm
                   WHERE pm.tipo = 'ministerio'
                     AND (EXISTS (SELECT 1 FROM grupos_de_la_persona g WHERE g.ministerio_id = pm.alcance_id)
                          OR EXISTS (SELECT 1 FROM talento.voluntariados v
                                      WHERE v.persona_id = p_persona AND v.ministerio_id = pm.alcance_id
                                        AND v.estado::text = 'activo'
                                        AND (v.hasta IS NULL OR v.hasta >= CURRENT_DATE))))
       OR EXISTS (SELECT 1 FROM permisos pm
                   WHERE pm.tipo = 'caso_propio'
                     AND EXISTS (SELECT 1 FROM consejeria.asignaciones a
                                   JOIN consejeria.casos c ON c.id = a.caso_id
                                  WHERE a.consejero_id = p_lector AND a.hasta IS NULL
                                    AND c.consultante_id = p_persona))
       OR EXISTS (SELECT 1 FROM permisos pm
                   WHERE pm.tipo = 'persona_propia'
                     AND EXISTS (SELECT 1 FROM nucleo.acudientes ac
                                  WHERE ac.acudiente_id = p_lector AND ac.menor_id = p_persona
                                    AND (ac.vigente_hasta IS NULL OR ac.vigente_hasta >= CURRENT_DATE)))
     );
$$;

COMMENT ON FUNCTION identidad.alcanza_persona(uuid, uuid) IS
  'Si el lector alcanza a esa persona con un rol que tenga permiso sobre Personas. '
  'Es la segunda cerradura de la ficha: la sede la pone la base; el alcance fino (grupo, '
  'segmento, ministerio, caso, acudiente), esta función. Migración 0077.';

REVOKE ALL ON FUNCTION identidad.alcanza_persona(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.alcanza_persona(uuid, uuid) TO casaroca_app;

COMMIT;
