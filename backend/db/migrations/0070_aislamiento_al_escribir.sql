-- =====================================================================
-- 0070 · EL AISLAMIENTO TAMBIÉN AL ESCRIBIR
--
-- ⛔ QUÉ ESTABA ROTO. La auditoría del 20 de septiembre lo resumió así:
--    «la LECTURA aguanta; la ESCRITURA no». Las políticas de las tablas
--    hijas heredaban SOLO del padre: comprobaban que el GRUPO o el
--    SERVICIO fuera de la sede de quien escribe, nunca que la PERSONA lo
--    fuera. Con el token del pastor de Chía se agregó a Ana Rojas (de
--    Bogotá Chicó) a un grupo de Chía y se la marcó presente en un
--    servicio. Dos hechos en la historia pastoral de Ana que su propio
--    pastor lee sin saber quién los puso.
--
--    Y lo mismo en la salvaguarda de menores: el pastor de Panamá
--    registró los cinco antecedentes de un voluntario de Bogotá
--    SELLÁNDOLOS CON SU PROPIA SEDE. El aviso rojo de Bogotá desapareció
--    y el voluntario quedó apto para estar con niños.
--
-- ⛔ Y dos puertas que no abrían para nadie:
--    · «¿va a estar con menores?» se rechazaba SIEMPRE: la regla exige una
--      fecha de verificación de antecedentes que nadie escribía.
--    · «Agregar un valor» a un catálogo fallaba incluso para el Director
--      General: la aplicación solo lee esa tabla y la función no corría
--      con sus propios permisos.
--
-- ⛔ Y una que no existía: el interruptor de módulos por sede no se
--    consultaba en ninguna parte. Aquí nace la función que lo responde;
--    la API la aplica a cada ruta de módulo.
-- =====================================================================
BEGIN;

-- ── a · Grupos y asistencia: la PERSONA también tiene que ser suya ───
/* La subconsulta corre con el RLS de quien escribe: si no puede VER a la
   persona, no puede escribir sobre ella. Global la ve toda; un pastor de
   sede, solo a su gente. */
DROP POLICY IF EXISTS grupos_membresias_ins ON grupos.membresias;
CREATE POLICY grupos_membresias_ins ON grupos.membresias FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM grupos.grupos p WHERE p.id = membresias.grupo_id)
          AND EXISTS (SELECT 1 FROM nucleo.personas pe WHERE pe.id = membresias.persona_id));

DROP POLICY IF EXISTS grupos_membresias_upd ON grupos.membresias;
CREATE POLICY grupos_membresias_upd ON grupos.membresias FOR UPDATE
  USING (EXISTS (SELECT 1 FROM grupos.grupos p WHERE p.id = membresias.grupo_id))
  WITH CHECK (EXISTS (SELECT 1 FROM grupos.grupos p WHERE p.id = membresias.grupo_id)
          AND EXISTS (SELECT 1 FROM nucleo.personas pe WHERE pe.id = membresias.persona_id));

DROP POLICY IF EXISTS asistencia_entradas_ins ON asistencia.entradas;
CREATE POLICY asistencia_entradas_ins ON asistencia.entradas FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM asistencia.servicios p WHERE p.id = entradas.servicio_id)
          AND (entradas.persona_id IS NULL
               OR EXISTS (SELECT 1 FROM nucleo.personas pe WHERE pe.id = entradas.persona_id)));

DROP POLICY IF EXISTS asistencia_entradas_upd ON asistencia.entradas;
CREATE POLICY asistencia_entradas_upd ON asistencia.entradas FOR UPDATE
  USING (EXISTS (SELECT 1 FROM asistencia.servicios p WHERE p.id = entradas.servicio_id))
  WITH CHECK (EXISTS (SELECT 1 FROM asistencia.servicios p WHERE p.id = entradas.servicio_id)
          AND (entradas.persona_id IS NULL
               OR EXISTS (SELECT 1 FROM nucleo.personas pe WHERE pe.id = entradas.persona_id)));

