-- =====================================================================
-- 0075 · EL PORTAL DEL CONGREGANTE
--
-- ⛔ QUÉ PASABA. Los derechos del titular (Ley 1581, art. 8: conocer,
--    actualizar, rectificar, revocar, pedir supresión) solo se podían
--    ejercer pidiéndoselos a alguien de la iglesia, que los radicaba a
--    mano. Y un miembro no podía ni ver sus propios datos: la política de
--    `nucleo.personas` no dejaba a nadie verse a sí mismo.
--
--    Aquí nace el camino del propio titular. Todo pasa por funciones que
--    SOLO actúan sobre `plataforma.ctx_persona_id()`: no reciben el
--    identificador de nadie, así que no hay forma de pedir los datos de
--    otro cambiando un parámetro.
-- =====================================================================
BEGIN;

CREATE SCHEMA IF NOT EXISTS portal;
REVOKE ALL ON SCHEMA portal FROM PUBLIC;
GRANT USAGE ON SCHEMA portal TO casaroca_app;

-- ── 1 · Cada quien se ve a sí mismo ──────────────────────────────────
/* El titular siempre puede ver su propia ficha básica (art. 8, a). No
   abre nada más: sigue sin ver a nadie que no esté en su alcance. */
DROP POLICY IF EXISTS personas_sel ON nucleo.personas;
CREATE POLICY personas_sel ON nucleo.personas FOR SELECT
  USING (plataforma.sede_visible(sede_id)
         OR id = plataforma.ctx_persona_id()
         OR EXISTS (SELECT 1 FROM nucleo.membresias_sede m
                     WHERE m.persona_id = personas.id AND plataforma.sede_visible(m.sede_id)));

-- ── 2 · Guardia común ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION portal.yo()
RETURNS uuid LANGUAGE plpgsql STABLE
SET search_path = pg_catalog, pg_temp AS $$
DECLARE v uuid := plataforma.ctx_persona_id();
BEGIN
  IF v IS NULL THEN
    RAISE EXCEPTION 'Necesita iniciar sesión para ver sus datos.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN v;
END $$;

-- ── 3 · Mi resumen ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION portal.mi_resumen()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = portal, nucleo, grupos, formacion, aportes, plataforma, org, pg_temp AS $$
DECLARE v_yo uuid := portal.yo(); v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'persona', (SELECT jsonb_build_object(
        'nombre', p.nombre_completo, 'primer_nombre', p.primer_nombre,
        'email', p.email_principal::text, 'telefono', p.telefono_movil, 'direccion', p.direccion,
        'sede', s.nombre, 'sede_codigo', s.codigo,
        'documento', CASE WHEN p.numero_documento IS NULL THEN NULL
                          ELSE p.tipo_documento || ' ···' || right(p.numero_documento, 4) END,
        'es_menor', p.es_menor)
      FROM nucleo.v_personas p LEFT JOIN org.sedes s ON s.id = p.sede_id WHERE p.id = v_yo),
    'grupos', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'grupo', g.nombre, 'tipo', cv.etiqueta, 'dia', g.dia_reunion, 'hora', to_char(g.hora_reunion, 'HH24:MI'),
        'rol', m.rol, 'desde', m.fecha_ingreso) ORDER BY g.nombre), '[]'::jsonb)
      FROM grupos.membresias m JOIN grupos.grupos g ON g.id = m.grupo_id
      LEFT JOIN sistema.catalogo_valores cv ON cv.catalogo = 'tipo_grupo' AND cv.codigo = g.tipo
      WHERE m.persona_id = v_yo AND m.fecha_salida IS NULL AND g.cerrado_en IS NULL),
    'formacion', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'curso', cu.nombre, 'cohorte', h.codigo, 'inicia', h.inicia, 'estado', i.estado::text,
        'pago', i.estado_pago::text, 'nota', i.nota_final) ORDER BY h.inicia DESC), '[]'::jsonb)
      FROM formacion.inscripciones i JOIN formacion.cohortes h ON h.id = i.cohorte_id
      JOIN formacion.cursos cu ON cu.id = h.curso_id WHERE i.persona_id = v_yo),
    'aportes_del_anio', (SELECT jsonb_build_object('cantidad', count(*), 'total', COALESCE(sum(a.monto), 0))
      FROM aportes.aportes a WHERE a.persona_id = v_yo AND a.anulado_en IS NULL
        AND a.estado::text IN ('confirmado', 'certificado') AND extract(year FROM a.fecha) = extract(year FROM CURRENT_DATE)),
    'certificados', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', c.id, 'numero', c.numero, 'desde', c.periodo_desde, 'hasta', c.periodo_hasta,
        'total', c.total, 'moneda', c.moneda) ORDER BY c.expedido_en DESC), '[]'::jsonb)
      FROM aportes.certificados c WHERE c.persona_id = v_yo AND c.anulado_en IS NULL),
    'consentimientos', portal.mis_consentimientos(),
    'peticiones', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'radicado', t.radicado, 'tipo', t.tipo, 'estado', t.estado, 'recibida', t.recibida_en::date,
        'vence', t.vence_en, 'respuesta', t.respuesta) ORDER BY t.recibida_en DESC), '[]'::jsonb)
      FROM plataforma.peticiones_titular t WHERE t.titular_id = v_yo),
    'hijos', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'nombre', pm.primer_nombre, 'edad', pm.edad, 'parentesco', a.parentesco,
        'puede_retirar', a.autoriza_retiro,
        'en_sala_ahora', EXISTS (SELECT 1 FROM rocakids.checkins k
                                  WHERE k.menor_id = a.menor_id AND k.salida_en IS NULL
                                    AND k.ingreso_en::date = CURRENT_DATE)) ORDER BY pm.primer_nombre), '[]'::jsonb)
      FROM nucleo.acudientes a JOIN nucleo.v_personas pm ON pm.id = a.menor_id
      WHERE a.acudiente_id = v_yo AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE))
  ) INTO v;
  RETURN v;
