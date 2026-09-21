-- =====================================================================
-- Banco: LA FICHA SE ABRE POR ALCANCE (migración 0077)
--
-- ⛔ Lo que protege: que el alcance fino de un rol (un grupo, un
--    segmento, un ministerio, un caso, los menores a cargo) no se
--    convierta en la sede entera al abrir una ficha. El 21 de septiembre
--    un líder de grupo con un grupo VACÍO leía la ficha completa de las
--    35 personas de su sede. Cada caso de aquí es un tipo de alcance, y
--    los que dicen «no» importan más que los que dicen «sí».
-- =====================================================================
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE p_res(n int, caso text, esperado text, obtenido text, pasa boolean) ON COMMIT DROP;
CREATE FUNCTION pg_temp.rg(a int, b text, c text, d text, e boolean) RETURNS void
LANGUAGE sql AS $$ INSERT INTO p_res VALUES (a,b,c,d,e) $$;
CREATE TEMP TABLE plab(k text PRIMARY KEY, v uuid) ON COMMIT DROP;
CREATE FUNCTION pg_temp.v(clave text) RETURNS uuid LANGUAGE sql AS $$ SELECT v FROM plab WHERE k = clave $$;
CREATE FUNCTION pg_temp.alc(lector text, persona text) RETURNS boolean LANGUAGE sql AS $$
  SELECT identidad.alcanza_persona(pg_temp.v(lector), pg_temp.v(persona)) $$;
CREATE FUNCTION pg_temp.caso(n int, texto text, lector text, persona text, esperado boolean) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE r boolean := pg_temp.alc(lector, persona);
BEGIN
  PERFORM pg_temp.rg(n, texto, CASE WHEN esperado THEN 'alcanza' ELSE 'no alcanza' END,
                     CASE WHEN r THEN 'alcanza' ELSE 'no alcanza' END, r IS NOT DISTINCT FROM esperado);
END $$;

-- ── Sujetos del laboratorio ──────────────────────────────────────────
DO $$
DECLARE chia uuid; med uuid; dg uuid; pchia uuid; reg_bog uuid; min uuid; tipo_g text; rol_m text; topico text;
        g uuid; g2 uuid; seg uuid; caso uuid; p uuid;
        nombres text[] := ARRAY['lider','a','b','dseg','dmin','vol','wmin','cons','x','acu','inter','sec_u','borrada'];
        k text;
