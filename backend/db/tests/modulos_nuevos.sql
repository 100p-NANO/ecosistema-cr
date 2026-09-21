-- =====================================================================
-- Banco: LOS DIEZ MÓDULOS QUE SOLO TENÍAN NOMBRE (migración 0074)
--
-- ⛔ Por qué existe. Oración, legal, comunicaciones y los otros siete
--    nacieron el 21 de septiembre. Un módulo nuevo es donde se cuela la
--    fuga que nadie busca: la petición confidencial que ve el intercesor,
--    el envío masivo que su propio autor aprueba, la nota legal que se
--    edita después, la alergia que la purga borra aunque el niño siga
--    viniendo. Cada una tiene aquí su prueba.
--
--    Los sujetos (sedes, personas, roles) se crean aquí y todo corre en
--    UNA transacción que se deshace al final.
-- =====================================================================
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE m_res(n int, caso text, esperado text, obtenido text, pasa boolean) ON COMMIT DROP;
CREATE FUNCTION pg_temp.rg(a int, b text, c text, d text, e boolean) RETURNS void
LANGUAGE sql AS $$ INSERT INTO m_res VALUES (a,b,c,d,e) $$;
CREATE TEMP TABLE mlab(k text PRIMARY KEY, v uuid) ON COMMIT DROP;
GRANT SELECT ON mlab TO casaroca_app;

/* Una sesión de la aplicación, como la arma la API. */
CREATE FUNCTION pg_temp.como(p uuid, sedes uuid[], nivel int, global boolean) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('app.persona_id', COALESCE(p::text, ''), true);
  PERFORM set_config('app.sede_ids', '{' || array_to_string(sedes, ',') || '}', true);
  PERFORM set_config('app.nivel_max', nivel::text, true);
  PERFORM set_config('app.alcance_global', global::text, true);
END $$;
CREATE FUNCTION pg_temp.lab(k text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT v FROM mlab WHERE mlab.k = $1 $$;

-- ── Sujetos de laboratorio ───────────────────────────────────────────
DO $$
DECLARE a uuid; b uuid; dg uuid; p1 uuid; p2 uuid; pb uuid; ora uuid; m1 uuid; m2 uuid; g uuid; gb uuid;
        v_tipo text; v_rol text;
BEGIN
  SELECT id INTO a FROM org.sedes WHERE codigo = 'CHIA';
  SELECT id INTO b FROM org.sedes WHERE codigo = 'MED';
  SELECT persona_id INTO dg FROM identidad.asignaciones
   WHERE rol = 'PASTOR_DIRECTOR_GENERAL' AND alcance_tipo = 'organizacion' AND revocada_en IS NULL LIMIT 1;
  IF a IS NULL OR b IS NULL OR dg IS NULL THEN
    RAISE EXCEPTION 'Sujetos agotados: faltan las sedes CHIA/MED o un Pastor Director General. El banco no puede probar nada.';
  END IF;
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido) VALUES (a, 'Pastora', 'Lab Uno') RETURNING id INTO p1;
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido) VALUES (a, 'Pastor', 'Lab Dos') RETURNING id INTO p2;
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido) VALUES (b, 'Pastor', 'Lab Medellin') RETURNING id INTO pb;
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido) VALUES (a, 'Intercesora', 'Lab') RETURNING id INTO ora;
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, email_principal)
       VALUES (a, 'Miembro', 'Con Permiso', 'lab.con.permiso@example.org') RETURNING id INTO m1;
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, email_principal)
       VALUES (a, 'Miembro', 'Sin Permiso', 'lab.sin.permiso@example.org') RETURNING id INTO m2;
  INSERT INTO identidad.asignaciones (persona_id, rol, alcance_tipo, alcance_id, nivel_max, otorgado_por, acta_referencia) VALUES
    (p1, 'PASTOR_CONGREGACIONAL', 'sede', a, 3, dg, 'Banco modulos nuevos'),
    (p2, 'PASTOR_CONGREGACIONAL', 'sede', a, 3, dg, 'Banco modulos nuevos'),
    (pb, 'PASTOR_CONGREGACIONAL', 'sede', b, 3, dg, 'Banco modulos nuevos'),
    (ora, 'PERSONA_QUE_ORA', 'sede', a, 3, dg, 'Banco modulos nuevos');
  INSERT INTO plataforma.consentimientos (persona_id, sede_id, finalidad, canal, acto, ocurrido_en, evidencia_tipo)
       VALUES (m1, a, 'convocatoria', 'email', 'otorgado', now(), 'formulario_web');
  SELECT codigo INTO v_tipo FROM sistema.catalogo_valores WHERE catalogo = 'tipo_grupo' AND vigente ORDER BY orden LIMIT 1;
  SELECT codigo INTO v_rol FROM sistema.catalogo_valores WHERE catalogo = 'rol_membresia' AND vigente ORDER BY orden LIMIT 1;
  INSERT INTO grupos.grupos (sede_id, tipo, nombre) VALUES (a, v_tipo, 'Grupo del banco de modulos') RETURNING id INTO g;
  INSERT INTO grupos.grupos (sede_id, tipo, nombre) VALUES (b, v_tipo, 'Grupo de otra sede') RETURNING id INTO gb;
  INSERT INTO grupos.membresias (grupo_id, persona_id, rol, fecha_ingreso) VALUES
    (g, m1, v_rol, CURRENT_DATE), (g, m2, v_rol, CURRENT_DATE);
  INSERT INTO mlab VALUES ('a',a),('b',b),('dg',dg),('p1',p1),('p2',p2),('pb',pb),('ora',ora),('m1',m1),('m2',m2),('g',g),('gb',gb);
