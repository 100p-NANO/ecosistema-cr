-- =====================================================================
-- 0068 · UNA SOLA VERDAD SOBRE QUIÉN PUEDE QUÉ
--
-- ⛔ QUÉ ESTABA ROTO. Cuatro funciones responden «¿esta persona tiene
--    acceso?» y cada una leía una fuente distinta:
--
--      identidad.sedes_de        → personales + heredados de equipos, sin revocados
--      identidad.puede           → SOLO personales
--      identidad.nivel_max_de    → SOLO personales
--      identidad.es_global       → SOLO personales y SIN MIRAR la revocación
--      identidad.contexto_de     → «tiene acceso» SIN MIRAR la revocación
--
--    Dos consecuencias medidas en la auditoría del 20 de septiembre:
--    a) Meter a alguien en un equipo le abría las sedes del equipo y NO le
--       daba ni una de sus acciones. Roto en la dirección peligrosa:
--       ensanchaba el alcance sin conceder lo que se pretendía.
--    b) Revocar un rol de alcance de organización dejaba a la persona con
--       `es_global` en verdadero hasta la medianoche: la 0066 arregló
--       `puede` y `nivel_max_de` y se quedó corta en `es_global`.
--
--    Ahora las cuatro leen `identidad.v_permiso_efectivo`, que ya junta lo
--    personal y lo heredado y ya descarta lo revocado y lo vencido.
--
-- ⛔ Y cinco huecos de gobierno que encontraron los auditores:
--    1. Uno podía firmar SU PROPIA recertificación (el Director General
--       recertificó su propio N4 sobre toda la red).
--    2. «Se reduce» no reducía nada: solo reiniciaba el reloj.
--    3. «+ Crear un rol» era un UPSERT: escribir TESORERIA en el código
--       reescribía el rol de Tesorería de toda la red y decía «guardado».
--    4. Otorgar dos veces el mismo rol creaba dos filas; revocar una
--       dejaba la otra viva.
--    5. `alcance_id` no se comprobaba contra nada: se podía guardar el
--       identificador de una SEDE como alcance de tipo «grupo».
-- =====================================================================
BEGIN;

-- ── a · Las preguntas de acceso leen la MISMA fuente ─────────────────
CREATE OR REPLACE FUNCTION identidad.es_global(p_persona_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM identidad.v_permiso_efectivo pe
     WHERE pe.persona_id = p_persona_id
       AND pe.vigente                       -- ⛔ ya excluye lo revocado
       AND pe.alcance_tipo = 'organizacion');
$$;

CREATE OR REPLACE FUNCTION identidad.nivel_max_de(p_persona_id uuid)
RETURNS smallint
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
  SELECT COALESCE(MAX(pe.nivel_efectivo), 0)::smallint
    FROM identidad.v_permiso_efectivo pe
   WHERE pe.persona_id = p_persona_id AND pe.vigente;
$$;

CREATE OR REPLACE FUNCTION identidad.puede(p_persona uuid, p_modulo text, p_accion text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = identidad, sistema, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
      FROM identidad.v_permiso_efectivo pe
      JOIN identidad.roles r         ON r.codigo = pe.rol AND r.activo
      JOIN sistema.matriz_permisos p ON p.rol = pe.rol AND p.modulo = p_modulo
      JOIN sistema.modulos m         ON m.codigo = p.modulo
     WHERE pe.persona_id = p_persona
       AND pe.vigente                       -- personal o de equipo, sin revocados
       AND m.nivel_dato <= pe.nivel_efectivo
       AND p.accion IN ('administrar',
             COALESCE((SELECT x.accion FROM sistema.acciones_alias x WHERE x.alias = p_accion), p_accion))
  );
$$;

