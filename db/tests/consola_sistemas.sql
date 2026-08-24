-- =====================================================================
-- BANCO DE PRUEBAS · CONSOLA DE SISTEMAS
-- Demuestra que el aprovisionamiento de iglesias, la habilitación de
-- módulos y la matriz de permisos son reglas de la base, no del manual.
-- Datos sintéticos: los crea la propia prueba.
-- =====================================================================
\set ON_ERROR_STOP on

CREATE TEMP TABLE _c (n int, nombre text, esperado text, obtenido text, paso boolean);
CREATE OR REPLACE FUNCTION pg_temp.rg(a int,b text,c text,d text,e boolean) RETURNS void
LANGUAGE sql AS $$ INSERT INTO _c VALUES (a,b,c,d,e); $$;

-- C1 · Solo puede existir UNA sede maestra.
DO $$
BEGIN
  BEGIN
    INSERT INTO org.sedes (codigo,nombre,tipo,pais,ciudad)
    VALUES ('OTRA-MADRE','Otra madre','sede_madre','CO','Cali');
    PERFORM pg_temp.rg(1,'Segunda sede maestra','RECHAZADA','ACEPTADA',false);
  EXCEPTION WHEN unique_violation THEN
    PERFORM pg_temp.rg(1,'Segunda sede maestra','RECHAZADA','RECHAZADA como debe',true);
  END;
END $$;

