-- =====================================================================
-- Banco: LA BANDEJA DE SALIDA AGUANTA (migración 0073)
--
-- ⛔ Por qué existe. El trabajador de avisos nunca había tomado un solo
--    aviso: sin la llave de SendGrid se retira antes de empezar. Por eso
--    nadie vio que `tomar_notificaciones` escribía un estado («enviando»)
--    que el enumerado NO TENÍA: la primera corrida real habría reventado
--    en cada lote. Este banco recorre la cola entera sin proveedor.
--
--    Corre dentro de UNA transacción que se deshace al final: la cola de
--    la base de desarrollo queda como estaba.
-- =====================================================================
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE b_res(n int, caso text, esperado text, obtenido text, pasa boolean) ON COMMIT DROP;
CREATE FUNCTION pg_temp.rg(a int, b text, c text, d text, e boolean) RETURNS void
LANGUAGE sql AS $$ INSERT INTO b_res VALUES (a,b,c,d,e) $$;

-- Lo que ya estuviera en la cola se aparta, para que el banco solo toque lo suyo.
UPDATE plataforma.notificaciones SET proximo_intento = now() + interval '1 day'
 WHERE estado = 'pendiente';

CREATE TEMP TABLE blab(k text PRIMARY KEY, v uuid) ON COMMIT DROP;
WITH x AS (
  INSERT INTO plataforma.notificaciones (sede_id, destinatario, canal, plantilla, datos, origen_modulo, estado, intentos, finalidad)
  VALUES ((SELECT id FROM org.sedes WHERE codigo='BOG-CHICO'), 'banco.bandeja@example.org', 'email',
          'Bienvenida_nuevo', '{}', 'banco_bandeja', 'pendiente', 0, 'administrativa')
  RETURNING id)
INSERT INTO blab SELECT 'uno', id FROM x;

-- B1 · ⭐ Tomar un aviso funciona (antes: estado inexistente, todo el lote reventaba).
DO $$
DECLARE v uuid := (SELECT v FROM blab WHERE k='uno'); ok boolean; est text; n int;
BEGIN
  ok := EXISTS (SELECT 1 FROM plataforma.tomar_notificaciones(50) t WHERE t.id = v);
  SELECT estado::text, intentos INTO est, n FROM plataforma.notificaciones WHERE id = v;
  PERFORM pg_temp.rg(1, 'Tomar un aviso de la cola', 'tomado · enviando · 1 intento',
    CASE WHEN ok THEN 'tomado' ELSE 'no tomado' END || ' · ' || est || ' · ' || n || ' intento', ok AND est = 'enviando' AND n = 1);
END $$;

-- B2 · Un fallo pasajero vuelve a la cola CON ESPERA, no en el minuto siguiente.
DO $$
DECLARE v uuid := (SELECT v FROM blab WHERE k='uno'); est text; espera int;
BEGIN
  est := plataforma.marcar_notificacion(v, false, 'SendGrid respondió 503', NULL, false, NULL);
  SELECT EXTRACT(epoch FROM proximo_intento - now())::int INTO espera FROM plataforma.notificaciones WHERE id = v;
  PERFORM pg_temp.rg(2, 'Fallo pasajero · vuelve a la cola con espera creciente', 'pendiente · 120 a 150 s',
    est || ' · ' || espera || ' s', est = 'pendiente' AND espera BETWEEN 120 AND 150);
END $$;

-- B3 · Mientras espera, no se toma.
DO $$
DECLARE v uuid := (SELECT v FROM blab WHERE k='uno'); ok boolean;
BEGIN
  ok := NOT EXISTS (SELECT 1 FROM plataforma.tomar_notificaciones(50) t WHERE t.id = v);
  PERFORM pg_temp.rg(3, 'Un aviso en espera se vuelve a tomar antes de tiempo', 'no se toma',
    CASE WHEN ok THEN 'no se toma' ELSE 'SE TOMÓ (mal)' END, ok);
END $$;

-- B4 · Si el proveedor dice cuándo volver (Retry-After), manda eso.
DO $$
DECLARE v uuid := (SELECT v FROM blab WHERE k='uno'); espera int;
BEGIN
  UPDATE plataforma.notificaciones SET proximo_intento = now() - interval '1 second' WHERE id = v;
  PERFORM 1 FROM plataforma.tomar_notificaciones(50);
  PERFORM plataforma.marcar_notificacion(v, false, 'SendGrid respondió 429', NULL, false, 900);
  SELECT EXTRACT(epoch FROM proximo_intento - now())::int INTO espera FROM plataforma.notificaciones WHERE id = v;
  PERFORM pg_temp.rg(4, 'Retry-After del proveedor · se respeta', '900 s', espera || ' s', espera = 900);
END $$;

-- B5 · Un error DEFINITIVO no se reintenta: muere de una vez, y dice por qué.
DO $$
DECLARE v uuid := (SELECT v FROM blab WHERE k='uno'); est text; err text;
BEGIN
  UPDATE plataforma.notificaciones SET proximo_intento = now() - interval '1 second' WHERE id = v;
  PERFORM 1 FROM plataforma.tomar_notificaciones(50);
  est := plataforma.marcar_notificacion(v, false, 'SendGrid respondió 400: dirección inválida', NULL, true, NULL);
  SELECT ultimo_error INTO err FROM plataforma.notificaciones WHERE id = v;
  PERFORM pg_temp.rg(5, 'Error definitivo · no gasta cinco intentos', 'fallida · Definitivo',
    est || ' · ' || split_part(err, ':', 1), est = 'fallida' AND err LIKE 'Definitivo:%');