BEGIN
  SELECT id INTO chia FROM org.sedes WHERE codigo = 'CHIA';
  SELECT id INTO med FROM org.sedes WHERE codigo = 'MED';
  SELECT id INTO reg_bog FROM org.unidades WHERE codigo = 'REG-BOG';
  SELECT persona_id INTO dg FROM identidad.asignaciones
   WHERE rol = 'PASTOR_DIRECTOR_GENERAL' AND alcance_tipo = 'organizacion' AND revocada_en IS NULL LIMIT 1;
  SELECT persona_id INTO pchia FROM identidad.asignaciones
   WHERE rol = 'PASTOR_CONGREGACIONAL' AND alcance_tipo = 'sede' AND alcance_id = chia AND revocada_en IS NULL LIMIT 1;
  -- Cualquier ministerio sirve: el alcance lo da el rol, no que esté encendido en Chía.
  SELECT id INTO min FROM org.ministerios ORDER BY codigo LIMIT 1;
  SELECT codigo INTO tipo_g FROM sistema.catalogo_valores WHERE catalogo = 'tipo_grupo' AND vigente ORDER BY orden LIMIT 1;
  SELECT codigo INTO rol_m FROM sistema.catalogo_valores WHERE catalogo = 'rol_membresia' AND vigente ORDER BY orden LIMIT 1;
  SELECT codigo INTO topico FROM consejeria.topicos LIMIT 1;
  IF chia IS NULL OR med IS NULL OR dg IS NULL OR pchia IS NULL OR reg_bog IS NULL OR min IS NULL
     OR tipo_g IS NULL OR rol_m IS NULL OR topico IS NULL THEN
    RAISE EXCEPTION 'Sujetos agotados: falta una sede, la región, un ministerio, un catálogo, la dirección o el pastor de Chía.';
  END IF;
  INSERT INTO plab VALUES ('chia', chia), ('med', med), ('dg', dg), ('pchia', pchia), ('reg_bog', reg_bog), ('min', min);

  FOREACH k IN ARRAY nombres LOOP
    INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido)
    VALUES (chia, 'Banco', 'Alcance ' || k) RETURNING id INTO p;
    INSERT INTO plab VALUES (k, p);
  END LOOP;
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido) VALUES (med, 'Banco', 'Alcance c')
  RETURNING id INTO p;
  INSERT INTO plab VALUES ('c', p);
  UPDATE nucleo.personas SET eliminado_en = now() WHERE id = pg_temp.v('borrada');

  -- Dos menores: uno de la acudiente de laboratorio y otro ajeno.
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
  VALUES (chia, 'Banco', 'Alcance menor', CURRENT_DATE - interval '8 years') RETURNING id INTO p;
  INSERT INTO plab VALUES ('menor', p);
  INSERT INTO nucleo.acudientes (menor_id, acudiente_id, parentesco, es_principal, autoriza_retiro)
  VALUES (p, pg_temp.v('acu'), 'MADRE', true, true);
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
  VALUES (chia, 'Banco', 'Alcance menor ajeno', CURRENT_DATE - interval '9 years') RETURNING id INTO p;
  INSERT INTO plab VALUES ('menor_ajeno', p);
  INSERT INTO nucleo.acudientes (menor_id, acudiente_id, parentesco, es_principal, autoriza_retiro)
  VALUES (p, pg_temp.v('b'), 'PADRE', true, true);

  -- El grupo del líder, con Ana; y un grupo que es del segmento y del ministerio.
  INSERT INTO grupos.grupos (sede_id, tipo, nombre) VALUES (chia, tipo_g, 'Grupo del banco de alcance')
  RETURNING id INTO g;
  INSERT INTO plab VALUES ('g', g);
  INSERT INTO grupos.membresias (grupo_id, persona_id, rol, fecha_ingreso) VALUES (g, pg_temp.v('a'), rol_m, CURRENT_DATE);
  -- Un segmento exige su ministerio encendido en la sede (así lo pide la base).
  INSERT INTO org.ministerios_sede (sede_id, ministerio_id, activo, activado_en) VALUES (chia, min, true, now())
  ON CONFLICT (sede_id, ministerio_id) DO UPDATE SET activo = true, activado_en = now();
  INSERT INTO org.segmentos (sede_id, ministerio_id, codigo, nombre, orden, activo)
  VALUES (chia, min, 'SEG-BANCO-ALCANCE', 'Segmento del banco de alcance', 99, true) RETURNING id INTO seg;
  INSERT INTO plab VALUES ('seg', seg);
  INSERT INTO grupos.grupos (sede_id, tipo, nombre, segmento_id, ministerio_id)
  VALUES (chia, tipo_g, 'Grupo del segmento del banco', seg, min) RETURNING id INTO g2;
  INSERT INTO grupos.membresias (grupo_id, persona_id, rol, fecha_ingreso)
  VALUES (g2, pg_temp.v('dseg'), rol_m, CURRENT_DATE), (g2, pg_temp.v('wmin'), rol_m, CURRENT_DATE);
  INSERT INTO talento.voluntariados (persona_id, sede_id, ministerio_id, funcion, estado, desde)
  VALUES (pg_temp.v('vol'), chia, min, 'Servidora del banco de alcance', 'activo', CURRENT_DATE);

  -- Un caso de consejería con su consejero asignado.
  INSERT INTO consejeria.casos (consultante_id, sede_id, topico, estado, abierto_en)
  VALUES (pg_temp.v('x'), chia, topico, 'abierto', now()) RETURNING id INTO caso;
  INSERT INTO plab VALUES ('caso', caso);
  INSERT INTO consejeria.asignaciones (caso_id, consejero_id, asignado_por) VALUES (caso, pg_temp.v('cons'), dg);

  -- Los roles de cada lector, con el alcance que dice su nombre.
  INSERT INTO identidad.asignaciones (persona_id, rol, alcance_tipo, alcance_id, nivel_max, otorgado_por, acta_referencia) VALUES
    (pg_temp.v('lider'), 'LIDER_GRUPO',        'grupo',          g,       2, dg, 'Banco de alcance'),
    (pg_temp.v('dseg'),  'DIRECTOR_SEGMENTO',  'segmento',       seg,     2, dg, 'Banco de alcance'),
    (pg_temp.v('dmin'),  'DIRECTOR_MINISTERIO','ministerio',     min,     2, dg, 'Banco de alcance'),
    (pg_temp.v('cons'),  'CONSEJERO',          'caso_propio',    NULL,    3, dg, 'Banco de alcance'),
    (pg_temp.v('acu'),   'ACUDIENTE',          'persona_propia', NULL,    4, dg, 'Banco de alcance'),
    (pg_temp.v('inter'), 'PERSONA_QUE_ORA',    'sede',           chia,    3, dg, 'Banco de alcance');
  -- El alcance de unidad no se otorga a una persona: llega por su equipo.
  INSERT INTO identidad.asignaciones_unidad (unidad_id, rol, alcance_tipo, alcance_id, nivel_max, otorgado_por, acta_referencia)
  VALUES (reg_bog, 'TALENTO_HUMANO', 'unidad', reg_bog, 2, dg, 'Banco de alcance') RETURNING id INTO p;
  INSERT INTO plab VALUES ('au', p);
  INSERT INTO org.unidad_miembros (unidad_id, persona_id, rol_en_unidad, desde)
  VALUES (reg_bog, pg_temp.v('sec_u'), 'integrante', CURRENT_DATE);