END $$;

-- ═════════════════ ORACIÓN ═════════════════
-- O1 · ⭐ Lo confidencial no lo ve el intercesor; la otra pastora sí.
DO $$
DECLARE v uuid; n_ora int; n_p2 int; n_pb int;
BEGIN
  PERFORM pg_temp.como(pg_temp.lab('p1'), ARRAY[pg_temp.lab('a')], 3, false);
  SET LOCAL ROLE casaroca_app;
  INSERT INTO crm.peticiones_oracion (sede_id, persona_id, categoria, resumen, detalle, confidencial)
  VALUES ((SELECT mlab.v FROM mlab WHERE mlab.k='a'), (SELECT mlab.v FROM mlab WHERE mlab.k='m1'), 'familia',
          'Situacion familiar delicada', 'Detalle que solo ven los pastores', true);
  RESET ROLE;
  SELECT id INTO v FROM crm.peticiones_oracion WHERE resumen = 'Situacion familiar delicada';
  INSERT INTO mlab VALUES ('conf', v);

  PERFORM pg_temp.como(pg_temp.lab('ora'), ARRAY[pg_temp.lab('a')], 3, false);
  SET LOCAL ROLE casaroca_app;
  SELECT count(*) INTO n_ora FROM crm.peticiones_oracion WHERE id = v;
  RESET ROLE;
  PERFORM pg_temp.como(pg_temp.lab('p2'), ARRAY[pg_temp.lab('a')], 3, false);
  SET LOCAL ROLE casaroca_app;
  SELECT count(*) INTO n_p2 FROM crm.peticiones_oracion WHERE id = v;
  RESET ROLE;
  PERFORM pg_temp.como(pg_temp.lab('pb'), ARRAY[pg_temp.lab('b')], 3, false);
  SET LOCAL ROLE casaroca_app;
  SELECT count(*) INTO n_pb FROM crm.peticiones_oracion WHERE id = v;
  RESET ROLE;
  PERFORM pg_temp.rg(1, 'Peticion confidencial: intercesor · otra pastora · otra sede', '0 · 1 · 0',
    n_ora || ' · ' || n_p2 || ' · ' || n_pb, n_ora = 0 AND n_p2 = 1 AND n_pb = 0);
END $$;