CREATE OR REPLACE FUNCTION identidad.contexto_de(p_persona_id uuid)
RETURNS TABLE(sedes uuid[], nivel_max smallint, es_global boolean, tiene_acceso boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
  SELECT identidad.sedes_de(p_persona_id),
         identidad.nivel_max_de(p_persona_id),
         identidad.es_global(p_persona_id),
         -- Sin ninguna asignación VIGENTE (personal o de equipo) no hay
         -- acceso. Antes contaba también la revocada esta mañana.
         EXISTS (SELECT 1 FROM identidad.v_permiso_efectivo pe
                  WHERE pe.persona_id = p_persona_id AND pe.vigente);
$$;

COMMENT ON FUNCTION identidad.puede(uuid, text, text) IS
  'Accion permitida por la matriz para roles VIGENTES, personales o heredados de un equipo. Misma fuente que sedes_de, nivel_max_de y es_global (0068).';

-- ── b · Por qué: el motivo viaja con la auditoría ────────────────────
--    Toda escritura auditada puede dejar su porqué: la función que la
--    hace fija `app.motivo` en la transacción y el disparador lo copia.
ALTER TABLE plataforma.auditoria ADD COLUMN IF NOT EXISTS motivo text;

/* El disparador de auditoría aprende dos cosas:
   · columnas que NO se copian (`-columna`): el hash de una contraseña o
     el secreto del segundo factor no pueden terminar en la bitácora,
     que se conserva años y la lee más gente que la tabla de cuentas;
   · la llave cuando la tabla no tiene `id` (`#columna`): en
     `sistema.modulos_sede` la fila es (sede, módulo), y sin esto
     `fila_id` quedaba vacío y la historia no se podía reconstruir. */
CREATE OR REPLACE FUNCTION plataforma.tg_auditar()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = plataforma, pg_temp AS $$
DECLARE
  v_id  text;
  v_ant jsonb;
  v_nue jsonb;
  v_op  char(1);
  v_arg text;
  v_fila jsonb;
  v_llave text[] := '{}';
BEGIN
  IF    TG_OP = 'INSERT' THEN v_op:='I'; v_nue:=to_jsonb(NEW); v_fila:=v_nue;
  ELSIF TG_OP = 'UPDATE' THEN v_op:='U'; v_ant:=to_jsonb(OLD); v_nue:=to_jsonb(NEW); v_fila:=v_nue;
  ELSE                        v_op:='D'; v_ant:=to_jsonb(OLD); v_fila:=v_ant;
  END IF;

  IF TG_NARGS > 0 THEN
    FOREACH v_arg IN ARRAY TG_ARGV LOOP
      IF left(v_arg, 1) = '-' THEN
        v_ant := v_ant - substr(v_arg, 2);
        v_nue := v_nue - substr(v_arg, 2);
      ELSIF left(v_arg, 1) = '#' THEN
        v_llave := v_llave || (v_fila ->> substr(v_arg, 2));
      END IF;
    END LOOP;
  END IF;

  v_id := COALESCE(v_fila ->> 'id',
                   NULLIF(array_to_string(v_llave, '/'), ''));

  /* Un UPDATE que no cambió nada de lo que se audita no es un hecho. */
  IF v_op = 'U' AND v_ant = v_nue THEN RETURN NULL; END IF;

  INSERT INTO plataforma.auditoria
    (esquema, tabla, fila_id, operacion, actor_id, actor_ip, valor_anterior, valor_nuevo, motivo)
  VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, v_id, v_op,
          plataforma.ctx_persona_id(),
          NULLIF(current_setting('app.ip', true), '')::inet,
          v_ant, v_nue,
          NULLIF(current_setting('app.motivo', true), ''));
  RETURN NULL;
END $$;

-- ── c · Recertificar: nadie se firma a sí mismo y «reducir» reduce ───
ALTER TABLE identidad.recertificaciones
  ADD COLUMN IF NOT EXISTS nivel_antes   smallint,
  ADD COLUMN IF NOT EXISTS nivel_despues smallint;

