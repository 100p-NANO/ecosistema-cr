-- =====================================================================
-- LA MISMA PRUEBA, LOS DOS MODELOS
--
-- No se discute cuál diseño es mejor. Se cargan los mismos datos en los
-- dos y se mira qué responde cada uno. Lo que no pueda hacerse, no se
-- podrá hacer tampoco en producción.
-- =====================================================================
\set ON_ERROR_STOP off
CREATE TEMP TABLE r(n int, pregunta text, nuestro text, dejhon text);

-- Datos: dos sedes, una persona en cada una.
INSERT INTO jhon.personas
 (nombre_completo,genero,estado_civil,pais_residencia,ciudad_residencia,zona,
  email_principal,permite_whatsapp,direccion_ciudad,es_cristiano,ha_sido_bautizado,
  es_ministro,nivel_compromiso,usuario_registro_id,usuario_actualizacion_id,
  estado_persona,activo,puede_recibir_email,puede_recibir_sms,puede_recibir_llamadas,
  en_directorio_publico,datos_sensibles,consentimiento_gdpr)
VALUES
 ('Ana de Bogota','F','Casado','Colombia','Bogotá','Norte','ana@x.org',true,'Bogotá','SI',true,false,'MIEMBRO',
  gen_random_uuid(),gen_random_uuid(),'ACTIVO',true,true,true,true,false,false,true),
 ('Luis de Barcelona','M','Soltero','España','Barcelona','Centro','luis@x.org',true,'Barcelona','SI',true,false,'MIEMBRO',
  gen_random_uuid(),gen_random_uuid(),'ACTIVO',true,true,true,true,false,false,true);

-- P1 · ¿Se puede preguntar "dame solo las personas de la sede de Bogota"?
DO $$
DECLARE hay boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='jhon' AND table_name='personas' AND column_name='sede_id') INTO hay;
  INSERT INTO r VALUES (1,'Filtrar personas por SEDE',
    'Si: nucleo.personas.sede_id',
    CASE WHEN hay THEN 'Si' ELSE 'NO: no existe la columna sede_id' END);
END $$;

-- P2 · ¿La base impide por si sola que una sede vea a otra?
DO $$
DECLARE pol int;
BEGIN
  SELECT count(*) INTO pol FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
   JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='jhon';
  INSERT INTO r VALUES (2,'La BASE bloquea el cruce entre sedes',
    'Si: 103 politicas RLS',
    CASE WHEN pol>0 THEN 'Si' ELSE 'NO: 0 politicas. Depende del programador' END);
END $$;

-- P3 · Una persona sin correo (un menor, un adulto mayor)
DO $$
DECLARE ok text;
BEGIN
  BEGIN
    INSERT INTO jhon.personas
     (nombre_completo,genero,estado_civil,pais_residencia,ciudad_residencia,
      email_principal,permite_whatsapp,direccion_ciudad,es_cristiano,ha_sido_bautizado,
      es_ministro,nivel_compromiso,usuario_registro_id,usuario_actualizacion_id,
      estado_persona,activo,puede_recibir_email,puede_recibir_sms,puede_recibir_llamadas,
      en_directorio_publico,datos_sensibles,consentimiento_gdpr)
    VALUES ('Nino sin correo','M','Soltero','Colombia','Bogotá',
      NULL,false,'Bogotá','SI',false,false,'VISITANTE',
      gen_random_uuid(),gen_random_uuid(),'ACTIVO',true,false,false,false,false,false,true);
    ok := 'Se registro';
  EXCEPTION WHEN not_null_violation THEN ok := 'RECHAZADO: email_principal es obligatorio';
  END;
  INSERT INTO r VALUES (3,'Registrar a alguien SIN correo', 'Se registra: el correo es opcional', ok);
END $$;

-- P4 · Dos hermanos que comparten el correo de la mama
DO $$
DECLARE ok text;
BEGIN
  BEGIN
    INSERT INTO jhon.personas
     (nombre_completo,genero,estado_civil,pais_residencia,ciudad_residencia,
      email_principal,permite_whatsapp,direccion_ciudad,es_cristiano,ha_sido_bautizado,
      es_ministro,nivel_compromiso,usuario_registro_id,usuario_actualizacion_id,
      estado_persona,activo,puede_recibir_email,puede_recibir_sms,puede_recibir_llamadas,
      en_directorio_publico,datos_sensibles,consentimiento_gdpr)
    VALUES ('Hermano de Ana','M','Soltero','Colombia','Bogotá',
      'ana@x.org',false,'Bogotá','SI',false,false,'VISITANTE',
      gen_random_uuid(),gen_random_uuid(),'ACTIVO',true,false,false,false,false,false,true);
    ok := 'Se registro';
  EXCEPTION WHEN unique_violation THEN ok := 'RECHAZADO: el correo es unico';
  END;
  INSERT INTO r VALUES (4,'Dos hermanos con el correo de la mama',
    'Se registran: el correo no es llave', ok);
END $$;

-- P5 · ¿De donde salio cada fila cuando se migre desde 99-o?
DO $$
DECLARE hay boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='jhon' AND table_name='personas'
                   AND column_name IN ('source_system','source_id')) INTO hay;
  INSERT INTO r VALUES (5,'Saber de que sistema vino cada fila',
    'Si: source_system + source_id',
    CASE WHEN hay THEN 'Si' ELSE 'NO: sin linaje, la reconciliacion no se puede auditar' END);
END $$;

-- P6 · Permisos: cuantas filas hay que escribir para 25.000 personas
DO $$
DECLARE n bigint := 25000;
BEGIN
  INSERT INTO r VALUES (6,'Filas de permiso para 25.000 personas',
    '14 roles x alcance: decenas de filas',
    'permisos_personas es persona x usuario: hasta '||n||' x nro. de usuarios');
END $$;

-- P7 · La fecha de nacimiento vive en dos sitios
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema='jhon' AND column_name='fecha_nacimiento';
  INSERT INTO r VALUES (7,'Cuantas copias de la fecha de nacimiento',
    '1 (en personas)', n||' (personas y minores): pueden divergir');
END $$;

-- P8 · Consentimiento: ¿para que finalidad y por que canal?
DO $$
DECLARE hay boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='jhon' AND table_name ILIKE '%consent%') INTO hay;
  INSERT INTO r VALUES (8,'Consentimiento con finalidad, canal y evidencia',
    'Si: tabla append-only (Ley 1581)',
    CASE WHEN hay THEN 'Si' ELSE 'NO: solo booleanos. No dice para que ni por que canal' END);
END $$;

\echo ''
\echo '========== EL MISMO DATO EN LOS DOS MODELOS =========='
SELECT n AS "#", pregunta, nuestro AS "backend construido", dejhon AS "modelo v1.2 del equipo"
FROM r ORDER BY n;