-- ── b · Un antecedente es de la sede de la PERSONA, no de quien lo escribe ─
CREATE OR REPLACE FUNCTION talento.tg_antecedente_sede_de_la_persona()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = talento, nucleo, plataforma, pg_temp AS $$
DECLARE v_sede uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.persona_id <> OLD.persona_id OR NEW.sede_id <> OLD.sede_id) THEN
    RAISE EXCEPTION 'Un antecedente no cambia de persona ni de sede: se registra uno nuevo.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'INSERT' THEN
    /* ⛔ Se IGNORA la sede que mande el formulario. Antes, el pastor de
       Panamá sellaba con Panamá los antecedentes de un voluntario de
       Bogotá: la política los dejaba pasar porque Panamá sí era suya. */
    SELECT p.sede_id INTO v_sede FROM nucleo.personas p WHERE p.id = NEW.persona_id;
    IF v_sede IS NULL THEN
      RAISE EXCEPTION 'No se encuentra a esa persona.' USING ERRCODE = 'no_data_found';
    END IF;
    NEW.sede_id := v_sede;
    NEW.verificado_por := COALESCE(NEW.verificado_por, plataforma.ctx_persona_id());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_antecedente_sede ON talento.antecedentes;
CREATE TRIGGER trg_antecedente_sede BEFORE INSERT OR UPDATE ON talento.antecedentes
  FOR EACH ROW EXECUTE FUNCTION talento.tg_antecedente_sede_de_la_persona();
-- La política `antecedentes_ins` (sede_visible(sede_id)) ahora compara
-- contra la sede de la persona: quien no ve esa sede, no escribe.

-- ── c · «Va a estar con menores»: la base sella la verificación ──────
/* La regla exige `antecedentes_verificados_en`, y nadie la escribía: el
   voluntariado con menores se rechazaba SIEMPRE, incluso con los cinco
   antecedentes vigentes. Si están completos, se sella hoy; si falta
   alguno, se dice cuál. Se llama «trg_a_…» para correr ANTES de la regla
   (los disparadores BEFORE se ejecutan por orden de nombre). */
CREATE OR REPLACE FUNCTION talento.tg_sellar_verificacion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = talento, identidad, pg_temp AS $$
DECLARE v_falta text;
BEGIN
  IF NEW.trabaja_con_menores AND NEW.estado = 'activo'
     AND (NEW.antecedentes_verificados_en IS NULL
          OR NEW.antecedentes_verificados_en < CURRENT_DATE - interval '2 years') THEN
    v_falta := identidad.falta_de_antecedentes(NEW.persona_id);
    IF v_falta IS NOT NULL THEN
      RAISE EXCEPTION 'No puede servir con menores todavía: le falta %. Registre esos antecedentes como aptos y vigentes y vuelva a marcarlo.', v_falta
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.antecedentes_verificados_en := CURRENT_DATE;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_a_sellar_verificacion ON talento.voluntariados;
CREATE TRIGGER trg_a_sellar_verificacion BEFORE INSERT OR UPDATE ON talento.voluntariados
  FOR EACH ROW EXECUTE FUNCTION talento.tg_sellar_verificacion();

