-- =====================================================================
-- 0069 · EL RASTRO DE LA ADMINISTRACIÓN
--
-- ⛔ QUÉ ESTABA ROTO. `plataforma.tg_auditar` colgaba de nueve tablas y
--    NINGUNA era de administración. La pestaña «Quién hizo y quién miró»
--    no podía responder «¿quién creó este equipo?», «¿quién encendió
--    RocaKids en Medellín?», «¿quién dio de alta esta cuenta?» ni «¿quién
--    cambió lo que puede hacer Tesorería?». Una consola de administración
--    cuyas acciones administrativas no quedan registradas.
--
-- ⛔ Y cuatro trazas que MENTÍAN o no existían:
--    · `modulos_sede.activado_por` se pisaba también al APAGAR, y
--      `activado_en` solo al encender: «activado por B, a la hora en que
--      lo encendió A», con el módulo apagado.
--    · En la línea de tiempo pastoral, `registrado_por` quedaba vacío en
--      todos los hechos: el pastor leía «entró al grupo» sin saber quién
--      lo puso.
--    · Sacar a alguien de un grupo no dejaba hecho en la línea de tiempo.
--    · Grupos y servicios no tenían autor.
--
-- ⛔ Y tres puertas sin vuelta atrás o sin guardia:
--    · Una plantilla nueva nacía sin sus módulos de núcleo, y desplegar
--      con ella fallaba. «Crear» una plantilla con un código existente la
--      reescribía.
--    · La plantilla MAESTRA se podía borrar por la ruta (solo el navegador
--      lo impedía) y borrar una que no existe respondía «borrada».
--    · Una iglesia desplegada por error no se podía ni borrar ni apagar.
-- =====================================================================
BEGIN;

-- ── a · La bitácora cuelga de la administración ──────────────────────
/* Las cuentas NO copian el hash ni el secreto del segundo factor, y los
   datos de cada ingreso (última entrada, intentos) tampoco: sin eso cada
   inicio de sesión sería una fila de auditoría y la bitácora se llenaría
   de ruido. Un bloqueo, un desbloqueo, un cambio de estado o de clave sí
   quedan (sin la clave). */
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('identidad','cuentas',        ARRAY['-clave_hash','-segundo_factor_secreto','-ultimo_ingreso','-intentos_fallidos']),
    ('identidad','roles',          ARRAY['#codigo']),
    ('sistema',  'matriz_permisos',ARRAY['#rol','#modulo','#accion']),
    ('org',      'unidades',       ARRAY[]::text[]),
    ('org',      'sedes',          ARRAY['-actualizado_en']),
    ('sistema',  'plantillas',     ARRAY['#codigo']),
    ('sistema',  'plantilla_modulos', ARRAY['#plantilla','#modulo']),
    ('sistema',  'modulos_sede',   ARRAY['#sede_id','#modulo']),
    ('sistema',  'catalogo_valores', ARRAY['#catalogo','#codigo']),
    ('grupos',   'grupos',         ARRAY['-actualizado_en']),
    ('grupos',   'membresias',     ARRAY[]::text[]),
    ('asistencia','servicios',     ARRAY[]::text[]),
    ('asistencia','conteos',       ARRAY['#servicio_id']),
    ('talento',  'voluntariados',  ARRAY[]::text[]),
    ('formacion','inscripciones',  ARRAY[]::text[])
  ) AS t(esquema, tabla, args)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auditar ON %I.%I', r.esquema, r.tabla);
    EXECUTE format(
      'CREATE TRIGGER trg_auditar AFTER INSERT OR UPDATE OR DELETE ON %I.%I '
      'FOR EACH ROW EXECUTE FUNCTION plataforma.tg_auditar(%s)',
      r.esquema, r.tabla,
      COALESCE((SELECT string_agg(quote_literal(a), ',') FROM unnest(r.args) a), ''));
  END LOOP;
END $$;

-- ── b · Encender y apagar son dos hechos distintos ───────────────────
ALTER TABLE sistema.modulos_sede
  ADD COLUMN IF NOT EXISTS desactivado_en  timestamptz,
  ADD COLUMN IF NOT EXISTS desactivado_por uuid;

