-- =====================================================================
-- 0072 · CERRAR UN CASO DICE CÓMO TERMINÓ
--
-- ⛔ Cerrar un caso de consejería no exigía decir cómo terminó (201 con
--    el cuerpo vacío). Para el pastor que lo retome en un año, «cerrado»
--    sin más no dice si la persona salió adelante, dejó de venir o fue
--    remitida. Es la pregunta que se hace al reabrir.
--
--    La columna nace aquí; la regla aplica a los cierres NUEVOS (los
--    casos ya cerrados no se reescriben: se les pediría un dato que nadie
--    anotó en su momento).
-- =====================================================================
BEGIN;

ALTER TABLE consejeria.casos ADD COLUMN IF NOT EXISTS desenlace text;

COMMENT ON COLUMN consejeria.casos.desenlace IS
  'Cómo terminó el caso, en palabras de quien lo cierra. Obligatorio al cerrar desde el 21 sep 2026 (0072).';

CREATE OR REPLACE FUNCTION consejeria.tg_cierre_con_desenlace()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = consejeria, pg_temp AS $$
BEGIN
  IF NEW.estado::text = 'cerrado' AND OLD.estado::text <> 'cerrado'
     AND (NEW.desenlace IS NULL OR length(btrim(NEW.desenlace)) < 5) THEN
    RAISE EXCEPTION 'Para cerrar el caso, escriba cómo terminó: quien lo retome necesita saberlo.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cierre_con_desenlace ON consejeria.casos;
CREATE TRIGGER trg_cierre_con_desenlace BEFORE UPDATE OF estado ON consejeria.casos
  FOR EACH ROW EXECUTE FUNCTION consejeria.tg_cierre_con_desenlace();

COMMIT;