END $$;

-- ── 4 · Mis permisos de contacto ─────────────────────────────────────
/* El estado vigente por canal y finalidad, con la fecha del último acto.
   Solo las finalidades que se apoyan en el consentimiento: las demás
   (contrato, obligación legal, interés vital) no se «apagan» con un
   botón, y se dice así en la pantalla. */
CREATE OR REPLACE FUNCTION portal.mis_consentimientos()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = portal, plataforma, pg_temp AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'finalidad', f.codigo, 'finalidad_nombre', f.nombre, 'descripcion', f.descripcion,
           'canal', c.canal, 'otorgado', COALESCE(u.acto::text = 'otorgado', false), 'desde', u.ocurrido_en)
         ORDER BY f.codigo, c.canal), '[]'::jsonb)
    FROM plataforma.finalidades f
    CROSS JOIN (VALUES ('email'::plataforma.canal_contacto), ('whatsapp'), ('sms'), ('llamada')) AS c(canal)
    LEFT JOIN LATERAL (
      SELECT x.acto, x.ocurrido_en FROM plataforma.consentimientos x
       WHERE x.persona_id = portal.yo() AND x.canal = c.canal AND x.finalidad = f.codigo
       ORDER BY x.ocurrido_en DESC, x.registrado_en DESC, x.acto DESC LIMIT 1) u ON true
   WHERE f.base_legal = 'consentimiento';
$$;

