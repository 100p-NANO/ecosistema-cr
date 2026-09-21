-- =====================================================================
-- 0071 · LA CONSOLA DICE LA VERDAD
--
-- ⛔ QUÉ ESTABA ROTO. Las cifras de la consola se calculaban en el
--    navegador a partir de listas cortadas, y afirmaban cosas falsas con
--    aplomo. Es lo que un auditor contrasta contra la base en 30 segundos:
--
--    · «Iglesias con pastor: 9 ✓» contaba iglesias, tuvieran pastor o no
--      (había 8 con pastor).
--    · El paso «Dirección General» se marcaba con cualquier rol cuyo
--      nombre CONTUVIERA el texto: se creó EX_PASTOR_DIRECTOR_GENERAL por
--      la propia consola y la cifra subió.
--    · «Personas con acceso: 31» era el tamaño de una página, no el total.
--    · La ficha buscaba la cuenta de alguien entre las primeras 500: con
--      más cuentas, decía «no tiene cuenta» a quien sí la tenía.
--    · El buscador de cuentas trataba «%» y «_» como comodines.
--
--    Aquí nacen las cifras, calculadas donde están los datos y con el
--    mismo alcance que el resto de la consola.
-- =====================================================================
BEGIN;

-- ── a · Buscar cuentas sin comodines accidentales, y con la lista de roles
DROP FUNCTION IF EXISTS identidad.listar_cuentas(text, integer);
CREATE FUNCTION identidad.listar_cuentas(p_texto text DEFAULT NULL, p_limite integer DEFAULT 100)
RETURNS TABLE(cuenta_id uuid, persona_id uuid, persona text, usuario text, estado text,
              segundo_factor_activo boolean, exige_segundo_factor boolean, debe_cambiar_clave boolean,
              ultimo_ingreso timestamptz, intentos_fallidos smallint, bloqueada boolean,
              sede text, roles text, roles_lista text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = identidad, nucleo, org, plataforma, pg_temp AS $$
DECLARE v_patron text;
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  /* ⛔ «%» y «_» son comodines de ILIKE: buscar «50%» traía a todo el
     mundo. Se escapan antes de armar el patrón. */
  v_patron := CASE WHEN p_texto IS NULL OR btrim(p_texto) = '' THEN NULL
                   ELSE '%' || replace(replace(replace(btrim(p_texto), '\', '\\'), '%', '\%'), '_', '\_') || '%' END;
  RETURN QUERY
  SELECT c.id, c.persona_id, p.nombre_completo, c.usuario::text, c.estado::text,
         c.segundo_factor_activo, c.exige_segundo_factor, c.debe_cambiar_clave,
         c.ultimo_ingreso, c.intentos_fallidos,
         (c.bloqueada_hasta IS NOT NULL AND c.bloqueada_hasta > now()),
         s.codigo::text,
         r.lista_texto, r.lista
    FROM identidad.cuentas c
    JOIN nucleo.v_personas p ON p.id = c.persona_id
    LEFT JOIN org.sedes s ON s.id = p.sede_id
    LEFT JOIN LATERAL (
      SELECT string_agg(DISTINCT pe.rol, ', ' ORDER BY pe.rol) AS lista_texto,
             array_agg(DISTINCT pe.rol ORDER BY pe.rol)        AS lista
        FROM identidad.v_permiso_efectivo pe
       WHERE pe.persona_id = c.persona_id AND pe.vigente) r ON true
   WHERE (plataforma.sede_visible(p.sede_id)
          OR EXISTS (SELECT 1 FROM nucleo.membresias_sede m
                      WHERE m.persona_id = c.persona_id AND plataforma.sede_visible(m.sede_id)))
     AND (v_patron IS NULL OR p.nombre_completo ILIKE v_patron ESCAPE '\'
                           OR c.usuario::text   ILIKE v_patron ESCAPE '\')
   ORDER BY p.nombre_completo
   LIMIT GREATEST(1, LEAST(p_limite, 500));
END $$;
REVOKE ALL ON FUNCTION identidad.listar_cuentas(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.listar_cuentas(text, integer) TO casaroca_app;

-- ── b · El total de verdad, no el tamaño de la página ─────────────────
CREATE OR REPLACE FUNCTION identidad.resumen_cuentas()
RETURNS TABLE(total int, necesitan_atencion int, bloqueadas int, sin_segundo_factor int, suspendidas int)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = identidad, nucleo, plataforma, pg_temp AS $$
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  RETURN QUERY
  SELECT count(*)::int,
         count(*) FILTER (WHERE (c.bloqueada_hasta > now()) OR c.estado <> 'activa'
                            OR (c.exige_segundo_factor AND NOT c.segundo_factor_activo))::int,
         count(*) FILTER (WHERE c.bloqueada_hasta > now())::int,
         count(*) FILTER (WHERE c.exige_segundo_factor AND NOT c.segundo_factor_activo)::int,
         count(*) FILTER (WHERE c.estado <> 'activa')::int
    FROM identidad.cuentas c
    JOIN nucleo.personas p ON p.id = c.persona_id
   WHERE plataforma.sede_visible(p.sede_id)
      OR EXISTS (SELECT 1 FROM nucleo.membresias_sede m
                  WHERE m.persona_id = c.persona_id AND plataforma.sede_visible(m.sede_id));
END $$;
REVOKE ALL ON FUNCTION identidad.resumen_cuentas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.resumen_cuentas() TO casaroca_app;

-- ── c · La cuenta de UNA persona, sin buscarla entre las primeras 500 ─
CREATE OR REPLACE FUNCTION identidad.cuenta_de(p_persona uuid)
RETURNS TABLE(cuenta_id uuid, usuario text, estado text, segundo_factor_activo boolean,
              exige_segundo_factor boolean, debe_cambiar_clave boolean,
              ultimo_ingreso timestamptz, bloqueada boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = identidad, plataforma, pg_temp AS $$
BEGIN
  PERFORM identidad.exigir_admin_de(p_persona);
  RETURN QUERY
  SELECT c.id, c.usuario::text, c.estado::text, c.segundo_factor_activo, c.exige_segundo_factor,
         c.debe_cambiar_clave, c.ultimo_ingreso, (c.bloqueada_hasta IS NOT NULL AND c.bloqueada_hasta > now())
    FROM identidad.cuentas c WHERE c.persona_id = p_persona;
END $$;
REVOKE ALL ON FUNCTION identidad.cuenta_de(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.cuenta_de(uuid) TO casaroca_app;

-- ── d · ¿Tiene accesos que yo no alcanzo a ver? ─────────────────────
/* ⛔ A quien no alcanza la red, la ficha le decía «Sin roles vigentes:
   esta persona no puede hacer nada» sobre gente que SÍ tenía roles, solo
   que en un alcance que quien miraba no ve. Se devuelve solo el NÚMERO,
   nunca el detalle: saber que existen no es verlos. */
CREATE OR REPLACE FUNCTION identidad.accesos_vigentes_de(p_persona uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = identidad, pg_temp AS $$
  SELECT count(*)::int FROM identidad.v_permiso_efectivo pe
   WHERE pe.persona_id = p_persona AND pe.vigente
     AND EXISTS (SELECT 1 FROM nucleo.personas p WHERE p.id = p_persona);
$$;
REVOKE ALL ON FUNCTION identidad.accesos_vigentes_de(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.accesos_vigentes_de(uuid) TO casaroca_app;

-- ── e · La puesta en marcha, contada donde están los datos ──────────
CREATE OR REPLACE FUNCTION sistema.estado_de_arranque()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = sistema, identidad, org, plataforma, pg_temp AS $$
DECLARE r jsonb;
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  SELECT jsonb_build_object(
    /* ⛔ El rol EXACTO, no uno cuyo nombre lo contenga. */
    'directores', (SELECT count(DISTINCT pe.persona_id) FROM identidad.v_permiso_efectivo pe
                    WHERE pe.rol = 'PASTOR_DIRECTOR_GENERAL' AND pe.vigente),
    'equipos', (SELECT count(*) FROM org.unidades u WHERE u.clase = 'equipo' AND u.activa),
    'equipos_con_rol', (SELECT count(DISTINCT au.unidad_id) FROM identidad.asignaciones_unidad au
                          JOIN org.unidades u ON u.id = au.unidad_id AND u.clase = 'equipo' AND u.activa
                         WHERE au.revocada_en IS NULL
                           AND (au.vigente_hasta IS NULL OR au.vigente_hasta >= CURRENT_DATE)),
    'iglesias_activas', (SELECT count(*) FROM org.sedes s
                          WHERE s.activa AND plataforma.sede_visible(s.id)),
    /* ⛔ Contaba iglesias, tuvieran pastor o no. */
    'iglesias_con_pastor', (SELECT count(*) FROM org.sedes s
                             WHERE s.activa AND plataforma.sede_visible(s.id)
                               AND EXISTS (SELECT 1 FROM identidad.v_permiso_efectivo pe
                                            WHERE pe.vigente AND pe.alcance_tipo = 'sede'
                                              AND pe.alcance_id = s.id
                                              AND pe.rol = 'PASTOR_CONGREGACIONAL')),
    'iglesias_sin_pastor', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'codigo', s.codigo, 'nombre', s.nombre)
                                                       ORDER BY s.codigo), '[]'::jsonb)
                              FROM org.sedes s
                             WHERE s.activa AND s.tipo <> 'sede_madre' AND plataforma.sede_visible(s.id)
                               AND NOT EXISTS (SELECT 1 FROM identidad.v_permiso_efectivo pe
                                                WHERE pe.vigente AND pe.alcance_tipo = 'sede'
                                                  AND pe.alcance_id = s.id
                                                  AND pe.rol = 'PASTOR_CONGREGACIONAL')),
    'personas_con_acceso', (SELECT count(DISTINCT pe.persona_id) FROM identidad.v_permiso_efectivo pe
                             WHERE pe.vigente),
    'plantillas', (SELECT count(*) FROM sistema.plantillas),
    'plantillas_sin_nucleo', (SELECT count(*) FROM sistema.plantillas p
                               WHERE EXISTS (SELECT 1 FROM sistema.modulos m WHERE m.es_nucleo
                                              AND NOT EXISTS (SELECT 1 FROM sistema.plantilla_modulos pm
                                                               WHERE pm.plantilla = p.codigo AND pm.modulo = m.codigo))),
    'alcance_de_red', plataforma.ctx_es_global()
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION sistema.estado_de_arranque() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sistema.estado_de_arranque() TO casaroca_app;

-- ── f · Qué sedes alcanza un EQUIPO por sus roles, no por el organigrama
/* ⛔ «Sedes que alcanza» usaba `org.sedes_de_unidad`, que devuelve las
   sedes que CUELGAN de la unidad en el organigrama: para un equipo,
   siempre vacío. La pantalla decía «Ninguna por esta vía» justo cuando
   el equipo alcanzaba toda la red. */
CREATE OR REPLACE FUNCTION org.sedes_que_alcanza_el_equipo(p_unidad uuid)
RETURNS TABLE(sede_id uuid, codigo text, nombre text, por_rol text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = org, identidad, grupos, pg_temp AS $$
  WITH roles AS (
    SELECT au.rol, au.alcance_tipo::text AS tipo, au.alcance_id
      FROM identidad.asignaciones_unidad au
     WHERE au.unidad_id = p_unidad AND au.revocada_en IS NULL
       AND au.vigente_desde <= CURRENT_DATE
       AND (au.vigente_hasta IS NULL OR au.vigente_hasta >= CURRENT_DATE))
  SELECT DISTINCT ON (s.id) s.id, s.codigo, s.nombre, r.rol
    FROM roles r
    JOIN org.sedes s ON s.activa AND (
         r.tipo = 'organizacion'
      OR (r.tipo = 'sede'     AND s.id = r.alcance_id)
      OR (r.tipo = 'unidad'   AND s.id = ANY (org.sedes_de_unidad(r.alcance_id)))
      OR (r.tipo = 'segmento' AND s.id = (SELECT g.sede_id FROM org.segmentos g WHERE g.id = r.alcance_id))
      OR (r.tipo = 'grupo'    AND s.id = (SELECT gr.sede_id FROM grupos.grupos gr WHERE gr.id = r.alcance_id)))
   ORDER BY s.id, r.rol;
$$;
REVOKE ALL ON FUNCTION org.sedes_que_alcanza_el_equipo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION org.sedes_que_alcanza_el_equipo(uuid) TO casaroca_app;

COMMIT;