END $$;

-- B6 · Tras cinco fallos pasajeros, a la cola de muertos.
DO $$
DECLARE v uuid; est text;
BEGIN
  INSERT INTO plataforma.notificaciones (sede_id, destinatario, canal, plantilla, datos, origen_modulo, estado, intentos, finalidad)
  VALUES ((SELECT id FROM org.sedes WHERE codigo='BOG-CHICO'), 'banco.cinco@example.org', 'email',
          'Bienvenida_nuevo', '{}', 'banco_bandeja', 'enviando', 5, 'administrativa') RETURNING id INTO v;
  est := plataforma.marcar_notificacion(v, false, 'SendGrid respondió 503', NULL, false, NULL);
  PERFORM pg_temp.rg(6, 'Quinto fallo pasajero · va a la cola de muertos', 'fallida', est, est = 'fallida');
END $$;

-- B7 · ⭐ Lo que quedó «enviando» porque el trabajador se cayó, se rescata.
DO $$
DECLARE v uuid; ok boolean;
BEGIN
  INSERT INTO plataforma.notificaciones (sede_id, destinatario, canal, plantilla, datos, origen_modulo, estado, intentos, finalidad, tomada_en)
  VALUES ((SELECT id FROM org.sedes WHERE codigo='BOG-CHICO'), 'banco.atascado@example.org', 'email',
          'Bienvenida_nuevo', '{}', 'banco_bandeja', 'enviando', 1, 'administrativa', now() - interval '11 minutes')
  RETURNING id INTO v;
  ok := EXISTS (SELECT 1 FROM plataforma.tomar_notificaciones(50) t WHERE t.id = v);
  PERFORM pg_temp.rg(7, 'Un aviso atascado en «enviando» se queda ahí para siempre', 'rescatado y tomado',
    CASE WHEN ok THEN 'rescatado y tomado' ELSE 'SIGUE ATASCADO' END, ok);
END $$;

-- B8 · Reprocesar un muerto exige identidad…
DO $$
DECLARE v uuid := (SELECT v FROM blab WHERE k='uno'); ok boolean := false;
BEGIN
  PERFORM set_config('app.persona_id', '', true);
  BEGIN PERFORM plataforma.reprocesar_aviso(v, 'Se corrigió la dirección');
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  PERFORM pg_temp.rg(8, 'Reprocesar un aviso muerto sin sesión', 'RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- B9 · …y con quien administra, vuelve a la cola con su motivo en la auditoría.
DO $$
DECLARE v uuid := (SELECT v FROM blab WHERE k='uno'); est text; n int; mot text;
BEGIN
  PERFORM set_config('app.persona_id',
    (SELECT a.persona_id::text FROM identidad.asignaciones a
      WHERE a.rol='PASTOR_DIRECTOR_GENERAL' AND a.revocada_en IS NULL LIMIT 1), true);
  PERFORM set_config('app.alcance_global', 'true', true);
  PERFORM plataforma.reprocesar_aviso(v, 'Se corrigió la dirección del destinatario');
  SELECT estado::text, intentos INTO est, n FROM plataforma.notificaciones WHERE id = v;
  SELECT motivo INTO mot FROM plataforma.auditoria WHERE tabla='notificaciones' AND fila_id = v::text ORDER BY id DESC LIMIT 1;
  PERFORM pg_temp.rg(9, 'Reprocesar · vuelve a la cola desde cero, con su motivo', 'pendiente · 0 · con motivo',
    est || ' · ' || n || ' · ' || CASE WHEN mot IS NOT NULL THEN 'con motivo' ELSE 'sin motivo' END,
    est = 'pendiente' AND n = 0 AND mot = 'Se corrigió la dirección del destinatario');
END $$;

-- B10 · Los cuatro números de la bandeja existen y cuadran.
DO $$
DECLARE r record; m int;
BEGIN
  SELECT * INTO r FROM plataforma.v_salud_avisos;
  SELECT count(*) INTO m FROM plataforma.notificaciones WHERE estado = 'fallida';
  PERFORM pg_temp.rg(10, 'La salud de la bandeja no cuadra con la tabla', 'muertos = fallidas',
    r.muertos || ' = ' || m, r.muertos = m);
END $$;

\echo ''
\echo '===== LA BANDEJA DE SALIDA AGUANTA ====='
SELECT n AS "#", caso AS invariante, obtenido AS resultado,
       CASE WHEN pasa THEN 'PASA' ELSE 'FALLA' END AS veredicto
FROM b_res ORDER BY n;
SELECT count(*) FILTER (WHERE pasa) AS pasan,
       count(*) FILTER (WHERE NOT pasa) AS fallan, count(*) AS total FROM b_res;

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT pasa) INTO v FROM b_res;
  IF v > 0 THEN RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en bandeja_de_salida.sql', v; END IF;
END $$;
ROLLBACK;