CREATE OR REPLACE FUNCTION portal.cambiar_mi_consentimiento(p_canal text, p_finalidad text, p_otorgar boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = portal, plataforma, nucleo, pg_temp AS $$
DECLARE v_yo uuid := portal.yo(); v_sede uuid; v_base text;
BEGIN
  SELECT base_legal INTO v_base FROM plataforma.finalidades WHERE codigo = p_finalidad;
  IF v_base IS NULL THEN
    RAISE EXCEPTION 'Esa finalidad no existe.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_base <> 'consentimiento' THEN
    RAISE EXCEPTION 'Esa finalidad no se apoya en su consentimiento (%): para oponerse, radique una petición de Habeas Data y la iglesia le responde.', v_base
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_canal NOT IN ('email','whatsapp','sms','llamada') THEN
    RAISE EXCEPTION 'Ese canal no se administra desde aquí.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT sede_id INTO v_sede FROM nucleo.personas WHERE id = v_yo;
  /* `registrado_en` con la hora exacta del reloj: dos actos seguidos dentro
     de una misma transacción comparten `now()` y, en un empate, la base
     hace ganar la revocación. El desempate es el orden real de los clics. */
  INSERT INTO plataforma.consentimientos
    (persona_id, sede_id, finalidad, canal, acto, ocurrido_en, registrado_en, evidencia_tipo, evidencia_ref, otorgado_por, calidad)
  VALUES (v_yo, v_sede, p_finalidad, p_canal::plataforma.canal_contacto,
          CASE WHEN p_otorgar THEN 'otorgado' ELSE 'revocado' END::plataforma.acto_consentimiento,
          now(), clock_timestamp(), 'formulario_web', 'portal del congregante', v_yo, 'titular');
  RETURN jsonb_build_object('finalidad', p_finalidad, 'canal', p_canal, 'otorgado', p_otorgar);
END $$;

-- ── 5 · Mis datos de contacto ────────────────────────────────────────
CREATE OR REPLACE FUNCTION portal.actualizar_mis_datos(p_email text, p_telefono text, p_direccion text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = portal, nucleo, plataforma, pg_temp AS $$
DECLARE v_yo uuid := portal.yo();
BEGIN
  IF p_email IS NOT NULL AND p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN
    RAISE EXCEPTION 'Ese correo no tiene la forma de un correo.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_telefono IS NOT NULL AND p_telefono !~ '^[0-9 +()-]{7,20}$' THEN
    RAISE EXCEPTION 'Ese teléfono no tiene la forma de un teléfono (solo números, espacios y +).' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM set_config('app.motivo', 'Actualización hecha por el titular desde el portal', true);
  UPDATE nucleo.personas
     SET email_principal = COALESCE(NULLIF(btrim(p_email), ''), email_principal),
         telefono_movil  = COALESCE(NULLIF(btrim(p_telefono), ''), telefono_movil),
         direccion       = COALESCE(NULLIF(btrim(p_direccion), ''), direccion)
   WHERE id = v_yo;
  RETURN portal.mi_resumen() -> 'persona';
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Ese correo ya lo usa otra persona registrada. Escríbale a su sede para revisarlo.'
    USING ERRCODE = 'check_violation';
END $$;

-- ── 6 · Mis derechos: radicar una petición ───────────────────────────
CREATE OR REPLACE FUNCTION portal.radicar_mi_peticion(p_tipo text, p_detalle text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = portal, plataforma, nucleo, pg_temp AS $$
DECLARE v_yo uuid := portal.yo(); p record; r record;
BEGIN
  IF p_detalle IS NULL OR length(btrim(p_detalle)) < 15 THEN
    RAISE EXCEPTION 'Cuéntenos qué necesita en al menos 15 caracteres: así le podemos responder bien.'
      USING ERRCODE = 'check_violation';
  END IF;
  SELECT nombre_completo, sede_id, numero_documento, COALESCE(email_principal::text, telefono_movil) AS contacto
    INTO p FROM nucleo.v_personas WHERE id = v_yo;
  IF p.contacto IS NULL THEN
    RAISE EXCEPTION 'Para responderle necesitamos un correo o un teléfono: agréguelo en «Mis datos».'
      USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO plataforma.peticiones_titular
    (tipo, titular_id, titular_nombre, titular_documento, titular_contacto, detalle, canal, sede_id)
  VALUES (p_tipo, v_yo, p.nombre_completo, p.numero_documento, p.contacto, btrim(p_detalle), 'web', p.sede_id)
  RETURNING radicado, vence_en INTO r;
  RETURN jsonb_build_object('radicado', r.radicado, 'vence', r.vence_en);
END $$;

-- ── 7 · Todo lo que la iglesia tiene de mí (consulta y portabilidad) ──
/* Lo N1 y N2 sale directo. Lo N3 y N4 (consejería, notas pastorales,
   menores) NO sale por un botón: se pide con una consulta de Habeas Data y
   lo entrega una persona, que puede proteger a terceros que aparezcan ahí.
   Los aportes propios sí salen: son del titular y los necesita para su
   declaración de renta. La exportación deja rastro en la bitácora. */
CREATE OR REPLACE FUNCTION portal.mis_datos()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = portal, nucleo, grupos, formacion, aportes, plataforma, crm, asistencia, pg_temp AS $$
DECLARE v_yo uuid := portal.yo(); v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'generado_en', now(),
    'persona', (SELECT to_jsonb(x) - 'source_payload' - 'fusionada_en_id'
                  FROM (SELECT id, tipo_documento, numero_documento, primer_nombre, segundo_nombre, primer_apellido,
                               segundo_apellido, fecha_nacimiento, email_principal::text AS email, telefono_movil,
                               telefono_fijo, direccion, estado::text AS estado, creado_en, source_system,
                               source_payload, fusionada_en_id
                          FROM nucleo.personas WHERE id = v_yo) x),
    'sedes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('sede', s.nombre, 'tipo', m.tipo, 'desde', m.desde, 'hasta', m.hasta)), '[]'::jsonb)
                FROM nucleo.membresias_sede m JOIN org.sedes s ON s.id = m.sede_id WHERE m.persona_id = v_yo),
    'grupos', (SELECT COALESCE(jsonb_agg(jsonb_build_object('grupo', g.nombre, 'desde', m.fecha_ingreso,
                  'hasta', m.fecha_salida, 'motivo_salida', m.motivo_salida)), '[]'::jsonb)
                FROM grupos.membresias m JOIN grupos.grupos g ON g.id = m.grupo_id WHERE m.persona_id = v_yo),
    'asistencia_por_mes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('mes', mes, 'veces', n) ORDER BY mes), '[]'::jsonb)
                FROM (SELECT to_char(sv.fecha, 'YYYY-MM') AS mes, count(*) AS n
                        FROM asistencia.entradas e JOIN asistencia.servicios sv ON sv.id = e.servicio_id
                       WHERE e.persona_id = v_yo GROUP BY 1) t),
    'formacion', (SELECT COALESCE(jsonb_agg(jsonb_build_object('curso', cu.nombre, 'cohorte', h.codigo,
                  'estado', i.estado::text, 'nota', i.nota_final, 'pago', i.estado_pago::text)), '[]'::jsonb)
                FROM formacion.inscripciones i JOIN formacion.cohortes h ON h.id = i.cohorte_id
                JOIN formacion.cursos cu ON cu.id = h.curso_id WHERE i.persona_id = v_yo),
    'aportes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('fecha', a.fecha, 'tipo', a.tipo, 'monto', a.monto,
                  'moneda', a.moneda, 'estado', a.estado::text) ORDER BY a.fecha), '[]'::jsonb)
                FROM aportes.aportes a WHERE a.persona_id = v_yo AND a.anulado_en IS NULL),
    'consentimientos_historia', (SELECT COALESCE(jsonb_agg(jsonb_build_object('finalidad', c.finalidad, 'canal', c.canal,
                  'acto', c.acto::text, 'cuando', c.ocurrido_en, 'evidencia', c.evidencia_tipo) ORDER BY c.ocurrido_en), '[]'::jsonb)
                FROM plataforma.consentimientos c WHERE c.persona_id = v_yo),
    'historia', (SELECT COALESCE(jsonb_agg(jsonb_build_object('cuando', l.ocurrido_en, 'que', th.nombre, 'resumen', l.resumen)
                  ORDER BY l.ocurrido_en), '[]'::jsonb)
                FROM crm.linea_tiempo l JOIN crm.tipos_hecho th ON th.codigo = l.tipo
               WHERE l.persona_id = v_yo AND th.nivel <= 2),
    'no_incluido', 'Consejería, notas pastorales y datos de menores (N3 y N4) no se descargan con un botón: '
                   || 'pídalos con una consulta de Habeas Data y una persona de la iglesia se los entrega.'
  ) INTO v;
  PERFORM plataforma.registrar_lectura('nucleo', 'personas', v_yo::text, 2::smallint,
                                       'el titular descargó sus propios datos desde el portal');
  RETURN v;