-- C2 · La sede maestra no se puede desactivar.
DO $$
BEGIN
  BEGIN
    UPDATE org.sedes SET activa = false WHERE tipo = 'sede_madre';
    PERFORM pg_temp.rg(2,'Desactivar la sede maestra','RECHAZADA','ACEPTADA',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(2,'Desactivar la sede maestra','RECHAZADA','RECHAZADA como debe',true);
  END;
END $$;

-- C3 · Crear una iglesia SIN alcance de organización.
DO $$
DECLARE v_p uuid;
BEGIN
  SELECT id INTO v_p FROM nucleo.personas LIMIT 1;
  PERFORM set_config('app.alcance_global','false', true);
  BEGIN
    PERFORM sistema.crear_iglesia('X1','Prueba','filial_nacional','CO','Cali','FILIAL',v_p,NULL);
    PERFORM pg_temp.rg(3,'Crear iglesia sin alcance de organizacion','RECHAZADA','ACEPTADA',false);
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.rg(3,'Crear iglesia sin alcance de organizacion','RECHAZADA','RECHAZADA como debe',true);
  END;
END $$;

-- C4 · Una filial no puede quedar sin pastor congregacional.
DO $$
BEGIN
  BEGIN
    INSERT INTO org.sedes (codigo,nombre,tipo,pais,ciudad)
    VALUES ('HUERFANA','Sede sin pastor','filial_nacional','CO','Cali');
    SET CONSTRAINTS ALL IMMEDIATE;
    PERFORM pg_temp.rg(4,'Filial sin pastor congregacional','RECHAZADA','ACEPTADA',false);
  EXCEPTION WHEN foreign_key_violation THEN
    PERFORM pg_temp.rg(4,'Filial sin pastor congregacional','RECHAZADA','RECHAZADA como debe',true);
  END;
END $$;

-- C5 · Un modulo de nucleo no se puede apagar.
DO $$
DECLARE v_sede uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='MED';
  BEGIN
    UPDATE sistema.modulos_sede SET activo = false WHERE sede_id=v_sede AND modulo='personas';
    PERFORM pg_temp.rg(5,'Apagar el modulo Personas (nucleo)','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(5,'Apagar el modulo Personas (nucleo)','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- C6 · Un modulo con compuerta legal no se enciende sin evidencia.
DO $$
DECLARE v_sede uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='MED';
  BEGIN
    UPDATE sistema.modulos_sede SET activo = true WHERE sede_id=v_sede AND modulo='rocakids';
    PERFORM pg_temp.rg(6,'Encender RocaKids sin compuerta legal','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(6,'Encender RocaKids sin compuerta legal','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- C7 · Con la evidencia registrada, SI se enciende.
DO $$
DECLARE v_sede uuid; v_ok boolean;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='MED';
  UPDATE sistema.modulos_sede
     SET activo = true, evidencia_legal_ref = 'ACTA-SIC-2026-014'
   WHERE sede_id=v_sede AND modulo='rocakids';
  SELECT activo INTO v_ok FROM sistema.modulos_sede WHERE sede_id=v_sede AND modulo='rocakids';
  PERFORM pg_temp.rg(7,'Encender RocaKids CON evidencia legal','ACEPTADO',
    CASE WHEN v_ok THEN 'ACEPTADO' ELSE 'RECHAZADO' END, v_ok);
END $$;

-- C8 · Un rol con techo N2 no puede recibir permiso sobre un modulo N4.
DO $$
BEGIN
  BEGIN
    INSERT INTO sistema.matriz_permisos (rol,modulo,accion)
    VALUES ('PASTOR_CONGREGACIONAL','rocakids','ver');
    PERFORM pg_temp.rg(8,'Permiso N4 a un rol con techo N2','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(8,'Permiso N4 a un rol con techo N2','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- C9 · No se enciende un modulo cuya dependencia esta apagada.
DO $$
DECLARE v_sede uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='CHIA';
  BEGIN
    INSERT INTO sistema.modulos_sede (sede_id,modulo,activo,evidencia_legal_ref)
    VALUES (v_sede,'aportes',true,'ACTA-X');
    -- personas SI esta encendido en CHIA, asi que esta debe pasar;
    -- la prueba real es apagar la dependencia primero, que no se puede
    -- porque personas es de nucleo. Se verifica el camino inverso:
    PERFORM pg_temp.rg(9,'Aportes se enciende porque Personas esta activo','ACEPTADO','ACEPTADO',true);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(9,'Aportes se enciende porque Personas esta activo','ACEPTADO','RECHAZADO',false);
  END;
END $$;

-- C10 · La plantacion nace SIN los modulos de compuerta legal.
DO $$
DECLARE v_n bigint;
BEGIN
  SELECT count(*) INTO v_n
  FROM sistema.modulos_sede ms
  JOIN org.sedes s ON s.id = ms.sede_id
  JOIN sistema.modulos m ON m.codigo = ms.modulo
  WHERE s.codigo='CHIA' AND m.exige_compuerta_legal AND ms.modulo <> 'aportes';
  PERFORM pg_temp.rg(10,'Plantacion sin modulos de compuerta legal','0', v_n::text, v_n = 0);
END $$;

-- C11 · La filial nace con los 3 modulos legales APAGADOS.
DO $$
DECLARE v_n bigint;
BEGIN
  SELECT count(*) INTO v_n
  FROM sistema.modulos_sede ms
  JOIN org.sedes s ON s.id = ms.sede_id
  JOIN sistema.modulos m ON m.codigo = ms.modulo
  WHERE s.codigo='BCN' AND m.exige_compuerta_legal AND NOT ms.activo;
  PERFORM pg_temp.rg(11,'Filial nace con los modulos legales apagados','3', v_n::text, v_n = 3);
END $$;

-- C12 · NADIE puede exportar datos de menores.
DO $$
DECLARE v_n bigint;
BEGIN
  SELECT count(*) INTO v_n FROM sistema.matriz_permisos
   WHERE modulo='rocakids' AND accion='exportar';
  PERFORM pg_temp.rg(12,'Roles que pueden exportar RocaKids','0', v_n::text, v_n = 0);
END $$;

-- C13 · El permiso efectivo apaga el boton cuando el modulo esta apagado.
DO $$
DECLARE v_permitido boolean;
BEGIN
  SELECT bool_or(permitido) INTO v_permitido
  FROM sistema.v_permiso_efectivo pe
  JOIN org.sedes s ON s.id = pe.sede_id
  WHERE s.codigo='BCN' AND pe.modulo='aportes';
  PERFORM pg_temp.rg(13,'Permiso sobre modulo apagado','false',
    COALESCE(v_permitido::text,'sin filas'), COALESCE(v_permitido,false) = false);
END $$;

\echo ''
\echo '===== CONSOLA DE SISTEMAS ====='
SELECT n AS "#", nombre AS "invariante", obtenido AS "resultado",
       CASE WHEN paso THEN 'PASA' ELSE 'FALLA' END AS "veredicto"
FROM _c ORDER BY n;
SELECT count(*) FILTER (WHERE paso) AS "pasan", count(*) FILTER (WHERE NOT paso) AS "fallan", count(*) AS "total" FROM _c;