END $$;

-- ── Los casos ────────────────────────────────────────────────────────
SELECT pg_temp.caso( 1, 'La dirección de la red alcanza a alguien de otra sede',            'dg',    'c',     true);
SELECT pg_temp.caso( 2, 'El pastor de Chía alcanza a alguien de Chía sin grupo',            'pchia', 'b',     true);
SELECT pg_temp.caso( 3, 'El pastor de Chía NO alcanza a alguien de Medellín',               'pchia', 'c',     false);
SELECT pg_temp.caso( 4, 'El líder alcanza a un miembro de su grupo',                        'lider', 'a',     true);
SELECT pg_temp.caso( 5, '⭐ El líder NO alcanza a alguien de su sede que no está en su grupo', 'lider', 'b',     false);
SELECT pg_temp.caso( 6, 'El líder se alcanza a sí mismo',                                   'lider', 'lider', true);
SELECT pg_temp.caso( 7, 'El director de segmento alcanza a un miembro de un grupo del segmento', 'dseg', 'wmin', true);
SELECT pg_temp.caso( 8, 'El director de segmento NO alcanza a alguien fuera del segmento',   'dseg',  'b',     false);
SELECT pg_temp.caso( 9, 'El director de ministerio alcanza a quien sirve en el ministerio', 'dmin',  'vol',   true);
SELECT pg_temp.caso(10, 'El director de ministerio alcanza a quien está en un grupo del ministerio', 'dmin', 'wmin', true);
SELECT pg_temp.caso(11, 'El director de ministerio NO alcanza a alguien fuera del ministerio', 'dmin', 'b',   false);
SELECT pg_temp.caso(12, 'El consejero alcanza a quien consulta en su caso',                 'cons',  'x',     true);
SELECT pg_temp.caso(13, 'El consejero NO alcanza a alguien sin caso con él',                'cons',  'b',     false);
SELECT pg_temp.caso(14, 'La acudiente alcanza a su menor',                                  'acu',   'menor', true);
SELECT pg_temp.caso(15, 'La acudiente NO alcanza a un menor que no está a su cargo',        'acu',   'menor_ajeno', false);
SELECT pg_temp.caso(16, 'Un rol con alcance de sede pero sin permiso sobre Personas no alcanza', 'inter', 'b', false);
SELECT pg_temp.caso(17, 'Talento humano de la región alcanza a alguien de una sede de la región', 'sec_u', 'b', true);
SELECT pg_temp.caso(18, 'Talento humano de la región NO alcanza a alguien de fuera de la región', 'sec_u', 'c', false);
SELECT pg_temp.caso(19, 'Nadie alcanza a una persona borrada',                              'dg',    'borrada', false);

-- 20 · Si Ana sale del grupo, el líder deja de alcanzarla.
UPDATE grupos.membresias SET fecha_salida = CURRENT_DATE, motivo_salida = 'Banco de alcance'
 WHERE grupo_id = pg_temp.v('g') AND persona_id = pg_temp.v('a');
SELECT pg_temp.caso(20, 'Quien sale del grupo deja de estar al alcance del líder',        'lider', 'a',     false);

-- 21 · Si el caso se reasigna (termina la asignación), el consejero deja de alcanzar.
UPDATE consejeria.asignaciones SET hasta = now()
 WHERE caso_id = pg_temp.v('caso') AND consejero_id = pg_temp.v('cons');
SELECT pg_temp.caso(21, 'El consejero deja de alcanzar cuando termina su asignación al caso', 'cons', 'x',   false);

-- 22 · Si sale del equipo de la región, pierde en el acto TODO lo que el
--      equipo le daba (la región ya tiene otros roles de equipo: revocar
--      uno solo no bastaría, y eso también es correcto).
UPDATE org.unidad_miembros SET revocado_en = now(), revocado_por = pg_temp.v('dg'),
       motivo_salida = 'Banco de alcance'
 WHERE unidad_id = pg_temp.v('reg_bog') AND persona_id = pg_temp.v('sec_u');
SELECT pg_temp.caso(22, 'Sacarlo del equipo le quita el alcance en el acto, no a medianoche', 'sec_u', 'b',   false);

\echo ''
\echo '===== LA FICHA SE ABRE POR ALCANCE ====='
SELECT n AS "#", caso AS invariante, obtenido AS resultado,
       CASE WHEN pasa THEN 'PASA' ELSE 'FALLA' END AS veredicto
FROM p_res ORDER BY n;
SELECT count(*) FILTER (WHERE pasa) AS pasan,
       count(*) FILTER (WHERE NOT pasa) AS fallan, count(*) AS total FROM p_res;
DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT pasa) INTO v FROM p_res;
  IF v > 0 THEN RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en alcance_persona.sql', v; END IF;
END $$;
ROLLBACK;