END $$;

-- ── 8 · Mi certificado de donación ───────────────────────────────────
CREATE OR REPLACE FUNCTION portal.es_mi_certificado(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = portal, aportes, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM aportes.certificados c
                  WHERE c.id = p_id AND c.persona_id = portal.yo() AND c.anulado_en IS NULL);
$$;

/* Los datos del certificado, solo si es del titular. La plantilla vive en
   la API (una sola para Tesorería y para el portal). */
CREATE OR REPLACE FUNCTION portal.mi_certificado(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = portal, modelo100p, org, pg_temp AS $$
  SELECT jsonb_build_object(
    'cert', to_jsonb(c),
    'persona', (SELECT to_jsonb(x) FROM (SELECT nombre_completo, documento, tipo_documento
                                          FROM modelo100p.personas WHERE id = c.persona_id) x),
    'sede', (SELECT to_jsonb(x) FROM (SELECT nombre, ciudad FROM org.sedes WHERE id = c.sede_id) x),
    'detalle', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.fecha_aporte), '[]'::jsonb)
                  FROM (SELECT fecha_aporte, tipo_aporte, metodo_pago, monto
                          FROM modelo100p.donaciones WHERE certificado_id = c.id) x))
    FROM modelo100p.certificados c
   WHERE c.id = p_id AND c.persona_id = portal.yo();
$$;

-- ── Permisos: solo la aplicación, y solo estas funciones ─────────────
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA portal FROM PUBLIC;
GRANT EXECUTE ON FUNCTION portal.mi_resumen(), portal.mis_consentimientos(),
  portal.cambiar_mi_consentimiento(text, text, boolean), portal.actualizar_mis_datos(text, text, text),
  portal.radicar_mi_peticion(text, text), portal.mis_datos(), portal.es_mi_certificado(uuid),
  portal.mi_certificado(uuid)
  TO casaroca_app;
GRANT EXECUTE ON FUNCTION portal.yo() TO casaroca_app;

COMMIT;