-- O2 · Lo que no se compartió con los intercesores, no lo ven; lo compartido, sí.
DO $$
DECLARE n_no int; n_si int;
BEGIN
  PERFORM pg_temp.como(pg_temp.lab('p1'), ARRAY[pg_temp.lab('a')], 3, false);
  SET LOCAL ROLE casaroca_app;
  INSERT INTO crm.peticiones_oracion (sede_id, nombre_contacto, categoria, resumen, compartir_con_intercesores)
  VALUES ((SELECT mlab.v FROM mlab WHERE mlab.k='a'), 'Visitante', 'salud', 'Peticion sin compartir', false),
         ((SELECT mlab.v FROM mlab WHERE mlab.k='a'), 'Visitante', 'salud', 'Peticion compartida', true);
  RESET ROLE;
  PERFORM pg_temp.como(pg_temp.lab('ora'), ARRAY[pg_temp.lab('a')], 3, false);
  SET LOCAL ROLE casaroca_app;
  SELECT count(*) FILTER (WHERE resumen = 'Peticion sin compartir'),
         count(*) FILTER (WHERE resumen = 'Peticion compartida')
    INTO n_no, n_si FROM crm.peticiones_oracion;
  RESET ROLE;
  PERFORM pg_temp.rg(2, 'El intercesor ve solo lo compartido', 'sin compartir 0 · compartida 1',
    'sin compartir ' || n_no || ' · compartida ' || n_si, n_no = 0 AND n_si = 1);
END $$;

-- O3 · ⭐ La oración hecha toma la sede de la petición, aunque el cliente mande otra.
DO $$
DECLARE v_pet uuid; v_sede uuid;
BEGIN
  SELECT id INTO v_pet FROM crm.peticiones_oracion WHERE resumen = 'Peticion compartida';
  PERFORM pg_temp.como(pg_temp.lab('ora'), ARRAY[pg_temp.lab('a')], 3, false);
  SET LOCAL ROLE casaroca_app;
  INSERT INTO crm.oraciones_hechas (peticion_id, sede_id) VALUES (v_pet, (SELECT mlab.v FROM mlab WHERE mlab.k='b'));
  RESET ROLE;
  SELECT sede_id INTO v_sede FROM crm.oraciones_hechas WHERE peticion_id = v_pet;
  PERFORM pg_temp.rg(3, 'La oracion hecha queda en la sede de su peticion', 'CHIA',
    (SELECT codigo FROM org.sedes WHERE id = v_sede), v_sede = pg_temp.lab('a'));
END $$;

