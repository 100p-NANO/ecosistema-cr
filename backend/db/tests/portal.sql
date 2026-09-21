-- =====================================================================
-- Banco: EL PORTAL DEL CONGREGANTE (migración 0075)
--
-- ⛔ Lo que protege: que el titular ejerza sus derechos sin pedírselos a
--    nadie, y que el portal no sea una puerta para ver a otro. Ninguna
--    función recibe el identificador de una persona: se prueba que con la
--    sesión de un miembro no se alcanza nada ajeno.
-- =====================================================================
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE p_res(n int, caso text, esperado text, obtenido text, pasa boolean) ON COMMIT DROP;
CREATE FUNCTION pg_temp.rg(a int, b text, c text, d text, e boolean) RETURNS void
LANGUAGE sql AS $$ INSERT INTO p_res VALUES (a,b,c,d,e) $$;
CREATE TEMP TABLE plab(k text PRIMARY KEY, v uuid) ON COMMIT DROP;
GRANT SELECT ON plab TO casaroca_app;
CREATE FUNCTION pg_temp.como(p uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('app.persona_id', COALESCE(p::text, ''), true);
  PERFORM set_config('app.sede_ids', '{}', true);
  PERFORM set_config('app.nivel_max', '2', true);
  PERFORM set_config('app.alcance_global', 'false', true);
END $$;

DO $$
DECLARE s uuid; yo uuid; otro uuid; g uuid; dg uuid;
BEGIN
  SELECT id INTO s FROM org.sedes WHERE codigo = 'CHIA';
  SELECT persona_id INTO dg FROM identidad.asignaciones
   WHERE rol = 'PASTOR_DIRECTOR_GENERAL' AND alcance_tipo = 'organizacion' AND revocada_en IS NULL LIMIT 1;
  IF s IS NULL OR dg IS NULL THEN RAISE EXCEPTION 'Sujetos agotados: falta CHIA o el Director General.'; END IF;
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, email_principal, telefono_movil)
  VALUES (s, 'Miembro', 'Del Portal', 'miembro.portal@example.org', '300 123 4567') RETURNING id INTO yo;
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, email_principal)
  VALUES (s, 'Vecino', 'De Banca', 'vecino.portal@example.org') RETURNING id INTO otro;
  INSERT INTO identidad.asignaciones (persona_id, rol, alcance_tipo, alcance_id, nivel_max, otorgado_por, acta_referencia)
  VALUES (yo, 'MIEMBRO', 'persona_propia', NULL, 2, dg, 'Banco del portal');
  INSERT INTO grupos.grupos (sede_id, tipo, nombre)
  VALUES (s, (SELECT codigo FROM sistema.catalogo_valores WHERE catalogo = 'tipo_grupo' AND vigente ORDER BY orden LIMIT 1),
          'Grupo del portal') RETURNING id INTO g;
  INSERT INTO grupos.membresias (grupo_id, persona_id, rol, fecha_ingreso)
  VALUES (g, yo, (SELECT codigo FROM sistema.catalogo_valores WHERE catalogo = 'rol_membresia' AND vigente ORDER BY orden LIMIT 1), CURRENT_DATE);
  INSERT INTO plataforma.consentimientos (persona_id, sede_id, finalidad, canal, acto, ocurrido_en, evidencia_tipo)
  VALUES (yo, s, 'convocatoria', 'email', 'otorgado', now() - interval '1 day', 'formulario_web');
  INSERT INTO crm.linea_tiempo (persona_id, sede_id, ocurrido_en, tipo, resumen)
  VALUES (yo, s, now() - interval '2 days', 'LLAMADA', 'Llamada de bienvenida'),
         (yo, s, now() - interval '1 day', 'NOTA_PASTORAL', 'Nota pastoral que no sale por el portal');
  INSERT INTO plab VALUES ('s', s), ('yo', yo), ('otro', otro), ('g', g);
END $$;

-- P1 · ⭐ El miembro ve su resumen sin tener ninguna sede en la sesión.
DO $$
DECLARE r jsonb;
BEGIN
  PERFORM pg_temp.como((SELECT v FROM plab WHERE k = 'yo'));
  SET LOCAL ROLE casaroca_app;
  r := portal.mi_resumen();
  RESET ROLE;
  PERFORM pg_temp.rg(1, 'Resumen propio sin sede: nombre y su grupo', 'Miembro Del Portal · 1 grupo',
    (r->'persona'->>'nombre') || ' · ' || jsonb_array_length(r->'grupos') || ' grupo',
    r->'persona'->>'nombre' = 'Miembro Del Portal' AND jsonb_array_length(r->'grupos') = 1);
