-- =====================================================================
-- 0073 · LA BANDEJA DE SALIDA AGUANTA
--
-- ⛔ QUÉ LE FALTABA (estaciones 20, 21 y 26 del manual). La cola de avisos
--    ya tenía tope de cinco intentos, pero:
--    · un aviso que fallaba volvía a «pendiente» y se reintentaba en el
--      minuto siguiente: cinco golpes seguidos contra un proveedor caído,
--      y el aviso muerto en cinco minutos por una caída de diez;
--    · si el trabajador se caía a mitad de un lote, los avisos quedaban en
--      «enviando» PARA SIEMPRE: nadie los devolvía a la cola;
--    · un correo mal escrito (error definitivo) se reintentaba cinco veces
--      igual que una caída pasajera;
--    · no había forma de ver los avisos muertos ni de reprocesarlos sin
--      entrar a la base.
--
-- ⛔ Y UN DEFECTO LATENTE que habría parado todo el correo el día que se
--    configure SendGrid: `tomar_notificaciones` pone el estado «enviando»,
--    y ese valor NO EXISTÍA en `plataforma.estado_notificacion`. No había
--    fallado nunca porque, sin la llave, el trabajador no llega a tomar
--    nada. La primera corrida real habría reventado en cada lote.
-- =====================================================================

-- Va FUERA de la transacción: un valor nuevo de un enumerado no se puede
-- usar en la misma transacción que lo crea.
ALTER TYPE plataforma.estado_notificacion ADD VALUE IF NOT EXISTS 'enviando' AFTER 'pendiente';

BEGIN;

ALTER TABLE plataforma.notificaciones
  ADD COLUMN IF NOT EXISTS proximo_intento timestamptz,
  ADD COLUMN IF NOT EXISTS tomada_en       timestamptz;

CREATE INDEX IF NOT EXISTS notificaciones_por_tomar
  ON plataforma.notificaciones (proximo_intento NULLS FIRST, creada_en)
  WHERE estado = 'pendiente';