-- O4 · Nadie registra oración sobre una petición que no ve.
DO $$
DECLARE ok boolean := false;
BEGIN
  PERFORM pg_temp.como(pg_temp.lab('ora'), ARRAY[pg_temp.lab('a')], 3, false);
  BEGIN
    SET LOCAL ROLE casaroca_app;
    INSERT INTO crm.oraciones_hechas (peticion_id, sede_id) VALUES ((SELECT mlab.v FROM mlab WHERE mlab.k='conf'), (SELECT mlab.v FROM mlab WHERE mlab.k='a'));
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  RESET ROLE;
  PERFORM pg_temp.rg(4, 'Orar sobre una peticion confidencial que no ve', 'RECHAZADO',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (fuga)' END, ok);
END $$;

-- O5 · El formulario público registra sin sesión, y sin sesión no se lee.
DO $$
DECLARE v uuid := gen_random_uuid(); n_leida int; n_real int;
BEGIN
  PERFORM pg_temp.como(NULL, ARRAY[pg_temp.lab('a')], 2, false);
  SET LOCAL ROLE casaroca_app;
  INSERT INTO crm.peticiones_oracion (id, sede_id, nombre_contacto, contacto, categoria, resumen, origen)
  VALUES (v, (SELECT mlab.v FROM mlab WHERE mlab.k='a'), 'Visitante web', 'visitante@example.org', 'duelo', 'Perdi a mi madre', 'formulario_publico');
  SELECT count(*) INTO n_leida FROM crm.peticiones_oracion WHERE id = v;
  RESET ROLE;
  SELECT count(*) INTO n_real FROM crm.peticiones_oracion WHERE id = v;
  PERFORM pg_temp.rg(5, 'Formulario publico: se guarda y no se puede leer de vuelta', 'guardada 1 · leida 0',
    'guardada ' || n_real || ' · leida ' || n_leida, n_real = 1 AND n_leida = 0);
END $$;

-- O6 · Una transición que no existe se rechaza y dice a dónde sí se puede ir.
DO $$
DECLARE ok boolean := false; msg text;
BEGIN
  UPDATE crm.peticiones_oracion SET estado = 'cerrada' WHERE resumen = 'Peticion sin compartir';
  BEGIN
    UPDATE crm.peticiones_oracion SET estado = 'abierta' WHERE resumen = 'Peticion sin compartir';
  EXCEPTION WHEN check_violation THEN ok := true; msg := SQLERRM;
  END;
  PERFORM pg_temp.rg(6, 'Reabrir una peticion cerrada', 'RECHAZADO y explicado',
    COALESCE(msg, 'ACEPTADO (mal)'), ok AND msg LIKE '%estado es final%');
END $$;

-- O7 · «Respondida» exige la respuesta, y la fecha la pone la base.
DO $$
DECLARE ok boolean := false; v_fecha timestamptz;
BEGIN
  BEGIN
    UPDATE crm.peticiones_oracion SET estado = 'respondida' WHERE resumen = 'Peticion compartida';
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  UPDATE crm.peticiones_oracion SET estado = 'respondida', respuesta = 'Dios respondio'
   WHERE resumen = 'Peticion compartida' RETURNING respondida_en INTO v_fecha;
  PERFORM pg_temp.rg(7, 'Respondida sin respuesta · con respuesta sella la fecha', 'rechazada · sellada',
    CASE WHEN ok THEN 'rechazada' ELSE 'aceptada' END || ' · ' || CASE WHEN v_fecha IS NULL THEN 'sin fecha' ELSE 'sellada' END,
    ok AND v_fecha IS NOT NULL);
END $$;

-- ═════════════════ PETICIONES INTERNAS ═════════════════
-- P1 · ⭐ Nadie decide lo que él mismo pidió; otra persona sí.
DO $$
DECLARE v uuid; ok boolean := false; v_estado text;
BEGIN
  INSERT INTO sistema.peticiones_internas (sede_id, solicitante_id, tipo, asunto, detalle)
  VALUES (pg_temp.lab('a'), pg_temp.lab('p1'), 'presupuesto', 'Presupuesto de sonido', 'Se necesitan dos microfonos nuevos')
  RETURNING id INTO v;
  BEGIN
    UPDATE sistema.peticiones_internas SET estado = 'aprobada', decision = 'Aprobado', decidida_por = pg_temp.lab('p1') WHERE id = v;
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  UPDATE sistema.peticiones_internas SET estado = 'aprobada', decision = 'Aprobado', decidida_por = pg_temp.lab('dg')
   WHERE id = v RETURNING estado INTO v_estado;
  PERFORM pg_temp.rg(8, 'Aprobar lo propio · aprobarlo otra persona', 'rechazado · aprobada',
    CASE WHEN ok THEN 'rechazado' ELSE 'aceptado' END || ' · ' || v_estado, ok AND v_estado = 'aprobada');
END $$;

-- ═════════════════ REQUERIMIENTOS ═════════════════
-- R1 · El plazo sale de la prioridad; reabrir borra la fecha de resuelto.
DO $$
DECLARE v uuid; v_horas numeric; v_res timestamptz;
BEGIN
  INSERT INTO sistema.requerimientos (sede_id, categoria, asunto, prioridad)
  VALUES (pg_temp.lab('a'), 'sonido_video', 'Se cayo la consola de sonido', 'urgente')
  RETURNING id, extract(epoch FROM vence_en - creado_en) / 3600 INTO v, v_horas;
  UPDATE sistema.requerimientos SET estado = 'resuelto', solucion = 'Se cambio la fuente' WHERE id = v;
  UPDATE sistema.requerimientos SET estado = 'en_curso' WHERE id = v RETURNING resuelto_en INTO v_res;
  PERFORM pg_temp.rg(9, 'Urgente vence en 4 h · reabierto deja de contar como resuelto', '4 h · sin fecha',
    round(v_horas) || ' h · ' || COALESCE(v_res::text, 'sin fecha'), round(v_horas) = 4 AND v_res IS NULL);
END $$;

-- ═════════════════ TAREAS ═════════════════
-- T1 · Hecha sella su fecha.
DO $$
DECLARE v_fecha timestamptz;
BEGIN
  INSERT INTO plataforma.tareas (sede_id, titulo) VALUES (pg_temp.lab('a'), 'Llamar a los nuevos del domingo');
  UPDATE plataforma.tareas SET estado = 'hecha' WHERE titulo = 'Llamar a los nuevos del domingo' RETURNING hecha_en INTO v_fecha;
  PERFORM pg_temp.rg(10, 'Tarea hecha sella la fecha', 'sellada', COALESCE(v_fecha::text, 'sin fecha'), v_fecha IS NOT NULL);
END $$;

-- ═════════════════ CALENDARIO ═════════════════
-- E1 · ⭐ Un evento para toda la red no lo publica una sede.
DO $$
DECLARE ok boolean := false;
BEGIN
  PERFORM pg_temp.como(pg_temp.lab('p1'), ARRAY[pg_temp.lab('a')], 3, false);
  BEGIN
    SET LOCAL ROLE casaroca_app;
    INSERT INTO org.eventos (sede_id, alcance_red, tipo, titulo, inicia, termina)
    VALUES ((SELECT mlab.v FROM mlab WHERE mlab.k='a'), true, 'conferencia', 'Conferencia de toda la red', now() + interval '10 days', now() + interval '10 days 3 hours');
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  RESET ROLE;
  PERFORM pg_temp.rg(11, 'Una sede publica un evento para toda la red', 'RECHAZADO',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- E2 · El evento de red del director lo ve Medellín; el de Chía, no.
DO $$
DECLARE n_red int; n_chia int;
BEGIN
  PERFORM pg_temp.como(pg_temp.lab('dg'), ARRAY[]::uuid[], 4, true);
  INSERT INTO org.eventos (sede_id, alcance_red, tipo, titulo, inicia, termina) VALUES
    (pg_temp.lab('a'), true, 'conferencia', 'Conferencia anual de la red', now() + interval '20 days', now() + interval '20 days 4 hours'),
    (pg_temp.lab('a'), false, 'reunion', 'Reunion de servidores de Chia', now() + interval '3 days', now() + interval '3 days 2 hours');
  PERFORM pg_temp.como(pg_temp.lab('pb'), ARRAY[pg_temp.lab('b')], 3, false);
  SET LOCAL ROLE casaroca_app;
  SELECT count(*) FILTER (WHERE titulo = 'Conferencia anual de la red'),
         count(*) FILTER (WHERE titulo = 'Reunion de servidores de Chia') INTO n_red, n_chia FROM org.eventos;
  RESET ROLE;
  PERFORM pg_temp.rg(12, 'Medellin ve el evento de red y no el de Chia', 'red 1 · Chia 0',
    'red ' || n_red || ' · Chia ' || n_chia, n_red = 1 AND n_chia = 0);
END $$;

-- ═════════════════ TEMÁTICAS ═════════════════
-- S1 · La enseñanza toma la sede de su serie aunque el cliente mande otra.
DO $$
DECLARE v_serie uuid; v_sede uuid;
BEGIN
  INSERT INTO formacion.series (sede_id, titulo) VALUES (pg_temp.lab('a'), 'Serie Fundamentos') RETURNING id INTO v_serie;
  INSERT INTO formacion.ensenanzas (serie_id, sede_id, titulo, fecha)
  VALUES (v_serie, pg_temp.lab('b'), 'La roca firme', CURRENT_DATE) RETURNING sede_id INTO v_sede;
  PERFORM pg_temp.rg(13, 'La ensenanza queda en la sede de su serie', 'CHIA',
    (SELECT codigo FROM org.sedes WHERE id = v_sede), v_sede = pg_temp.lab('a'));
END $$;

-- ═════════════════ LEGAL ═════════════════
-- L1 · ⭐ Una actuación legal no se edita, y Medellín no ve los asuntos de Chía.
DO $$
DECLARE v_asunto uuid; v_nota uuid; ok boolean := false; n_med int;
BEGIN
  INSERT INTO plataforma.asuntos_legales (sede_id, tipo, titulo, contraparte)
  VALUES (pg_temp.lab('a'), 'arrendamiento', 'Renovacion del arriendo del local', 'Inmobiliaria Lab') RETURNING id INTO v_asunto;
  INSERT INTO plataforma.asuntos_legales_notas (asunto_id, sede_id, autor_id, contenido)
  VALUES (v_asunto, pg_temp.lab('a'), pg_temp.lab('dg'), 'Se envio la carta de renovacion') RETURNING id INTO v_nota;
  PERFORM pg_temp.como(pg_temp.lab('dg'), ARRAY[]::uuid[], 4, true);
  BEGIN
    SET LOCAL ROLE casaroca_app;
    UPDATE plataforma.asuntos_legales_notas SET contenido = 'Texto cambiado despues' WHERE id = v_nota;
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  RESET ROLE;
  PERFORM pg_temp.como(pg_temp.lab('pb'), ARRAY[pg_temp.lab('b')], 3, false);
  SET LOCAL ROLE casaroca_app;
  SELECT count(*) INTO n_med FROM plataforma.asuntos_legales WHERE id = v_asunto;
  RESET ROLE;
  PERFORM pg_temp.rg(14, 'Editar una actuacion legal · Medellin ve el asunto de Chia', 'rechazado · 0',
    CASE WHEN ok THEN 'rechazado' ELSE 'EDITADA' END || ' · ' || n_med, ok AND n_med = 0);
END $$;

-- ═════════════════ COMUNICACIONES ═════════════════
-- C1 · ⭐ Cuatro ojos: el autor no aprueba lo suyo.
DO $$
DECLARE v uuid; ok boolean := false;
BEGIN
  INSERT INTO crm.comunicaciones (sede_id, finalidad, asunto, cuerpo, destinatarios, grupo_id, creada_por)
  VALUES (pg_temp.lab('a'), 'convocatoria', 'Retiro de grupos', 'Los esperamos el sabado en el retiro de grupos de la sede.',
          'grupo', pg_temp.lab('g'), pg_temp.lab('p1')) RETURNING id INTO v;
  INSERT INTO mlab VALUES ('com', v);
  BEGIN
    UPDATE crm.comunicaciones SET estado = 'aprobada', aprobada_por = pg_temp.lab('p1') WHERE id = v;
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  PERFORM pg_temp.rg(15, 'El autor aprueba su propio envio masivo', 'RECHAZADO',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- C2 · Aprobada queda congelada: el autor no cambia el texto después.
DO $$
DECLARE ok boolean := false;
BEGIN
  UPDATE crm.comunicaciones SET estado = 'aprobada', aprobada_por = pg_temp.lab('p2') WHERE id = pg_temp.lab('com');
  BEGIN
    UPDATE crm.comunicaciones SET cuerpo = 'Texto distinto al que se aprobo, cambiado despues.' WHERE id = pg_temp.lab('com');
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  PERFORM pg_temp.rg(16, 'Cambiar el texto despues de aprobado', 'RECHAZADO',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (los cuatro ojos no vieron lo que sale)' END, ok);
END $$;

-- C3 · A «enviada» no se llega con un UPDATE: solo por la función que filtra.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    UPDATE crm.comunicaciones SET estado = 'enviada' WHERE id = pg_temp.lab('com');
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  PERFORM pg_temp.rg(17, 'Marcar enviada sin pasar por el envio', 'RECHAZADO',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (salto el freno y el consentimiento)' END, ok);
END $$;

-- C4 · ⭐ Con el freno puesto no sale nada.
DO $$
DECLARE ok boolean := false;
BEGIN
  PERFORM pg_temp.como(pg_temp.lab('dg'), ARRAY[]::uuid[], 4, true);
  PERFORM sistema.cambiar_freno('comunicaciones_masivas', true, 'Prueba del banco de modulos');
  PERFORM pg_temp.como(pg_temp.lab('p1'), ARRAY[pg_temp.lab('a')], 3, false);
  BEGIN
    SET LOCAL ROLE casaroca_app;
    PERFORM crm.enviar_comunicacion((SELECT mlab.v FROM mlab WHERE mlab.k='com'));
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  RESET ROLE;
  PERFORM pg_temp.como(pg_temp.lab('dg'), ARRAY[]::uuid[], 4, true);
  PERFORM sistema.cambiar_freno('comunicaciones_masivas', false, 'Fin de la prueba del freno');
  PERFORM pg_temp.rg(18, 'Enviar con el freno puesto', 'RECHAZADO',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'SALIO (el freno no frena)' END, ok);
END $$;

-- C5 · ⭐ Sale solo a quien autorizó; el otro se cuenta, no se le escribe.
DO $$
DECLARE r jsonb; n_m1 int; n_m2 int;
BEGIN
  PERFORM pg_temp.como(pg_temp.lab('p1'), ARRAY[pg_temp.lab('a')], 3, false);
  SET LOCAL ROLE casaroca_app;
  r := crm.enviar_comunicacion((SELECT mlab.v FROM mlab WHERE mlab.k='com'));
  RESET ROLE;
  SELECT count(*) FILTER (WHERE persona_id = pg_temp.lab('m1')), count(*) FILTER (WHERE persona_id = pg_temp.lab('m2'))
    INTO n_m1, n_m2 FROM plataforma.notificaciones WHERE origen_id = pg_temp.lab('com')::text;
  PERFORM pg_temp.rg(19, 'Envio al grupo: con permiso · sin permiso', 'encolado 1 · omitido 1 · a m2 0 avisos',
    'encolado ' || (r->>'encolados') || ' · omitido ' || (r->>'omitidos_sin_consentimiento') || ' · a m2 ' || n_m2 || ' avisos',
    (r->>'encolados')::int = 1 AND (r->>'omitidos_sin_consentimiento')::int = 1 AND n_m1 = 1 AND n_m2 = 0);
END $$;

-- C6 · El grupo de otra sede no es destinatario de una comunicación de esta.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    INSERT INTO crm.comunicaciones (sede_id, finalidad, asunto, cuerpo, destinatarios, grupo_id, creada_por)
    VALUES (pg_temp.lab('a'), 'convocatoria', 'Envio cruzado', 'Este envio apunta a un grupo de otra sede y no debe existir.',
            'grupo', pg_temp.lab('gb'), pg_temp.lab('p1'));
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  PERFORM pg_temp.rg(20, 'Comunicacion de Chia a un grupo de Medellin', 'RECHAZADO',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- ═════════════════ CONSTRUCCIÓN ═════════════════
-- B1 · El hito mueve la obra; una obra terminada no recibe hitos.
DO $$
DECLARE v uuid; v_av int; v_ej numeric; v_est text; ok boolean := false;
BEGIN
  INSERT INTO org.obras (sede_id, nombre, tipo, presupuesto) VALUES (pg_temp.lab('a'), 'Ampliacion del salon', 'ampliacion', 50000000)
  RETURNING id INTO v;
  INSERT INTO org.obras_hitos (obra_id, sede_id, fecha, descripcion, avance_pct, gasto) VALUES
    (v, pg_temp.lab('a'), CURRENT_DATE - 10, 'Cimientos terminados', 30, 12000000),
    (v, pg_temp.lab('a'), CURRENT_DATE, 'Muros levantados', 60, 8000000);
  SELECT avance_pct, ejecutado, estado INTO v_av, v_ej, v_est FROM org.obras WHERE id = v;
  UPDATE org.obras SET avance_pct = 100, estado = 'terminada' WHERE id = v;
  BEGIN
    INSERT INTO org.obras_hitos (obra_id, sede_id, fecha, descripcion) VALUES (v, pg_temp.lab('a'), CURRENT_DATE, 'Hito tardio');
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  PERFORM pg_temp.rg(21, 'Hitos: avance · ejecutado · estado · hito en obra terminada', '60 · 20000000 · en_curso · rechazado',
    v_av || ' · ' || v_ej::bigint || ' · ' || v_est || ' · ' || CASE WHEN ok THEN 'rechazado' ELSE 'aceptado' END,
    v_av = 60 AND v_ej = 20000000 AND v_est = 'en_curso' AND ok);
END $$;

-- ═════════════════ ANALÍTICA ═════════════════
-- A1 · ⭐ Una cifra pequeña no identifica a nadie.
DO $$
DECLARE t jsonb;
BEGIN
  PERFORM pg_temp.como(pg_temp.lab('p1'), ARRAY[pg_temp.lab('a')], 3, false);
  SET LOCAL ROLE casaroca_app;
  t := plataforma.tablero((SELECT mlab.v FROM mlab WHERE mlab.k='a'));
  RESET ROLE;
  PERFORM pg_temp.rg(22, 'Supresion: 3 · 7 · 0, y el tablero responde', '<5 · 7 · 0 · con nota',
    plataforma.celda(3) || ' · ' || plataforma.celda(7) || ' · ' || plataforma.celda(0) || ' · ' ||
    CASE WHEN t ? 'nota' AND t ? 'asistencia_por_semana' THEN 'con nota' ELSE 'sin nota' END,
    plataforma.celda(3) = '<5' AND plataforma.celda(7) = '7' AND plataforma.celda(0) = '0' AND t ? 'nota');
END $$;

-- ═════════════════ RETENCIÓN ═════════════════
-- G1 · ⭐ Toda política encuentra su columna de fecha (antes dos nunca se aplicaron).
DO $$
DECLARE sin text;
BEGIN
  SELECT string_agg(objeto, ', ') INTO sin FROM plataforma.purgar_por_retencion() WHERE que_hizo LIKE 'SIN COLUMNA%';
  PERFORM pg_temp.rg(23, 'Politicas de retencion que no se aplican', 'ninguna', COALESCE(sin, 'ninguna'), sin IS NULL);
END $$;

-- G2 · ⭐ La alergia de un niño que sigue viniendo NO se purga; la de uno que dejó de venir, sí.
DO $$
DECLARE v_menor uuid; n_viene bigint; n_se_fue bigint;
BEGIN
  SELECT menor_id INTO v_menor FROM rocakids.checkins ORDER BY ingreso_en DESC LIMIT 1;
  IF v_menor IS NULL THEN
    PERFORM pg_temp.rg(24, 'Alergia de un nino que sigue viniendo', 'se conserva', 'SIN SUJETO: no hay check-ins en la base', false);
    RETURN;
  END IF;
  INSERT INTO rocakids.condiciones_medicas (menor_id, tipo, descripcion, critica, registrada_en)
  VALUES (v_menor, 'alergia', 'Alergia al mani (prueba del banco)', true, now() - interval '2 years');
  UPDATE rocakids.checkins SET ingreso_en = now() - interval '3 days' WHERE menor_id = v_menor;
  SELECT filas INTO n_viene FROM plataforma.purgar_por_retencion() WHERE objeto = 'rocakids.condiciones_medicas';
  UPDATE rocakids.checkins SET ingreso_en = now() - interval '2 years' WHERE menor_id = v_menor;
  SELECT filas INTO n_se_fue FROM plataforma.purgar_por_retencion() WHERE objeto = 'rocakids.condiciones_medicas';
  PERFORM pg_temp.rg(24, 'Alergia de hace 2 anos: nino que viene · nino que dejo de venir', 'se conserva (0) · se purga (1)',
    n_viene || ' · ' || n_se_fue, n_viene = 0 AND n_se_fue = 1);
END $$;

-- G3 · ⭐ La evidencia de una entrega protege su check-in: la purga no aborta.
DO $$
DECLARE n_viejos bigint; n_prot bigint; r record;
BEGIN
  UPDATE rocakids.checkins SET ingreso_en = now() - interval '3 years';
  SELECT count(*) INTO n_viejos FROM rocakids.checkins;
  SELECT count(DISTINCT c.id) INTO n_prot FROM rocakids.checkins c
    JOIN rocakids.intentos_entrega i ON i.checkin_id = c.id;
  SELECT * INTO r FROM plataforma.purgar_por_retencion() WHERE objeto = 'rocakids.checkins';
  PERFORM pg_temp.rg(25, 'Purga de check-ins con evidencia de entrega', (n_viejos - n_prot) || ' se borrarian · ' || n_prot || ' protegidos',
    r.filas || ' se borrarian · ' || r.que_hizo,
    r.filas = n_viejos - n_prot AND (n_prot = 0 OR r.que_hizo LIKE '%' || n_prot || ' se conservan como evidencia%'));
END $$;

\echo ''
\echo '===== LOS DIEZ MODULOS NUEVOS ====='
SELECT n AS "#", caso AS invariante, obtenido AS resultado,
       CASE WHEN pasa THEN 'PASA' ELSE 'FALLA' END AS veredicto
FROM m_res ORDER BY n;
SELECT count(*) FILTER (WHERE pasa) AS pasan,
       count(*) FILTER (WHERE NOT pasa) AS fallan, count(*) AS total FROM m_res;

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT pasa) INTO v FROM m_res;
  IF v > 0 THEN RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en modulos_nuevos.sql', v; END IF;
END $$;
ROLLBACK;
