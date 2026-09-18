-- =====================================================================
-- Banco: LAS TABLAS HIJAS (migración 0031)
--
-- La fuga del 11 de septiembre existió porque el banco probaba las tablas
-- cabeza. Estas pruebas miran donde nadie estaba mirando.
-- =====================================================================
\set ON_ERROR_STOP on
CREATE TEMP TABLE res(n int, caso text, esperado text, obtenido text, pasa boolean);
CREATE FUNCTION pg_temp.rg(a int, b text, c text, d text, e boolean) RETURNS void
LANGUAGE sql AS $$ INSERT INTO res VALUES (a,b,c,d,e) $$;

-- H1 · Una sede sin personas no debe ver NADA de otra sede.
DO $$
DECLARE vacia uuid; poblada uuid; n_vacia int; n_poblada int;
BEGIN
  SELECT s.id INTO poblada FROM org.sedes s
    JOIN nucleo.personas p ON p.sede_id=s.id GROUP BY s.id ORDER BY count(*) DESC LIMIT 1;
  SELECT s.id INTO vacia FROM org.sedes s
    WHERE NOT EXISTS (SELECT 1 FROM nucleo.personas p WHERE p.sede_id=s.id) LIMIT 1;

  SET LOCAL ROLE casaroca_app;
  PERFORM set_config('app.sede_ids','{'||vacia::text||'}',true);
  PERFORM set_config('app.nivel_max','4',true);
  SELECT count(*) INTO n_vacia FROM aportes.certificados;
  RESET ROLE;

  PERFORM pg_temp.rg(1,'Sede sin personas ve certificados de aporte ajenos',
    '0 filas', n_vacia||' filas', n_vacia = 0);
END $$;

-- H2 · Lo mismo para inscripciones de formación.
DO $$
DECLARE vacia uuid; n int;
BEGIN
  SELECT s.id INTO vacia FROM org.sedes s
    WHERE NOT EXISTS (SELECT 1 FROM nucleo.personas p WHERE p.sede_id=s.id) LIMIT 1;
  SET LOCAL ROLE casaroca_app;
  PERFORM set_config('app.sede_ids','{'||vacia::text||'}',true);
  PERFORM set_config('app.nivel_max','4',true);
  SELECT count(*) INTO n FROM formacion.inscripciones;
  RESET ROLE;
  PERFORM pg_temp.rg(2,'Sede sin personas ve inscripciones ajenas','0 filas', n||' filas', n = 0);
END $$;

-- H3 · Sin contexto de sede, ninguna tabla hija devuelve una sola fila.
DO $$
DECLARE total int;
BEGIN
  SET LOCAL ROLE casaroca_app;
  PERFORM set_config('app.nivel_max','4',true);
  SELECT (SELECT count(*) FROM rocakids.inscripciones)
       + (SELECT count(*) FROM rocakids.autorizaciones)
       + (SELECT count(*) FROM nucleo.vinculos)
       + (SELECT count(*) FROM grupos.membresias)
       + (SELECT count(*) FROM asistencia.entradas)
       + (SELECT count(*) FROM consejeria.asignaciones) INTO total;
  RESET ROLE;
  PERFORM pg_temp.rg(3,'Sesion SIN contexto de sede lee tablas hijas','0 filas', total||' filas', total = 0);
END $$;

-- H4 · La aplicacion NO puede reescribir la matriz de permisos.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    SET LOCAL ROLE casaroca_app;
    UPDATE sistema.matriz_permisos SET nivel_max = 4;
    RESET ROLE;
  EXCEPTION WHEN insufficient_privilege THEN
    ok := true; RESET ROLE;
  END;
  PERFORM pg_temp.rg(4,'La app se sube su propio techo de permisos',
    'RECHAZADO', CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO' END, ok);
END $$;

-- H5 · Tampoco puede inventarse un rol nuevo.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    SET LOCAL ROLE casaroca_app;
    INSERT INTO identidad.roles (codigo,nombre) VALUES ('DIOS','todo');
    RESET ROLE;
  EXCEPTION WHEN insufficient_privilege THEN ok := true; RESET ROLE;
            WHEN others THEN ok := true; RESET ROLE;
  END;
  PERFORM pg_temp.rg(5,'La app se inventa un rol nuevo',
    'RECHAZADO', CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO' END, ok);
END $$;

-- H6 · El control: ninguna tabla legible por la app sin una sola politica.
DO $$
DECLARE fugas int; detalle text;
BEGIN
  SELECT count(*), coalesce(string_agg(esquema||'.'||tabla,', '),'ninguna')
    INTO fugas, detalle
  FROM plataforma.v_control_rls
  WHERE la_app_la_lee AND politicas = 0
    AND (esquema,tabla) NOT IN (
      -- catalogos compartidos por las 36 sedes: no llevan datos de persona
      ('nucleo','tipos_documento'),('nucleo','tipos_vinculo'),
      ('org','paises'),('org','sedes'),('org','ministerios'),('org','ministerios_sede'),
      ('plataforma','finalidades'),('plataforma','niveles_sensibilidad'),
      ('plataforma','clasificacion_columna'),
      ('crm','tipos_hecho'),('identidad','roles'),
      ('rocakids','salas'),('consejeria','topicos'),('aportes','fondos'),
      ('talento','cargos'),('formacion','cursos'),('formacion','programas'),
      ('sistema','modulos'),('sistema','acciones'),('sistema','plantillas'),
      ('sistema','plantilla_modulos'),('sistema','matriz_permisos'),
      -- 0040: nombres del Drive 100p apuntando a roles y acciones existentes
      ('identidad','roles_alias'),('sistema','acciones_alias'));
  PERFORM pg_temp.rg(6,'Tablas con datos de persona legibles sin politica',
    'ninguna', detalle, fugas = 0);
END $$;

\echo ''
\echo '===== TABLAS HIJAS: LA TERCERA CERRADURA ====='
SELECT n AS "#", caso AS invariante, obtenido AS resultado,
       CASE WHEN pasa THEN 'PASA' ELSE 'FALLA' END AS veredicto
FROM res ORDER BY n;
SELECT count(*) FILTER (WHERE pasa) AS pasan,
       count(*) FILTER (WHERE NOT pasa) AS fallan, count(*) AS total FROM res;