-- ── a · Tomar: respeta la espera y rescata lo atascado ───────────────
CREATE OR REPLACE FUNCTION plataforma.tomar_notificaciones(p_limite integer DEFAULT 50)
RETURNS TABLE(id uuid, canal plataforma.canal_contacto, destinatario text, plantilla text, datos jsonb, persona_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN
  /* ⛔ Rescate: lo que lleva más de diez minutos «enviando» es de un
     trabajador que se cayó a mitad de lote. Vuelve a la cola; el intento
     ya se contó al tomarlo. */
  UPDATE plataforma.notificaciones n
     SET estado = 'pendiente', ultimo_error = 'Rescatado: el trabajador no terminó el envío',
         proximo_intento = now()
   WHERE n.estado = 'enviando' AND n.tomada_en < now() - interval '10 minutes';

  UPDATE plataforma.notificaciones n
     SET estado = 'descartada', ultimo_error = 'Consentimiento revocado antes del envío'
   WHERE n.estado = 'pendiente' AND n.persona_id IS NOT NULL
     AND COALESCE(n.finalidad,'convocatoria') <> 'emergencia'
     AND NOT plataforma.puede_contactar(n.persona_id, n.canal, COALESCE(n.finalidad,'convocatoria'));

  RETURN QUERY
  UPDATE plataforma.notificaciones n
     SET estado = 'enviando', intentos = n.intentos + 1, tomada_en = now()
   WHERE n.id IN (SELECT x.id FROM plataforma.notificaciones x
                   WHERE x.estado = 'pendiente'
                     AND (x.proximo_intento IS NULL OR x.proximo_intento <= now())
                   ORDER BY x.proximo_intento NULLS FIRST, x.creada_en
                   LIMIT p_limite
                   FOR UPDATE SKIP LOCKED)
  RETURNING n.id, n.canal, n.destinatario, n.plantilla, n.datos, n.persona_id;
END $$;

-- ── b · Marcar: espera creciente, y lo definitivo no se reintenta ────
/* Espera tras el intento n: 2^n minutos (2, 4, 8, 16) con hasta un 25 %
   aleatorio para que un lote caído no vuelva todo junto. Si el proveedor
   dijo cuándo volver (`p_esperar_segundos`, de Retry-After), manda eso. */
DROP FUNCTION IF EXISTS plataforma.marcar_notificacion(uuid, boolean, text, text);
CREATE FUNCTION plataforma.marcar_notificacion(
  p_id uuid, p_enviada boolean, p_error text, p_proveedor_id text,
  p_definitivo boolean DEFAULT false, p_esperar_segundos integer DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = plataforma, pg_temp AS $$
DECLARE v_n smallint; v_estado plataforma.estado_notificacion;
BEGIN
  SELECT intentos INTO v_n FROM plataforma.notificaciones WHERE id = p_id;
  v_estado := CASE WHEN p_enviada THEN 'enviada'
                   WHEN p_definitivo OR v_n >= 5 THEN 'fallida'
                   ELSE 'pendiente' END;
  UPDATE plataforma.notificaciones
     SET estado       = v_estado,
         enviada_en   = CASE WHEN p_enviada THEN now() END,
         ultimo_error = CASE WHEN p_enviada THEN NULL
                             WHEN p_definitivo THEN 'Definitivo: ' || p_error
                             ELSE p_error END,
         proveedor_id = COALESCE(p_proveedor_id, proveedor_id),
         proximo_intento = CASE WHEN v_estado = 'pendiente'
           THEN now() + COALESCE(make_interval(secs => p_esperar_segundos),
                                 make_interval(secs => (60 * power(2, GREATEST(v_n, 1)))
                                                        * (1 + random() * 0.25)))
           END
   WHERE id = p_id;
  RETURN v_estado::text;
END $$;
REVOKE ALL ON FUNCTION plataforma.marcar_notificacion(uuid, boolean, text, text, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma.marcar_notificacion(uuid, boolean, text, text, boolean, integer) TO casaroca_app;

-- ── c · Los cuatro números de la bandeja ─────────────────────────────
CREATE OR REPLACE VIEW plataforma.v_salud_avisos WITH (security_invoker = true) AS
SELECT count(*) FILTER (WHERE estado = 'pendiente')                          AS pendientes,
       count(*) FILTER (WHERE estado = 'pendiente' AND proximo_intento > now()) AS esperando_reintento,
       count(*) FILTER (WHERE estado = 'enviando')                           AS enviando,
       count(*) FILTER (WHERE estado = 'fallida')                            AS muertos,
       EXTRACT(epoch FROM now() - min(creada_en) FILTER (WHERE estado = 'pendiente'))::int AS segundos_del_mas_viejo,
       max(enviada_en)                                                       AS ultimo_envio
  FROM plataforma.notificaciones;
/* Cerrada a la aplicación: se lee por `plataforma.salud_avisos()`, con la
   guardia de administración adentro. Exponerla es un acto firmado. */
INSERT INTO plataforma.registro_exposicion (esquema, tabla, modo, justificacion, decidido_por, decidido_en)
VALUES ('plataforma', 'v_salud_avisos', 'cerrada',
        'Salud de la bandeja de salida. La aplicacion la lee por la funcion salud_avisos(), que exige administrar identidad.',
        'Construccion del 21 sep 2026', DATE '2026-09-21')
ON CONFLICT DO NOTHING;

COMMENT ON VIEW plataforma.v_salud_avisos IS
  'Los cuatro números que se vigilan de la bandeja de salida (estación 20 del manual): retraso, pendientes, muertos y salud del trabajador (último envío).';

-- ── d · Ver y reprocesar lo muerto, con guardia ──────────────────────
CREATE OR REPLACE FUNCTION plataforma.ver_avisos(p_estado text DEFAULT 'fallida', p_limite integer DEFAULT 100)
RETURNS TABLE(id uuid, sede text, destinatario text, canal text, plantilla text, estado text,
              intentos smallint, ultimo_error text, creada_en timestamptz, proximo_intento timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = plataforma, org, pg_temp AS $$
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  RETURN QUERY
  SELECT n.id, s.codigo::text,
         /* El destinatario se enmascara: quien reprocesa necesita saber que
            existe, no leer la dirección completa. */
         regexp_replace(n.destinatario, '^(.).*(@.*)$', '\1•••\2'),
         n.canal::text, n.plantilla, n.estado::text, n.intentos, n.ultimo_error,
         n.creada_en, n.proximo_intento
    FROM plataforma.notificaciones n
    LEFT JOIN org.sedes s ON s.id = n.sede_id
   WHERE n.estado::text = p_estado
     AND (n.sede_id IS NULL OR plataforma.sede_visible(n.sede_id))
   ORDER BY n.creada_en DESC
   LIMIT GREATEST(1, LEAST(p_limite, 500));
END $$;
REVOKE ALL ON FUNCTION plataforma.ver_avisos(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma.ver_avisos(text, integer) TO casaroca_app;

CREATE OR REPLACE FUNCTION plataforma.reprocesar_aviso(p_id uuid, p_motivo text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = plataforma, pg_temp AS $$
DECLARE v plataforma.notificaciones%ROWTYPE;
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Diga por qué se reprocesa: si falló cinco veces, algo cambió para que ahora sí salga.'
      USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v FROM plataforma.notificaciones WHERE id = p_id;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'No existe ese aviso.' USING ERRCODE = 'no_data_found';
  END IF;
  IF v.estado::text <> 'fallida' THEN
    RAISE EXCEPTION 'Ese aviso no está muerto (está «%»): no hay nada que reprocesar.', v.estado
      USING ERRCODE = 'check_violation';
  END IF;
  IF v.sede_id IS NOT NULL AND NOT plataforma.sede_visible(v.sede_id) THEN
    RAISE EXCEPTION 'Ese aviso es de una sede fuera de su alcance.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE plataforma.notificaciones
     SET estado = 'pendiente', intentos = 0, proximo_intento = now(),
         ultimo_error = 'Reprocesado: ' || btrim(p_motivo) || ' (error anterior: ' || COALESCE(v.ultimo_error, '-') || ')'
   WHERE id = p_id;
  INSERT INTO plataforma.auditoria (esquema, tabla, fila_id, operacion, actor_id, actor_ip, valor_anterior, valor_nuevo, motivo)
  VALUES ('plataforma', 'notificaciones', p_id::text, 'U', plataforma.ctx_persona_id(),
          NULLIF(current_setting('app.ip', true), '')::inet,
          jsonb_build_object('estado', 'fallida', 'intentos', v.intentos),
          jsonb_build_object('estado', 'pendiente', 'intentos', 0),
          btrim(p_motivo));
  RETURN 'pendiente';
END $$;
REVOKE ALL ON FUNCTION plataforma.reprocesar_aviso(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma.reprocesar_aviso(uuid, text) TO casaroca_app;

CREATE OR REPLACE FUNCTION plataforma.salud_avisos()
RETURNS SETOF plataforma.v_salud_avisos
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = plataforma, pg_temp AS $$
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  RETURN QUERY SELECT * FROM plataforma.v_salud_avisos;
END $$;
REVOKE ALL ON FUNCTION plataforma.salud_avisos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma.salud_avisos() TO casaroca_app;

COMMIT;