DROP FUNCTION IF EXISTS identidad.recertificar(uuid, text, text);
CREATE FUNCTION identidad.recertificar(
  p_asignacion  uuid,
  p_veredicto   text,
  p_nota        text,
  p_nivel_nuevo smallint DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = identidad, nucleo, plataforma, public, pg_temp AS $$
DECLARE
  v_a      identidad.asignaciones%ROWTYPE;
  v_quien  uuid := plataforma.ctx_persona_id();
  v_actual smallint;
BEGIN
  IF p_veredicto NOT IN ('se_mantiene', 'se_reduce', 'se_revoca') THEN
    RAISE EXCEPTION 'El veredicto tiene que ser «se_mantiene», «se_reduce» o «se_revoca».'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_nota IS NULL OR length(btrim(p_nota)) < 5 THEN
    RAISE EXCEPTION 'Escriba por qué se mantiene, se reduce o se quita el acceso: la revisión queda firmada con su nombre.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_a FROM identidad.asignaciones WHERE id = p_asignacion;
  IF v_a.id IS NULL THEN
    RAISE EXCEPTION 'No existe esa asignación.' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_a.revocada_en IS NOT NULL THEN
    RAISE EXCEPTION 'Ese acceso ya estaba revocado: no hay nada que recertificar.'
      USING ERRCODE = 'no_data_found';
  END IF;

  /* ⛔ 1 · Nadie revisa su propio acceso. Una recertificación firmada por
     el titular no es un control: es una firma en blanco. */
  IF v_a.persona_id = v_quien THEN
    RAISE EXCEPTION 'Nadie recertifica su propio acceso: la revisión la firma otra persona del comité.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM identidad.exigir_admin_de(v_a.persona_id);

  SELECT LEAST(v_a.nivel_max, r.nivel_maximo) INTO v_actual
    FROM identidad.roles r WHERE r.codigo = v_a.rol;

  /* ⛔ 2 · «Se reduce» exige decir A CUÁNTO, y se ejecuta. Antes el
     comité firmaba que a alguien le sobraba permiso, el contador se
     ponía en verde y el exceso seguía ahí otros 90 días. */
  IF p_veredicto = 'se_reduce' THEN
    IF p_nivel_nuevo IS NULL THEN
      RAISE EXCEPTION 'Diga a qué nivel se reduce: hoy tiene N%.', v_actual
        USING ERRCODE = 'check_violation';
    END IF;
    IF p_nivel_nuevo >= v_actual THEN
      RAISE EXCEPTION 'Reducir es bajar: hoy tiene N% y propone N%.', v_actual, p_nivel_nuevo
        USING ERRCODE = 'check_violation';
    END IF;
    IF p_nivel_nuevo < 0 THEN
      RAISE EXCEPTION 'El nivel mínimo es N0. Para quitar el acceso del todo, el veredicto es «se_revoca».'
        USING ERRCODE = 'check_violation';
    END IF;
    PERFORM set_config('app.motivo', 'Recertificación: ' || btrim(p_nota), true);
    UPDATE identidad.asignaciones SET nivel_max = p_nivel_nuevo WHERE id = p_asignacion;
  END IF;

  INSERT INTO identidad.recertificaciones
    (asignacion_id, revisada_en, revisada_por, veredicto, nota, nivel_antes, nivel_despues)
  VALUES (p_asignacion, now(), v_quien, p_veredicto, btrim(p_nota), v_actual,
          CASE p_veredicto WHEN 'se_reduce' THEN p_nivel_nuevo
                           WHEN 'se_revoca' THEN NULL
                           ELSE v_actual END);

  IF p_veredicto = 'se_revoca' THEN
    PERFORM identidad.revocar_asignacion(p_asignacion,
      'Revocado en la recertificación: ' || btrim(p_nota));
  END IF;

  RETURN jsonb_build_object('asignacion', p_asignacion, 'veredicto', p_veredicto,
                            'nivel_antes', v_actual,
                            'nivel_despues', CASE p_veredicto WHEN 'se_reduce' THEN p_nivel_nuevo
                                                              WHEN 'se_revoca' THEN NULL
                                                              ELSE v_actual END,
                            'revisada_por', v_quien, 'revisada_en', now());
END $$;
REVOKE ALL ON FUNCTION identidad.recertificar(uuid, text, text, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.recertificar(uuid, text, text, smallint) TO casaroca_app;

-- ── d · Crear un rol es una cosa y editarlo es otra ──────────────────
CREATE OR REPLACE FUNCTION identidad.crear_rol(
  p_codigo text, p_nombre text, p_alcance_maximo text,
  p_nivel_maximo smallint, p_descripcion text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = identidad, plataforma, pg_temp AS $$
DECLARE v_existe identidad.roles%ROWTYPE;
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  IF NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'Crear un rol afecta a toda la red: exige alcance de organización'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_codigo IS NULL OR p_codigo !~ '^[A-Z][A-Z0-9_]{2,39}$' THEN
    RAISE EXCEPTION 'El código del rol va en MAYÚSCULAS, sin espacios ni tildes, de 3 a 40 caracteres (por ejemplo LIDER_JOVENES). Es una llave, no un nombre.'
      USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_existe FROM identidad.roles WHERE codigo = p_codigo;
  IF v_existe.codigo IS NOT NULL THEN
    RAISE EXCEPTION 'Ya existe el rol «%» (%). Crear no reescribe: si quiere cambiarlo, ábralo y edítelo.',
      p_codigo, v_existe.nombre USING ERRCODE = 'unique_violation';
  END IF;
  IF p_descripcion IS NULL OR length(btrim(p_descripcion)) < 10 THEN
    RAISE EXCEPTION 'Escriba para qué sirve el rol «%»: al menos diez caracteres. Un rol sin propósito escrito no se puede auditar.', p_codigo
      USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO identidad.roles (codigo, nombre, alcance_maximo, nivel_maximo, descripcion, activo)
  VALUES (p_codigo, btrim(p_nombre), p_alcance_maximo::identidad.tipo_alcance,
          p_nivel_maximo, btrim(p_descripcion), true);
  RETURN p_codigo;
END $$;
REVOKE ALL ON FUNCTION identidad.crear_rol(text, text, text, smallint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.crear_rol(text, text, text, smallint, text) TO casaroca_app;

CREATE OR REPLACE FUNCTION identidad.guardar_rol(
  p_codigo text, p_nombre text, p_alcance_maximo text,
  p_nivel_maximo smallint, p_descripcion text DEFAULT NULL, p_activo boolean DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = identidad, plataforma, pg_temp AS $$
DECLARE
  v_bajando boolean; v_afectados int;
  v_existe  identidad.roles%ROWTYPE;
  v_desc    text; v_activo boolean;
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  IF NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'Cambiar un rol afecta a toda la red: exige alcance de organización'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_existe FROM identidad.roles r WHERE r.codigo = p_codigo;
  /* ⛔ Editar ya no crea. Antes era la misma puerta, y un código mal
     escrito en «editar» nacía como rol nuevo sin que nadie lo pidiera. */
  IF v_existe.codigo IS NULL THEN
    RAISE EXCEPTION 'No existe el rol «%». Para crearlo, use «Crear un rol».', p_codigo
      USING ERRCODE = 'no_data_found';
  END IF;

  v_desc := COALESCE(NULLIF(btrim(p_descripcion), ''), v_existe.descripcion);
  IF v_desc IS NULL OR length(v_desc) < 10 THEN
    RAISE EXCEPTION 'Escriba para qué sirve el rol «%»: al menos diez caracteres.', p_codigo
      USING ERRCODE = 'check_violation';
  END IF;
  v_activo := COALESCE(p_activo, v_existe.activo, true);
  v_bajando := v_existe.nivel_maximo > p_nivel_maximo;

  UPDATE identidad.roles
     SET nombre = COALESCE(NULLIF(btrim(p_nombre), ''), nombre),
         alcance_maximo = p_alcance_maximo::identidad.tipo_alcance,
         nivel_maximo = p_nivel_maximo,
         descripcion = v_desc,
         activo = v_activo
   WHERE codigo = p_codigo;

  IF v_bajando THEN
    SELECT count(*) INTO v_afectados FROM identidad.asignaciones a
     WHERE a.rol = p_codigo AND a.revocada_en IS NULL AND a.nivel_max > p_nivel_maximo;
    INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
    VALUES ('techo_de_rol_bajado', p_codigo,
            jsonb_build_object('nuevo_techo', p_nivel_maximo,
                               'asignaciones_por_encima', v_afectados,
                               'quien', plataforma.ctx_persona_id()));
  END IF;

  IF v_existe.activo AND NOT v_activo THEN
    SELECT count(*) INTO v_afectados FROM identidad.asignaciones a
     WHERE a.rol = p_codigo AND a.revocada_en IS NULL;
    INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
    VALUES ('rol_descontinuado', p_codigo,
            jsonb_build_object('personas_que_lo_tienen_puesto', v_afectados,
                               'quien', plataforma.ctx_persona_id()));
  END IF;

  RETURN p_codigo;
END $$;

-- ── e · La matriz: un rol descontinuado se VE, y no recibe permisos ──
DROP FUNCTION IF EXISTS sistema.ver_matriz(text);
CREATE FUNCTION sistema.ver_matriz(p_rol text DEFAULT NULL)
RETURNS TABLE(rol text, rol_nombre text, rol_techo smallint, rol_activo boolean,
              modulo text, modulo_nombre text, modulo_nivel smallint,
              accion text, accion_nombre text, marcado boolean,
              nivel_max smallint, acta_ref text, por_encima boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = sistema, identidad, public, pg_temp AS $$
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  RETURN QUERY
  SELECT r.codigo, r.nombre, r.nivel_maximo, r.activo,
         m.codigo, m.nombre, m.nivel_dato,
         a.codigo, a.nombre,
         (p.rol IS NOT NULL),
         p.nivel_max, p.acta_ref,
         (m.nivel_dato > r.nivel_maximo)
    FROM identidad.roles r
    CROSS JOIN sistema.modulos m
    JOIN sistema.acciones a ON a.modulo IS NULL OR a.modulo = m.codigo
    LEFT JOIN sistema.matriz_permisos p
           ON p.rol = r.codigo AND p.modulo = m.codigo AND p.accion = a.codigo
   /* ⛔ Antes filtraba `AND r.activo`: un rol descontinuado enseñaba la
      matriz EN BLANCO aunque tuviera permisos y personas con él puesto.
      Un auditor que abre ese rol tiene que ver lo que todavía concede. */
   WHERE (p_rol IS NULL OR r.codigo = p_rol)
   ORDER BY r.activo DESC, r.nombre, m.orden, a.orden;
END $$;
REVOKE ALL ON FUNCTION sistema.ver_matriz(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sistema.ver_matriz(text) TO casaroca_app;

DROP FUNCTION IF EXISTS sistema.marcar_permiso(text, text, text, boolean, smallint, text);
CREATE FUNCTION sistema.marcar_permiso(
  p_rol text, p_modulo text, p_accion text, p_marcado boolean,
  p_nivel_max smallint DEFAULT NULL, p_acta text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = sistema, identidad, plataforma, public, pg_temp AS $$
DECLARE
  v_rol   identidad.roles%ROWTYPE;
  v_antes boolean;
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  IF NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'La matriz de permisos es de toda la red: exige alcance de organización'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  /* ⛔ Cambiar quién puede qué es la primera pregunta de una auditoría de
     accesos. Sin un porqué escrito, el cambio no se hace. */
  IF p_acta IS NULL OR length(btrim(p_acta)) < 4 THEN
    RAISE EXCEPTION 'Escriba el acta o el motivo del cambio en la matriz: queda en la auditoría con su nombre.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_rol FROM identidad.roles WHERE codigo = p_rol;
  IF v_rol.codigo IS NULL THEN
    RAISE EXCEPTION 'No existe el rol «%».', p_rol USING ERRCODE = 'no_data_found';
  END IF;

  SELECT EXISTS (SELECT 1 FROM sistema.matriz_permisos
                  WHERE rol = p_rol AND modulo = p_modulo AND accion = p_accion)
    INTO v_antes;

  PERFORM set_config('app.motivo', btrim(p_acta), true);

  IF NOT p_marcado THEN
    IF NOT v_antes THEN
      RETURN jsonb_build_object('marcado', false, 'cambio', false,
        'mensaje', 'Ese permiso no estaba marcado: no había nada que quitar.');
    END IF;
    DELETE FROM sistema.matriz_permisos
     WHERE rol = p_rol AND modulo = p_modulo AND accion = p_accion;
    RETURN jsonb_build_object('marcado', false, 'cambio', true,
      'mensaje', 'Permiso quitado. Queda en la auditoría con su motivo.');
  END IF;

  IF NOT v_rol.activo THEN
    RAISE EXCEPTION 'El rol «%» está descontinuado: no recibe permisos nuevos. Reactívelo primero si de verdad hace falta.', p_rol
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO sistema.matriz_permisos (rol, modulo, accion, nivel_max, acta_ref)
  VALUES (p_rol, p_modulo, p_accion, COALESCE(p_nivel_max, v_rol.nivel_maximo), btrim(p_acta))
  ON CONFLICT (rol, modulo, accion) DO UPDATE
    SET nivel_max = EXCLUDED.nivel_max, acta_ref = EXCLUDED.acta_ref;
  RETURN jsonb_build_object('marcado', true, 'cambio', NOT v_antes,
    'mensaje', CASE WHEN v_antes THEN 'Ese permiso ya estaba marcado: se actualizó su acta.'
                    ELSE 'Permiso otorgado. Queda en la auditoría con su acta.' END);
END $$;
REVOKE ALL ON FUNCTION sistema.marcar_permiso(text, text, text, boolean, smallint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sistema.marcar_permiso(text, text, text, boolean, smallint, text) TO casaroca_app;

-- ── f · El alcance apunta a algo que existe, y del tipo que dice ─────
CREATE OR REPLACE FUNCTION identidad.tg_alcance_existe()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = identidad, org, grupos, pg_temp AS $$
DECLARE v_ok boolean;
BEGIN
  CASE NEW.alcance_tipo::text
    WHEN 'organizacion', 'persona_propia', 'caso_propio' THEN
      IF NEW.alcance_id IS NOT NULL THEN
        RAISE EXCEPTION 'El alcance «%» no apunta a nada concreto: no lleva identificador.', NEW.alcance_tipo
          USING ERRCODE = 'check_violation';
      END IF;
      RETURN NEW;
    WHEN 'sede'       THEN SELECT EXISTS (SELECT 1 FROM org.sedes       WHERE id = NEW.alcance_id) INTO v_ok;
    WHEN 'unidad'     THEN SELECT EXISTS (SELECT 1 FROM org.unidades    WHERE id = NEW.alcance_id) INTO v_ok;
    WHEN 'segmento'   THEN SELECT EXISTS (SELECT 1 FROM org.segmentos   WHERE id = NEW.alcance_id) INTO v_ok;
    WHEN 'ministerio' THEN SELECT EXISTS (SELECT 1 FROM org.ministerios WHERE id = NEW.alcance_id) INTO v_ok;
    WHEN 'grupo'      THEN SELECT EXISTS (SELECT 1 FROM grupos.grupos   WHERE id = NEW.alcance_id) INTO v_ok;
    ELSE v_ok := false;
  END CASE;
  IF NEW.alcance_id IS NULL THEN
    RAISE EXCEPTION 'El alcance «%» necesita decir cuál: falta el identificador.', NEW.alcance_tipo
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'El alcance no existe como «%»: el identificador apunta a otra cosa o a nada.', NEW.alcance_tipo
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_alcance_existe ON identidad.asignaciones;
CREATE TRIGGER trg_alcance_existe
  BEFORE INSERT OR UPDATE OF alcance_tipo, alcance_id ON identidad.asignaciones
  FOR EACH ROW EXECUTE FUNCTION identidad.tg_alcance_existe();
DROP TRIGGER IF EXISTS trg_alcance_existe ON identidad.asignaciones_unidad;
CREATE TRIGGER trg_alcance_existe
  BEFORE INSERT OR UPDATE OF alcance_tipo, alcance_id ON identidad.asignaciones_unidad
  FOR EACH ROW EXECUTE FUNCTION identidad.tg_alcance_existe();

-- ── g · El mismo rol, con el mismo alcance, una sola vez ─────────────
/* Lo que ya estuviera repetido se revoca dejando el más antiguo, con el
   motivo escrito. En una base nueva no hay nada que revocar. */
WITH d AS (
  SELECT id, row_number() OVER (
           PARTITION BY persona_id, rol, alcance_tipo, alcance_id
           ORDER BY creado_en, id) AS n
    FROM identidad.asignaciones
   WHERE revocada_en IS NULL AND vigente_hasta IS NULL)
UPDATE identidad.asignaciones a
   SET revocada_en = now(), vigente_hasta = CURRENT_DATE,
       motivo_revocacion = 'Asignación repetida: se conserva la más antigua (migración 0068).'
  FROM d WHERE d.id = a.id AND d.n > 1;

WITH d AS (
  SELECT id, row_number() OVER (
           PARTITION BY unidad_id, rol, alcance_tipo, alcance_id
           ORDER BY creado_en, id) AS n
    FROM identidad.asignaciones_unidad
   WHERE revocada_en IS NULL AND vigente_hasta IS NULL)
UPDATE identidad.asignaciones_unidad a
   SET revocada_en = now(), vigente_hasta = CURRENT_DATE,
       motivo_revocacion = 'Asignación repetida: se conserva la más antigua (migración 0068).'
  FROM d WHERE d.id = a.id AND d.n > 1;

CREATE UNIQUE INDEX IF NOT EXISTS asignaciones_abierta_unica
  ON identidad.asignaciones (persona_id, rol, alcance_tipo,
     COALESCE(alcance_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE revocada_en IS NULL AND vigente_hasta IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS asignaciones_unidad_abierta_unica
  ON identidad.asignaciones_unidad (unidad_id, rol, alcance_tipo,
     COALESCE(alcance_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE revocada_en IS NULL AND vigente_hasta IS NULL;

/* El índice cubre lo abierto. Lo que tiene fecha de fin lo cubre la
   función: si ya hay uno VIGENTE igual, se dice en vez de duplicar. */
CREATE OR REPLACE FUNCTION identidad.otorgar_asignacion(
  p_persona   uuid,
  p_rol       text,
  p_alcance   text,
  p_alcance_id uuid,
  p_nivel_max smallint,
  p_acta      text,
  p_desde     date DEFAULT NULL,
  p_hasta     date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = identidad, nucleo, sistema, plataforma, public, pg_temp AS $$
DECLARE
  v_rol   identidad.roles%ROWTYPE;
  v_techo smallint;
  v_id    uuid;
  v_ya    uuid;
  v_quien uuid := plataforma.ctx_persona_id();
  v_alc   identidad.tipo_alcance;
BEGIN
  SELECT * INTO v_rol FROM identidad.roles WHERE codigo = p_rol;
  IF v_rol.codigo IS NULL THEN
    RAISE EXCEPTION 'No existe el rol «%».', p_rol USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT v_rol.activo THEN
    RAISE EXCEPTION 'El rol «%» está descontinuado: no se puede otorgar.', p_rol
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_acta IS NULL OR length(btrim(p_acta)) < 4 THEN
    RAISE EXCEPTION 'Falta el acta que autoriza el rol. Un permiso sin constancia de quién lo autorizó no se otorga.'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM identidad.exigir_admin_de(p_persona);

  v_alc := COALESCE(p_alcance, v_rol.alcance_maximo::text)::identidad.tipo_alcance;

  SELECT a.id INTO v_ya FROM identidad.asignaciones a
   WHERE a.persona_id = p_persona AND a.rol = p_rol AND a.alcance_tipo = v_alc
     AND a.alcance_id IS NOT DISTINCT FROM p_alcance_id
     AND a.revocada_en IS NULL
     AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
   LIMIT 1;
  IF v_ya IS NOT NULL THEN
    RAISE EXCEPTION 'Esa persona ya tiene el rol «%» con ese mismo alcance, vigente. No se duplica: si hay que cambiar el nivel o la fecha, revoque el actual y otorgue de nuevo.', p_rol
      USING ERRCODE = 'unique_violation';
  END IF;

  v_techo := LEAST(COALESCE(p_nivel_max, v_rol.nivel_maximo), v_rol.nivel_maximo);
  IF v_techo > plataforma.ctx_nivel_max() THEN
    RAISE EXCEPTION 'No puede otorgar nivel N%: su propio techo es N%.',
      v_techo, plataforma.ctx_nivel_max() USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM set_config('app.motivo', 'Acta: ' || btrim(p_acta), true);
  INSERT INTO identidad.asignaciones
    (persona_id, rol, alcance_tipo, alcance_id, nivel_max,
     vigente_desde, vigente_hasta, otorgado_por, acta_referencia)
  VALUES (p_persona, p_rol, v_alc, p_alcance_id, v_techo,
          COALESCE(p_desde, CURRENT_DATE), p_hasta, v_quien, btrim(p_acta))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'rol', p_rol, 'nivel_max', v_techo,
                            'alcance_tipo', v_alc, 'otorgado_por', v_quien);
END $$;

-- ── h · Sacar de un equipo deja QUIÉN, aunque no se lo pasen ─────────
CREATE OR REPLACE FUNCTION org.sacar_del_equipo(p_unidad uuid, p_persona uuid, p_motivo text, p_quien uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SET search_path = org, plataforma, pg_temp AS $$
DECLARE v int;
BEGIN
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Sacar a alguien de un equipo exige un motivo escrito' USING ERRCODE='check_violation';
  END IF;
  PERFORM set_config('app.motivo', btrim(p_motivo), true);
  UPDATE org.unidad_miembros
     SET revocado_en = now(),
         revocado_por = COALESCE(p_quien, plataforma.ctx_persona_id()),
         hasta = GREATEST(CURRENT_DATE, desde),
         motivo_salida = p_motivo
   WHERE unidad_id = p_unidad AND persona_id = p_persona
     AND hasta IS NULL AND revocado_en IS NULL;
  GET DIAGNOSTICS v = ROW_COUNT;
  IF v = 0 THEN
    RAISE EXCEPTION 'Esa persona no está vigente en ese equipo, o el equipo no está en su alcance.' USING ERRCODE='no_data_found';
  END IF;
  RETURN v;
END $$;

-- ── i · Cerrarle la sesión a alguien queda en la auditoría ───────────
CREATE OR REPLACE FUNCTION identidad.cerrar_sesion_de_otro(p_sesion uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = identidad, plataforma, public, pg_temp AS $$
DECLARE
  v_s       identidad.sesiones%ROWTYPE;
  v_persona uuid;
  v_quien   uuid := plataforma.ctx_persona_id();
BEGIN
  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Cerrarle la sesión a otra persona exige un motivo escrito: queda en la auditoría.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_s FROM identidad.sesiones WHERE id = p_sesion;
  IF v_s.id IS NULL THEN
    RAISE EXCEPTION 'No existe esa sesión.' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_s.revocada_en IS NOT NULL THEN
    RAISE EXCEPTION 'Esa sesión ya estaba cerrada.' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT c.persona_id INTO v_persona FROM identidad.cuentas c WHERE c.id = v_s.cuenta_id;
  PERFORM identidad.exigir_admin_de(v_persona);

  UPDATE identidad.sesiones
     SET revocada_en = now(),
         motivo_revocacion = 'Cerrada por la administración: ' || btrim(p_motivo)
   WHERE id = p_sesion;

  /* ⛔ El diálogo decía «Motivo · queda en la auditoría» y el motivo iba a
     una columna que ninguna pantalla enseña. Ahora va a la auditoría. */
  INSERT INTO plataforma.auditoria
    (esquema, tabla, fila_id, operacion, actor_id, actor_ip, valor_anterior, valor_nuevo, motivo)
  VALUES ('identidad', 'sesiones', p_sesion::text, 'U', v_quien,
          NULLIF(current_setting('app.ip', true), '')::inet,
          jsonb_build_object('revocada_en', NULL, 'persona_id', v_persona),
          jsonb_build_object('revocada_en', now(), 'persona_id', v_persona, 'accion', 'cierre_por_administracion'),
          btrim(p_motivo));

  RETURN jsonb_build_object('sesion', p_sesion, 'persona_id', v_persona,
                            'cerrada_por', v_quien, 'motivo', btrim(p_motivo));
END $$;

COMMIT;