-- ── d · Ampliar un catálogo: por una puerta con guardia ──────────────
CREATE OR REPLACE FUNCTION sistema.agregar_valor(
  p_catalogo text, p_codigo text, p_etiqueta text, p_descripcion text DEFAULT NULL,
  p_orden smallint DEFAULT 100, p_sede uuid DEFAULT NULL, p_quien uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = sistema, plataforma, pg_temp AS $$
DECLARE v_cerrado boolean; v_motivo text; v_por_sede boolean;
BEGIN
  SELECT cerrado, motivo_cerrado, editable_por_sede
    INTO v_cerrado, v_motivo, v_por_sede
  FROM sistema.catalogos WHERE codigo = p_catalogo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el catálogo «%»', p_catalogo USING ERRCODE='no_data_found';
  END IF;
  /* ⛔ La guardia vive AQUÍ, no solo en la ruta: la función ahora escribe
     con sus propios permisos, así que ella decide quién puede. */
  IF plataforma.ctx_persona_id() IS NULL THEN
    RAISE EXCEPTION 'No hay sesión: un catálogo no se amplía sin identidad' USING ERRCODE='insufficient_privilege';
  END IF;
  IF p_sede IS NULL AND NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'Ampliar un catálogo de toda la red exige alcance de organización.'
      USING ERRCODE='insufficient_privilege';
  END IF;
  IF p_sede IS NOT NULL AND NOT plataforma.sede_visible(p_sede) THEN
    RAISE EXCEPTION 'Esa sede no está en su alcance.' USING ERRCODE='insufficient_privilege';
  END IF;
  IF v_cerrado THEN
    RAISE EXCEPTION 'El catálogo «%» está cerrado a propósito: %', p_catalogo, v_motivo
      USING ERRCODE='check_violation';
  END IF;
  IF p_sede IS NOT NULL AND NOT v_por_sede THEN
    RAISE EXCEPTION 'El catálogo «%» es de la red: sus valores no son de una sola sede', p_catalogo
      USING ERRCODE='check_violation';
  END IF;
  IF p_codigo !~ '^[A-Za-z0-9_]{2,40}$' THEN
    RAISE EXCEPTION 'El código «%» debe ser corto y sin espacios ni tildes: es una llave, no una etiqueta', p_codigo
      USING ERRCODE='check_violation';
  END IF;
  IF p_etiqueta IS NULL OR length(btrim(p_etiqueta)) < 2 THEN
    RAISE EXCEPTION 'Falta la etiqueta: es lo que la gente ve en la lista.' USING ERRCODE='check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM sistema.catalogo_valores WHERE catalogo = p_catalogo AND codigo = p_codigo) THEN
    RAISE EXCEPTION 'El catálogo «%» ya tiene el valor «%». Si fue retirado, no se reutiliza: elija otro código.', p_catalogo, p_codigo
      USING ERRCODE='unique_violation';
  END IF;

  INSERT INTO sistema.catalogo_valores (catalogo, codigo, etiqueta, descripcion, orden, sede_id, creado_por)
  VALUES (p_catalogo, p_codigo, btrim(p_etiqueta), p_descripcion, p_orden, p_sede,
          COALESCE(p_quien, plataforma.ctx_persona_id()));
END $$;
REVOKE ALL ON FUNCTION sistema.agregar_valor(text, text, text, text, smallint, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sistema.agregar_valor(text, text, text, text, smallint, uuid, uuid) TO casaroca_app;

CREATE OR REPLACE FUNCTION sistema.retirar_valor(p_catalogo text, p_codigo text, p_motivo text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = sistema, plataforma, pg_temp AS $$
DECLARE v_sede uuid;
BEGIN
  IF plataforma.ctx_persona_id() IS NULL THEN
    RAISE EXCEPTION 'No hay sesión.' USING ERRCODE='insufficient_privilege';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Retirar un valor de catálogo exige un motivo escrito' USING ERRCODE='check_violation';
  END IF;
  SELECT sede_id INTO v_sede FROM sistema.catalogo_valores
   WHERE catalogo = p_catalogo AND codigo = p_codigo AND vigente;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El valor % de % no existe o ya estaba retirado', p_codigo, p_catalogo USING ERRCODE='no_data_found';
  END IF;
  IF v_sede IS NULL AND NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'Retirar un valor de la red exige alcance de organización.' USING ERRCODE='insufficient_privilege';
  END IF;
  IF v_sede IS NOT NULL AND NOT plataforma.sede_visible(v_sede) THEN
    RAISE EXCEPTION 'Ese valor es de una sede que no está en su alcance.' USING ERRCODE='insufficient_privilege';
  END IF;
  PERFORM set_config('app.motivo', btrim(p_motivo), true);
  UPDATE sistema.catalogo_valores
     SET vigente = false, retirado_en = now(), motivo_retiro = p_motivo
   WHERE catalogo = p_catalogo AND codigo = p_codigo AND vigente;
END $$;
REVOKE ALL ON FUNCTION sistema.retirar_valor(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sistema.retirar_valor(text, text, text) TO casaroca_app;

-- ── e · Qué módulos están encendidos, por sede ───────────────────────
/* ⛔ La consola dejaba apagar RocaKids en Panamá y el pastor de Panamá
   seguía viendo la pestaña, entraba y se le ofrecían salas de otra sede:
   `sistema.modulos_sede` no se consultaba en ninguna parte fuera de la
   consola. Esta función es la única respuesta, y la API la aplica al
   abrir la transacción de cada módulo: la sede con el módulo apagado
   sale del contexto, y el RLS hace el resto. Los módulos de núcleo no
   se apagan. */
CREATE OR REPLACE FUNCTION sistema.sedes_con_modulo(p_modulo text)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = sistema, org, pg_temp AS $$
  SELECT COALESCE(array_agg(s.id), '{}'::uuid[])
    FROM org.sedes s
    JOIN sistema.modulos m ON m.codigo = p_modulo
   WHERE s.activa
     AND (m.es_nucleo
          OR EXISTS (SELECT 1 FROM sistema.modulos_sede ms
                      WHERE ms.sede_id = s.id AND ms.modulo = p_modulo AND ms.activo));
$$;
REVOKE ALL ON FUNCTION sistema.sedes_con_modulo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sistema.sedes_con_modulo(text) TO casaroca_app;

/* Para pintar las pestañas: qué módulos están encendidos en AL MENOS una
   de las sedes que la persona alcanza. */
CREATE OR REPLACE FUNCTION sistema.modulos_encendidos(p_sedes uuid[], p_global boolean)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = sistema, org, pg_temp AS $$
  SELECT COALESCE(array_agg(m.codigo ORDER BY m.orden), '{}'::text[])
    FROM sistema.modulos m
   WHERE m.es_nucleo
      OR EXISTS (SELECT 1 FROM sistema.modulos_sede ms
                   JOIN org.sedes s ON s.id = ms.sede_id AND s.activa
                  WHERE ms.modulo = m.codigo AND ms.activo
                    AND (p_global OR ms.sede_id = ANY (p_sedes)));
$$;
REVOKE ALL ON FUNCTION sistema.modulos_encendidos(uuid[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sistema.modulos_encendidos(uuid[], boolean) TO casaroca_app;

-- ── f2 · «Quién soy y qué alcanzo», con la misma fuente que el permiso ─
/* ⛔ `/sesion/yo` leía las asignaciones PERSONALES sin mirar la revocación:
   pintaba como vigente un rol revocado esta mañana, no mostraba los que
   llegan por un equipo, y las pestañas no sabían del interruptor por sede.
   Ahora las dos preguntas salen de `v_permiso_efectivo`, igual que el
   permiso real, y los módulos se cruzan con lo encendido. */
CREATE OR REPLACE FUNCTION identidad.mis_accesos()
RETURNS TABLE(rol text, rol_nombre text, alcance_tipo text, alcance_id uuid,
              nivel_max smallint, origen text, equipo text,
              sede_nombre text, sede_codigo text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = identidad, org, plataforma, pg_temp AS $$
  SELECT pe.rol, r.nombre, pe.alcance_tipo::text, pe.alcance_id,
         pe.nivel_efectivo::smallint, pe.origen, u.nombre, s.nombre, s.codigo
    FROM identidad.v_permiso_efectivo pe
    JOIN identidad.roles r ON r.codigo = pe.rol
    LEFT JOIN org.unidades u ON u.id = pe.unidad_id
    LEFT JOIN org.sedes s ON pe.alcance_tipo = 'sede' AND s.id = pe.alcance_id
   WHERE pe.persona_id = plataforma.ctx_persona_id() AND pe.vigente
   ORDER BY pe.nivel_efectivo DESC, r.nombre;
$$;
REVOKE ALL ON FUNCTION identidad.mis_accesos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.mis_accesos() TO casaroca_app;

CREATE OR REPLACE FUNCTION identidad.mis_modulos()
RETURNS TABLE(modulo text, nombre text, nivel_dato smallint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = identidad, sistema, plataforma, pg_temp AS $$
  SELECT DISTINCT m.codigo, m.nombre, m.nivel_dato
    FROM identidad.v_permiso_efectivo pe
    JOIN identidad.roles r         ON r.codigo = pe.rol AND r.activo
    JOIN sistema.matriz_permisos p ON p.rol = pe.rol
    JOIN sistema.modulos m         ON m.codigo = p.modulo
   WHERE pe.persona_id = plataforma.ctx_persona_id() AND pe.vigente
     AND m.nivel_dato <= pe.nivel_efectivo
     AND m.codigo = ANY (sistema.modulos_encendidos(plataforma.ctx_sede_ids(), plataforma.ctx_es_global()))
   ORDER BY m.codigo;
$$;
REVOKE ALL ON FUNCTION identidad.mis_modulos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.mis_modulos() TO casaroca_app;

-- ── f · El consejero asignado ve el nombre de su consultante ─────────
/* ⛔ El modelo permite a propósito que un consejero especialista
   acompañe a alguien de OTRA sede. Pero la pantalla unía el caso con
   `nucleo.v_personas`, que filtra por sede: el caso desaparecía y el
   consejero leía «ese caso no existe». El nombre sale por aquí, solo si
   el caso es visible para quien pregunta. */
CREATE OR REPLACE FUNCTION consejeria.nombre_consultante(p_caso uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = consejeria, nucleo, pg_temp AS $$
  SELECT p.nombre_completo
    FROM consejeria.casos c
    JOIN nucleo.v_personas p ON p.id = c.consultante_id
   WHERE c.id = p_caso AND consejeria.caso_visible(p_caso);
$$;
REVOKE ALL ON FUNCTION consejeria.nombre_consultante(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consejeria.nombre_consultante(uuid) TO casaroca_app;

COMMIT;