COMMENT ON COLUMN sistema.modulos_sede.activado_por IS
  'Quién lo ENCENDIÓ la última vez. Apagarlo NO lo pisa: eso va en desactivado_por (0069).';

CREATE OR REPLACE FUNCTION sistema.habilitar_modulo(
  p_sede uuid, p_modulo text, p_activo boolean,
  p_evidencia text DEFAULT NULL, p_nota text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = sistema, plataforma, pg_temp AS $$
DECLARE v_quien uuid := plataforma.ctx_persona_id();
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  IF NOT plataforma.sede_visible(p_sede) THEN
    RAISE EXCEPTION 'Esa sede no está en su alcance' USING ERRCODE='insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM org.sedes WHERE id = p_sede) THEN
    RAISE EXCEPTION 'No existe esa sede.' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT p_activo AND (p_nota IS NULL OR length(btrim(p_nota)) < 5) THEN
    RAISE EXCEPTION 'Apagar un módulo en una iglesia exige decir por qué: la gente de esa sede deja de verlo desde ya.'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('app.motivo', COALESCE(btrim(p_nota), ''), true);

  INSERT INTO sistema.modulos_sede
    (sede_id, modulo, activo, evidencia_legal_ref, nota,
     activado_por, activado_en, desactivado_por, desactivado_en)
  VALUES (p_sede, p_modulo, p_activo, p_evidencia, p_nota,
          CASE WHEN p_activo THEN v_quien END, CASE WHEN p_activo THEN now() END,
          CASE WHEN NOT p_activo THEN v_quien END, CASE WHEN NOT p_activo THEN now() END)
  ON CONFLICT (sede_id, modulo) DO UPDATE
    SET activo = EXCLUDED.activo,
        evidencia_legal_ref = COALESCE(EXCLUDED.evidencia_legal_ref, sistema.modulos_sede.evidencia_legal_ref),
        nota = COALESCE(EXCLUDED.nota, sistema.modulos_sede.nota),
        -- ⛔ cada lado toca SOLO lo suyo
        activado_por    = CASE WHEN EXCLUDED.activo     THEN EXCLUDED.activado_por    ELSE sistema.modulos_sede.activado_por    END,
        activado_en     = CASE WHEN EXCLUDED.activo     THEN EXCLUDED.activado_en     ELSE sistema.modulos_sede.activado_en     END,
        desactivado_por = CASE WHEN NOT EXCLUDED.activo THEN EXCLUDED.desactivado_por ELSE sistema.modulos_sede.desactivado_por END,
        desactivado_en  = CASE WHEN NOT EXCLUDED.activo THEN EXCLUDED.desactivado_en  ELSE sistema.modulos_sede.desactivado_en  END;
END $$;

-- ── c · Quién: en la línea de tiempo y en lo que se crea ─────────────
CREATE OR REPLACE FUNCTION crm.anotar_hecho(
  p_persona uuid, p_sede uuid, p_ocurrido timestamptz, p_tipo text,
  p_modulo text, p_ent_tipo text, p_ent_id text, p_resumen text,
  p_detalle jsonb DEFAULT NULL, p_src_sys text DEFAULT NULL, p_src_id text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = crm, pg_temp AS $$
BEGIN
  IF p_persona IS NULL OR p_sede IS NULL THEN RETURN; END IF;

  INSERT INTO crm.linea_tiempo
    (persona_id, sede_id, ocurrido_en, tipo,
     entidad_modulo, entidad_tipo, entidad_id, resumen, detalle,
     source_system, source_id, registrado_por)
  VALUES
    (p_persona, p_sede, p_ocurrido, p_tipo,
     p_modulo, p_ent_tipo, p_ent_id, p_resumen, p_detalle,
     p_src_sys, p_src_id,
     /* ⛔ Quedaba vacío en TODOS los hechos: el pastor leía «entró al
        grupo» sin poder saber quién lo puso. Una importación no tiene
        sesión, y entonces sí queda vacío: lo dice source_system. */
     plataforma.ctx_persona_id());
END $$;

ALTER TABLE grupos.grupos        ADD COLUMN IF NOT EXISTS creado_por  uuid DEFAULT plataforma.ctx_persona_id();
ALTER TABLE asistencia.servicios ADD COLUMN IF NOT EXISTS creado_por  uuid DEFAULT plataforma.ctx_persona_id();
ALTER TABLE grupos.membresias    ADD COLUMN IF NOT EXISTS agregado_por uuid DEFAULT plataforma.ctx_persona_id();
ALTER TABLE grupos.membresias    ADD COLUMN IF NOT EXISTS sacado_por   uuid;
ALTER TABLE asistencia.entradas  ADD COLUMN IF NOT EXISTS marcada_por  uuid DEFAULT plataforma.ctx_persona_id();

/* Sacar a alguien de un grupo también es un hecho de su historia. */
CREATE OR REPLACE FUNCTION grupos.tg_membresia_salida()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = grupos, crm, plataforma, pg_temp AS $$
DECLARE v_sede uuid; v_nombre text;
BEGIN
  IF OLD.fecha_salida IS NULL AND NEW.fecha_salida IS NOT NULL THEN
    NEW.sacado_por := COALESCE(NEW.sacado_por, plataforma.ctx_persona_id());
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION grupos.tg_membresia_salida_a_linea()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = grupos, crm, pg_temp AS $$
DECLARE v_sede uuid; v_nombre text;
BEGIN
  IF OLD.fecha_salida IS NULL AND NEW.fecha_salida IS NOT NULL THEN
    SELECT g.sede_id, g.nombre INTO v_sede, v_nombre FROM grupos.grupos g WHERE g.id = NEW.grupo_id;
    PERFORM crm.anotar_hecho(
      NEW.persona_id, v_sede, NEW.fecha_salida::timestamptz, 'SALIDA_GRUPO',
      'grupos', 'membresia', NEW.id::text,
      'Salió del grupo ' || coalesce(v_nombre, ''),
      jsonb_build_object('grupo_id', NEW.grupo_id, 'motivo', NEW.motivo_salida));
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_membresia_salida ON grupos.membresias;
CREATE TRIGGER trg_membresia_salida BEFORE UPDATE OF fecha_salida ON grupos.membresias
  FOR EACH ROW EXECUTE FUNCTION grupos.tg_membresia_salida();
DROP TRIGGER IF EXISTS trg_membresia_salida_a_linea ON grupos.membresias;
CREATE TRIGGER trg_membresia_salida_a_linea AFTER UPDATE OF fecha_salida ON grupos.membresias
  FOR EACH ROW EXECUTE FUNCTION grupos.tg_membresia_salida_a_linea();

-- ── d · Un valor fuera de la lista se dice con la lista ──────────────
/* ⛔ Levantaba 23503 (llave foránea) y la API lo traducía como «la sede,
   el ministerio o el segmento no existen»: el error CULPABA A LA SEDE de
   un tipo de grupo mal escrito. Ahora es una regla (23514) y dice cuáles
   valen. */
CREATE OR REPLACE FUNCTION sistema.tg_valor_de_catalogo_vigente()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = sistema, pg_temp AS $$
DECLARE v_cat text; v_col text; v_val text; v_vig boolean; v_validos text;
BEGIN
  v_cat := TG_ARGV[0]; v_col := TG_ARGV[1];
  EXECUTE format('SELECT ($1).%I::text', v_col) INTO v_val USING NEW;
  IF v_val IS NULL THEN RETURN NEW; END IF;
  SELECT vigente INTO v_vig FROM sistema.catalogo_valores
   WHERE catalogo = v_cat AND codigo = v_val;
  IF v_vig IS NULL OR NOT v_vig THEN
    SELECT string_agg(etiqueta || ' (' || codigo || ')', ', ' ORDER BY orden, codigo) INTO v_validos
      FROM sistema.catalogo_valores
     WHERE catalogo = v_cat AND vigente AND retirado_en IS NULL;
    RAISE EXCEPTION '%', format(
      CASE WHEN v_vig IS NULL
           THEN '«%s» no está en la lista de %s. Valores válidos: %s.'
           ELSE '«%s» fue retirado de la lista de %s: no se usa en registros nuevos. Valores válidos: %s.' END,
      v_val, replace(v_cat, '_', ' '), COALESCE(v_validos, 'ninguno todavía'))
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

-- ── e · Plantillas: nacen con su núcleo, y crear no reescribe ────────
DROP FUNCTION IF EXISTS sistema.guardar_plantilla(text, text, text, text);
CREATE FUNCTION sistema.guardar_plantilla(
  p_codigo text, p_nombre text, p_tipo_sede text, p_descripcion text DEFAULT NULL,
  p_nueva boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = sistema, plataforma, pg_temp AS $$
DECLARE v_existe sistema.plantillas%ROWTYPE; v_desc text;
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  IF NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'Las plantillas son de toda la red: exige alcance de organización'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_codigo IS NULL OR p_codigo !~ '^[A-Z][A-Z0-9_]{1,29}$' THEN
    RAISE EXCEPTION 'El código de la plantilla va en MAYÚSCULAS, sin espacios ni tildes (por ejemplo FILIAL_PEQUENA).'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_existe FROM sistema.plantillas WHERE codigo = p_codigo;

  IF p_nueva AND v_existe.codigo IS NOT NULL THEN
    RAISE EXCEPTION 'Ya existe la plantilla «%» (%). Crear no reescribe: ábrala y edítela.',
      p_codigo, v_existe.nombre USING ERRCODE = 'unique_violation';
  END IF;
  IF NOT p_nueva AND v_existe.codigo IS NULL THEN
    RAISE EXCEPTION 'No existe la plantilla «%». Para crearla, use «Nueva plantilla».', p_codigo
      USING ERRCODE = 'no_data_found';
  END IF;

  /* ⛔ Renombrar dejando vacía la descripción daba un error del motor en
     inglés: la columna es obligatoria. Lo que no se manda, se conserva. */
  v_desc := COALESCE(NULLIF(btrim(p_descripcion), ''), v_existe.descripcion);
  IF v_desc IS NULL OR length(v_desc) < 10 THEN
    RAISE EXCEPTION 'Escriba para qué tipo de iglesia es la plantilla: al menos diez caracteres.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_existe.codigo IS NULL THEN
    INSERT INTO sistema.plantillas (codigo, nombre, tipo_sede, descripcion)
    VALUES (p_codigo, btrim(p_nombre), p_tipo_sede::org.tipo_sede, v_desc);
    /* ⛔ Nacía con CERO módulos: la consola pintaba las casillas de núcleo
       sin marcar y deshabilitadas («no se puede quitar», cuando FALTABAN)
       y desplegar con ella fallaba. El núcleo viene puesto de fábrica. */
    INSERT INTO sistema.plantilla_modulos (plantilla, modulo)
    SELECT p_codigo, m.codigo FROM sistema.modulos m WHERE m.es_nucleo
    ON CONFLICT DO NOTHING;
  ELSE
    UPDATE sistema.plantillas
       SET nombre = COALESCE(NULLIF(btrim(p_nombre), ''), nombre),
           tipo_sede = p_tipo_sede::org.tipo_sede,
           descripcion = v_desc
     WHERE codigo = p_codigo;
  END IF;
  RETURN p_codigo;
END $$;
REVOKE ALL ON FUNCTION sistema.guardar_plantilla(text, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sistema.guardar_plantilla(text, text, text, text, boolean) TO casaroca_app;

CREATE OR REPLACE FUNCTION sistema.borrar_plantilla(p_codigo text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = sistema, plataforma, pg_temp AS $$
DECLARE v_usos int;
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  IF NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'Las plantillas son de toda la red: exige alcance de organización'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  /* ⛔ Solo el navegador impedía borrar la MAESTRA: por la ruta se borraba
     y arrastraba sus 22 módulos por la cascada. */
  IF p_codigo = 'MAESTRA' THEN
    RAISE EXCEPTION 'La plantilla MAESTRA es la base de todas las demás: no se borra.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sistema.plantillas WHERE codigo = p_codigo) THEN
    RAISE EXCEPTION 'No existe la plantilla «%»: no había nada que borrar.', p_codigo
      USING ERRCODE = 'no_data_found';
  END IF;
  SELECT count(*) INTO v_usos FROM sistema.bitacora_aprovisionamiento b
   WHERE b.detalle->>'plantilla' = p_codigo;
  IF v_usos > 0 THEN
    RAISE EXCEPTION 'Esa plantilla ya se usó para crear % iglesia(s): no se borra, porque es lo que explica por qué cada una ve lo que ve.', v_usos
      USING ERRCODE = 'check_violation';
  END IF;
  DELETE FROM sistema.plantillas WHERE codigo = p_codigo;
END $$;

-- ── f · Desplegar una iglesia ya tiene vuelta atrás ──────────────────
ALTER TABLE sistema.bitacora_aprovisionamiento DROP CONSTRAINT IF EXISTS bitacora_aprovisionamiento_accion_check;
ALTER TABLE sistema.bitacora_aprovisionamiento ADD CONSTRAINT bitacora_aprovisionamiento_accion_check
  CHECK (accion = ANY (ARRAY['sede_creada','sede_desactivada','sede_reactivada',
                             'modulo_encendido','modulo_apagado','permiso_otorgado','permiso_revocado',
                             'rol_asignado','rol_retirado']));

/* No se borra (la regla `sedes_no_delete` protege la historia): se
   DESACTIVA, con motivo, y se puede reactivar. Una sede inactiva deja de
   ofrecerse en los formularios y su gente conserva todo lo que tenía. */
CREATE OR REPLACE FUNCTION sistema.cambiar_estado_sede(p_sede uuid, p_activa boolean, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = sistema, org, plataforma, pg_temp AS $$
DECLARE v_s org.sedes%ROWTYPE;
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  IF NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'Activar o desactivar una iglesia es una decisión de la red: exige alcance de organización'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Escriba por qué: queda en la auditoría con su nombre.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_s FROM org.sedes WHERE id = p_sede;
  IF v_s.id IS NULL THEN
    RAISE EXCEPTION 'No existe esa iglesia.' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_s.tipo = 'sede_madre' AND NOT p_activa THEN
    RAISE EXCEPTION 'La sede maestra no se desactiva: de ella cuelgan todas las demás.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_s.activa = p_activa THEN
    RAISE EXCEPTION 'La iglesia % ya estaba %.', v_s.codigo, CASE WHEN p_activa THEN 'activa' ELSE 'desactivada' END
      USING ERRCODE = 'check_violation';
  END IF;
  PERFORM set_config('app.motivo', btrim(p_motivo), true);
  UPDATE org.sedes SET activa = p_activa WHERE id = p_sede;
  INSERT INTO sistema.bitacora_aprovisionamiento (actor_id, accion, sede_id, detalle)
  VALUES (plataforma.ctx_persona_id(), CASE WHEN p_activa THEN 'sede_reactivada' ELSE 'sede_desactivada' END,
          p_sede, jsonb_build_object('codigo', v_s.codigo, 'motivo', btrim(p_motivo)));
  RETURN jsonb_build_object('sede', p_sede, 'codigo', v_s.codigo, 'activa', p_activa);
END $$;
REVOKE ALL ON FUNCTION sistema.cambiar_estado_sede(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sistema.cambiar_estado_sede(uuid, boolean, text) TO casaroca_app;

-- ── g · Desplegar: la plantilla del tipo correcto y el pastor con su nivel ─
/* ⛔ Dos hallazgos:
   · el pastor nacía con N2 escrito a mano mientras la dirección subió el
     techo del rol a N4 (ACTA-DIR-2026-034) y Consejería exige N3: ningún
     pastor de una iglesia nueva podía abrir su consejería. El nivel ahora
     se decide al desplegar; por omisión N3 (su consejería y sus aportes).
     N4 (menores) exige además antecedentes vigentes, y eso lo sigue
     imponiendo la base.
   · una plantación podía nacer con la plantilla de una internacional. */
DROP FUNCTION IF EXISTS sistema.crear_iglesia(text, text, org.tipo_sede, character, text, text, uuid, smallint);
CREATE FUNCTION sistema.crear_iglesia(
  p_codigo text, p_nombre text, p_tipo org.tipo_sede, p_pais character, p_ciudad text,
  p_plantilla text, p_pastor_id uuid, p_ola smallint DEFAULT NULL,
  p_nivel_pastor smallint DEFAULT 3)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = sistema, org, identidad, plataforma, public, pg_temp AS $$
DECLARE v_sede uuid; v_maestra uuid; v_actor uuid := plataforma.ctx_persona_id(); v_n int;
        v_tipo_pl org.tipo_sede; v_nivel smallint;
BEGIN
  v_maestra := sistema.sede_maestra();
  IF v_maestra IS NULL THEN
    RAISE EXCEPTION 'No existe sede maestra: no hay desde dónde crear iglesias'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_tipo = 'sede_madre' THEN
    RAISE EXCEPTION 'Ya existe una sede maestra. Una iglesia nueva nace como filial o plantación'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'Crear una iglesia exige alcance de organización (Pastor Director General)'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_nivel_pastor IS NULL OR p_nivel_pastor NOT BETWEEN 2 AND 4 THEN
    RAISE EXCEPTION 'El nivel del pastor va de N2 a N4.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT tipo_sede INTO v_tipo_pl FROM sistema.plantillas WHERE codigo = p_plantilla;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La plantilla «%» no existe.', p_plantilla USING ERRCODE = 'no_data_found';
  END IF;
  IF v_tipo_pl IS NOT NULL AND v_tipo_pl <> p_tipo AND p_plantilla <> 'MAESTRA' THEN
    RAISE EXCEPTION 'La plantilla «%» es para sedes de tipo «%» y la iglesia es «%». Elija una plantilla de su tipo o la MAESTRA.',
      p_plantilla, v_tipo_pl, p_tipo USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('app.motivo', 'Aprovisionamiento de ' || p_codigo, true);

  INSERT INTO org.sedes (codigo, nombre, tipo, pais, ciudad, sede_padre_id, ola_migracion)
  VALUES (p_codigo, p_nombre, p_tipo, p_pais, p_ciudad, v_maestra, p_ola)
  RETURNING id INTO v_sede;

  INSERT INTO sistema.modulos_sede (sede_id, modulo, activo, activado_por, activado_en)
  SELECT v_sede, pm.modulo, NOT m.exige_compuerta_legal,
         CASE WHEN NOT m.exige_compuerta_legal THEN v_actor END,
         CASE WHEN NOT m.exige_compuerta_legal THEN now() END
  FROM sistema.plantilla_modulos pm
  JOIN sistema.modulos m ON m.codigo = pm.modulo
  WHERE pm.plantilla = p_plantilla
  ORDER BY m.orden;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'La plantilla «%» no tiene módulos', p_plantilla USING ERRCODE = 'no_data_found';
  END IF;

  /* El nivel pedido nunca pasa del techo del rol: si la red todavía no
     subió el techo (o lo bajó), manda el techo. */
  SELECT LEAST(p_nivel_pastor, r.nivel_maximo) INTO v_nivel
    FROM identidad.roles r WHERE r.codigo = 'PASTOR_CONGREGACIONAL';

  INSERT INTO identidad.asignaciones
    (persona_id, rol, alcance_tipo, alcance_id, nivel_max, otorgado_por, acta_referencia)
  VALUES (p_pastor_id, 'PASTOR_CONGREGACIONAL', 'sede', v_sede, v_nivel, v_actor,
          'Aprovisionamiento de ' || p_codigo);

  INSERT INTO sistema.bitacora_aprovisionamiento (actor_id, accion, sede_id, detalle)
  VALUES (v_actor, 'sede_creada', v_sede,
          jsonb_build_object('codigo',p_codigo,'nombre',p_nombre,'tipo',p_tipo,
                             'plantilla',p_plantilla,'modulos',v_n,'pastor',p_pastor_id,
                             'nivel_pastor', v_nivel));
  RETURN v_sede;
END $$;
REVOKE ALL ON FUNCTION sistema.crear_iglesia(text, text, org.tipo_sede, character, text, text, uuid, smallint, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sistema.crear_iglesia(text, text, org.tipo_sede, character, text, text, uuid, smallint, smallint) TO casaroca_app;

COMMIT;