END $$;

-- P2 · Sin sesión, nada.
DO $$
DECLARE ok boolean := false;
BEGIN
  PERFORM pg_temp.como(NULL);
  BEGIN
    SET LOCAL ROLE casaroca_app;
    PERFORM portal.mi_resumen();
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  RESET ROLE;
  PERFORM pg_temp.rg(2, 'Pedir un resumen sin sesión', 'RECHAZADO', CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ENTREGADO (mal)' END, ok);
END $$;

-- P3 · ⭐ El miembro se ve a sí mismo y a NADIE más de su sede.
DO $$
DECLARE n_yo int; n_otro int;
BEGIN
  PERFORM pg_temp.como((SELECT v FROM plab WHERE k = 'yo'));
  SET LOCAL ROLE casaroca_app;
  SELECT count(*) INTO n_yo FROM nucleo.personas WHERE id = (SELECT v FROM plab WHERE k = 'yo');
  SELECT count(*) INTO n_otro FROM nucleo.personas WHERE id = (SELECT v FROM plab WHERE k = 'otro');
  RESET ROLE;
  PERFORM pg_temp.rg(3, 'Leer la tabla de personas con la sesión de un miembro', 'a sí mismo 1 · al vecino 0',
    'a sí mismo ' || n_yo || ' · al vecino ' || n_otro, n_yo = 1 AND n_otro = 0);
END $$;

-- P4 · ⭐ Revocar desde el portal apaga el contacto; volver a autorizar lo enciende.
DO $$
DECLARE yo uuid := (SELECT v FROM plab WHERE k = 'yo'); a boolean; b boolean;
BEGIN
  PERFORM pg_temp.como(yo);
  SET LOCAL ROLE casaroca_app;
  PERFORM portal.cambiar_mi_consentimiento('email', 'convocatoria', false);
  RESET ROLE;
  a := plataforma.puede_contactar(yo, 'email', 'convocatoria');
  PERFORM pg_temp.como(yo);
  SET LOCAL ROLE casaroca_app;
  PERFORM portal.cambiar_mi_consentimiento('email', 'convocatoria', true);
  RESET ROLE;
  b := plataforma.puede_contactar(yo, 'email', 'convocatoria');
  PERFORM pg_temp.rg(4, 'Revocar y volver a autorizar por correo', 'revocado: no · autorizado: sí',
    'revocado: ' || CASE WHEN a THEN 'sí' ELSE 'no' END || ' · autorizado: ' || CASE WHEN b THEN 'sí' ELSE 'no' END,
    NOT a AND b);
END $$;

-- P5 · Lo que no se apoya en el consentimiento no se «apaga» con un botón, y se dice por qué.
DO $$
DECLARE ok boolean := false; msg text;
BEGIN
  PERFORM pg_temp.como((SELECT v FROM plab WHERE k = 'yo'));
  BEGIN
    SET LOCAL ROLE casaroca_app;
    PERFORM portal.cambiar_mi_consentimiento('email', 'administrativa', false);
  EXCEPTION WHEN check_violation THEN ok := true; msg := SQLERRM;
  END;
  RESET ROLE;
  PERFORM pg_temp.rg(5, 'Apagar una finalidad contractual desde el portal', 'RECHAZADO y remite a Habeas Data',
    COALESCE(msg, 'ACEPTADO (mal)'), ok AND msg LIKE '%Habeas Data%');
END $$;

-- P6 · Actualizar mis datos: el correo mal escrito se rechaza; el bueno queda, con motivo en la auditoría.
DO $$
DECLARE yo uuid := (SELECT v FROM plab WHERE k = 'yo'); ok boolean := false; tel text; mot text;
BEGIN
  PERFORM pg_temp.como(yo);
  BEGIN
    SET LOCAL ROLE casaroca_app;
    PERFORM portal.actualizar_mis_datos('esto-no-es-correo', NULL, NULL);
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  RESET ROLE;
  PERFORM pg_temp.como(yo);
  SET LOCAL ROLE casaroca_app;
  PERFORM portal.actualizar_mis_datos(NULL, '311 765 4321', 'Calle 10 # 5-20');
  RESET ROLE;
  SELECT telefono_movil INTO tel FROM nucleo.personas WHERE id = yo;
  SELECT motivo INTO mot FROM plataforma.auditoria WHERE tabla = 'personas' AND fila_id = yo::text AND operacion::text IN ('U','UPDATE') ORDER BY id DESC LIMIT 1;
  PERFORM pg_temp.rg(6, 'Correo inválido · teléfono nuevo · motivo en la auditoría', 'rechazado · 311 765 4321 · portal',
    CASE WHEN ok THEN 'rechazado' ELSE 'aceptado' END || ' · ' || COALESCE(tel, '-') || ' · ' || COALESCE(mot, 'sin motivo'),
    ok AND tel = '311 765 4321' AND mot LIKE '%portal%');
END $$;

-- P7 · ⭐ Radicar una petición propia: queda a su nombre, por la web y con plazo legal.
DO $$
DECLARE yo uuid := (SELECT v FROM plab WHERE k = 'yo'); r jsonb; t record;
BEGIN
  PERFORM pg_temp.como(yo);
  SET LOCAL ROLE casaroca_app;
  r := portal.radicar_mi_peticion('consulta', 'Quiero saber qué datos míos tiene la iglesia y para qué los usa.');
  RESET ROLE;
  SELECT titular_id, canal, vence_en INTO t FROM plataforma.peticiones_titular WHERE radicado = r->>'radicado';
  PERFORM pg_temp.rg(7, 'Radicar desde el portal', 'suya · web · con vencimiento',
    CASE WHEN t.titular_id = yo THEN 'suya' ELSE 'de otro' END || ' · ' || t.canal || ' · ' ||
    CASE WHEN t.vence_en IS NULL THEN 'sin vencimiento' ELSE 'con vencimiento' END,
    t.titular_id = yo AND t.canal = 'web' AND t.vence_en IS NOT NULL);
END $$;

-- P8 · ⭐ Descargar mis datos: sale lo N2, NO sale la nota pastoral, y queda rastro.
DO $$
DECLARE yo uuid := (SELECT v FROM plab WHERE k = 'yo'); r jsonb; n_hist int; hay_nota boolean; rastro int;
BEGIN
  PERFORM pg_temp.como(yo);
  SET LOCAL ROLE casaroca_app;
  r := portal.mis_datos();
  RESET ROLE;
  n_hist := (SELECT count(*) FROM jsonb_array_elements(r->'historia') h WHERE h->>'resumen' = 'Llamada de bienvenida');
  hay_nota := (r->'historia')::text LIKE '%Nota pastoral%';
  SELECT count(*) INTO rastro FROM plataforma.bitacora_lectura WHERE actor_id = yo AND fila_id = yo::text;
  PERFORM pg_temp.rg(8, 'Exportar mis datos: la llamada N2 · la nota N3 · rastro', 'la llamada · sin la nota · con rastro',
    CASE WHEN n_hist = 1 THEN 'la llamada' ELSE 'SIN la llamada' END || ' · ' || CASE WHEN hay_nota THEN 'CON LA NOTA' ELSE 'sin la nota' END || ' · ' ||
    CASE WHEN rastro > 0 THEN 'con rastro' ELSE 'sin rastro' END,
    n_hist = 1 AND NOT hay_nota AND rastro > 0);
END $$;

-- P9 · El certificado de otro no se abre desde el portal.
DO $$
DECLARE c uuid; r jsonb; es boolean;
BEGIN
  SELECT id INTO c FROM aportes.certificados WHERE persona_id <> (SELECT v FROM plab WHERE k = 'yo') LIMIT 1;
  IF c IS NULL THEN
    PERFORM pg_temp.rg(9, 'Certificado ajeno desde el portal', 'no se abre', 'sin certificados en la base para probar', true);
    RETURN;
  END IF;
  PERFORM pg_temp.como((SELECT v FROM plab WHERE k = 'yo'));
  SET LOCAL ROLE casaroca_app;
  es := portal.es_mi_certificado(c);
  r := portal.mi_certificado(c);
  RESET ROLE;
  PERFORM pg_temp.rg(9, 'Certificado ajeno desde el portal', 'no es suyo · vacío',
    CASE WHEN es THEN 'ES SUYO (mal)' ELSE 'no es suyo' END || ' · ' || CASE WHEN r IS NULL THEN 'vacío' ELSE 'CON DATOS' END,
    NOT es AND r IS NULL);
END $$;

\echo ''
\echo '===== EL PORTAL DEL CONGREGANTE ====='
SELECT n AS "#", caso AS invariante, obtenido AS resultado,
       CASE WHEN pasa THEN 'PASA' ELSE 'FALLA' END AS veredicto
FROM p_res ORDER BY n;
SELECT count(*) FILTER (WHERE pasa) AS pasan,
       count(*) FILTER (WHERE NOT pasa) AS fallan, count(*) AS total FROM p_res;
DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT pasa) INTO v FROM p_res;
  IF v > 0 THEN RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en portal.sql', v; END IF;
END $$;
ROLLBACK;
