-- =====================================================================
-- 0074 · LOS DIEZ MÓDULOS QUE SOLO TENÍAN NOMBRE
--
-- ⛔ QUÉ PASABA. `sistema.modulos` declaraba 22 módulos y diez decían, en
--    su propia descripción, «SIN TABLAS todavía»: la consola dejaba
--    encenderlos, la matriz les daba permisos, y no había dónde guardar una
--    sola cosa. Oración lo decía más claro: «el más urgente de construir
--    bien».
--
--    Aquí nacen con la misma forma que el resto del sistema:
--    · toda tabla con `sede_id`, publicada con `plataforma.publicar_tabla`
--      (RLS forzado, política por sede, permisos y registro firmado);
--    · las hijas TOMAN la sede de su madre: nunca quedan en otra sede;
--    · las categorías son CATÁLOGOS editables, no listas en el código;
--    · cada estado es una máquina con sus transiciones escritas en la base;
--    · auditoría en cada tabla principal, SIN copiar el texto sensible;
--    · lo N3 (oración, legal) con columnas clasificadas y lectura
--      registrada desde la API;
--    · retención declarada para lo que guarda datos de personas.
--
--    Módulos: oración (N3), peticiones internas (N2), requerimientos (N1),
--    tareas (N1), calendario (N1), temáticas (N1), legal (N3),
--    comunicaciones (N2), construcción (N1) y analítica (N2, sin tablas:
--    funciones que agregan con supresión de celdas pequeñas).
--
-- ⛔ Y UN DEFECTO LATENTE QUE APARECIÓ AL DECLARAR LA RETENCIÓN. La purga
--    buscaba la columna de fecha por nombre y `asistencia.entradas` no
--    tiene ninguno de los nombres de la lista (la suya es `marcada_en`): su
--    política de 36 meses NUNCA se aplicó, y el simulacro de «anonimizar»
--    armaba un SQL inválido que nadie ejecutó porque nunca llegó ahí. Se
--    corrige al final de esta migración y queda un control en el banco.
-- =====================================================================
BEGIN;

-- ── 0 · Herramientas comunes ─────────────────────────────────────────
/* Máquina de estados declarada: TG_ARGV[0] es la columna, el resto son
   las transiciones permitidas 'desde>hacia'. Cualquier otra se rechaza
   diciendo a qué estados SÍ se puede pasar. */
CREATE OR REPLACE FUNCTION plataforma.tg_transicion()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp AS $$
DECLARE v_col text := TG_ARGV[0]; v_ant text; v_nue text; v_permitidas text[]; v_siguientes text;
BEGIN
  EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_col, v_col) INTO v_ant, v_nue USING OLD, NEW;
  IF v_ant IS NOT DISTINCT FROM v_nue THEN RETURN NEW; END IF;
  v_permitidas := TG_ARGV[1:TG_NARGS - 1];
  IF (v_ant || '>' || v_nue) = ANY (v_permitidas) THEN RETURN NEW; END IF;
  SELECT string_agg(split_part(t, '>', 2), ', ') INTO v_siguientes
    FROM unnest(v_permitidas) t WHERE split_part(t, '>', 1) = v_ant;
  RAISE EXCEPTION '%', format('No se pasa de «%s» a «%s». %s', v_ant, v_nue,
      CASE WHEN v_siguientes IS NULL THEN 'Ese estado es final: ya no cambia.'
           ELSE 'Desde «' || v_ant || '» se puede pasar a: ' || v_siguientes || '.' END)
    USING ERRCODE = 'check_violation';
END $$;

/* Sello de fecha al llegar a un estado: TG_ARGV[0] es la columna de
   estado y el resto 'estado:columna'. La fecha la pone la base. */
CREATE OR REPLACE FUNCTION plataforma.tg_sellar_estado()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp AS $$
DECLARE v_col text := TG_ARGV[0]; v_ant text; v_nue text; v_par text; v_fila jsonb;
BEGIN
  EXECUTE format('SELECT ($1).%I::text', v_col) INTO v_nue USING NEW;
  IF TG_OP = 'UPDATE' THEN
    EXECUTE format('SELECT ($1).%I::text', v_col) INTO v_ant USING OLD;
  END IF;
  IF v_ant IS NOT DISTINCT FROM v_nue THEN RETURN NEW; END IF;
  v_fila := to_jsonb(NEW);
  FOREACH v_par IN ARRAY TG_ARGV[1:TG_NARGS - 1] LOOP
    IF split_part(v_par, ':', 1) = v_nue AND v_fila ->> split_part(v_par, ':', 2) IS NULL THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object(split_part(v_par, ':', 2), now()));
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

/* Una hija toma la sede de su madre: TG_ARGV es la tabla madre y la
   columna que la referencia. Se TOMA, no se acepta del cliente. */
CREATE OR REPLACE FUNCTION plataforma.tg_sede_de_la_madre()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $$
DECLARE v_sede uuid;
BEGIN
  EXECUTE format('SELECT sede_id FROM %s WHERE id = ($1).%I', TG_ARGV[0], TG_ARGV[1])
     INTO v_sede USING NEW;
  IF v_sede IS NULL THEN
    RAISE EXCEPTION 'No existe el registro al que pertenece.' USING ERRCODE = 'foreign_key_violation';
  END IF;
  NEW.sede_id := v_sede;
  RETURN NEW;
END $$;

-- ── 1 · Catálogos de negocio ─────────────────────────────────────────
INSERT INTO sistema.catalogos (codigo, nombre, descripcion, editable_por_sede, cerrado) VALUES
 ('categoria_oracion', 'Categorías de petición de oración',
  'Para dirigir la petición a quien intercede por ese tema. Es una categoría pastoral, no un diagnóstico.', false, false),
 ('tipo_evento', 'Tipos de evento del calendario',
  'Qué clase de cosa se agenda. Cada sede puede sumar los suyos.', true, false),
 ('categoria_requerimiento', 'Categorías de requerimiento',
  'Las áreas de la mesa de servicio entre las sedes y la dirección.', false, false),
 ('tipo_peticion_interna', 'Tipos de petición interna',
  'Qué se le pide a la dirección: un permiso, un presupuesto, una autorización.', false, false),
 ('tipo_asunto_legal', 'Tipos de asunto legal',
  'La clase de asunto jurídico. El detalle vive en el asunto, con acceso restringido.', false, false),
 ('tipo_obra', 'Tipos de obra',
  'Construcción, ampliación, remodelación: la clase de obra física de una sede.', false, false)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO sistema.catalogo_valores (catalogo, codigo, etiqueta, orden, vigente) VALUES
 ('categoria_oracion','salud','Salud',10,true),
 ('categoria_oracion','familia','Familia y hogar',20,true),
 ('categoria_oracion','duelo','Duelo',30,true),
 ('categoria_oracion','trabajo','Trabajo y finanzas',40,true),
 ('categoria_oracion','espiritual','Vida espiritual',50,true),
 ('categoria_oracion','gratitud','Gratitud',60,true),
 ('categoria_oracion','otro','Otro',90,true),
 ('tipo_evento','servicio','Servicio',10,true),
 ('tipo_evento','reunion','Reunión',20,true),
 ('tipo_evento','retiro','Retiro',30,true),
 ('tipo_evento','conferencia','Conferencia',40,true),
 ('tipo_evento','capacitacion','Capacitación',50,true),
 ('tipo_evento','oracion','Vigilia u oración',60,true),
 ('tipo_evento','especial','Evento especial',90,true),
 ('categoria_requerimiento','mantenimiento','Mantenimiento',10,true),
 ('categoria_requerimiento','tecnologia','Tecnología',20,true),
 ('categoria_requerimiento','sonido_video','Sonido y video',30,true),
 ('categoria_requerimiento','compras','Compras',40,true),
 ('categoria_requerimiento','logistica','Logística',50,true),
 ('categoria_requerimiento','aseo','Aseo',60,true),
 ('categoria_requerimiento','seguridad','Seguridad',70,true),
 ('tipo_peticion_interna','permiso','Permiso',10,true),
 ('tipo_peticion_interna','presupuesto','Presupuesto',20,true),
 ('tipo_peticion_interna','compra','Compra',30,true),
 ('tipo_peticion_interna','autorizacion','Autorización',40,true),
 ('tipo_peticion_interna','otro','Otro',90,true),
 ('tipo_asunto_legal','contrato','Contrato',10,true),
 ('tipo_asunto_legal','arrendamiento','Arrendamiento',20,true),
 ('tipo_asunto_legal','laboral','Laboral',30,true),
 ('tipo_asunto_legal','derecho_peticion','Derecho de petición',40,true),
 ('tipo_asunto_legal','tutela','Tutela',50,true),
 ('tipo_asunto_legal','reclamacion','Reclamación',60,true),
 ('tipo_asunto_legal','propiedad','Propiedad o inmueble',70,true),
 ('tipo_asunto_legal','permiso_licencia','Permiso o licencia',80,true),
 ('tipo_asunto_legal','otro','Otro',90,true),
 ('tipo_obra','construccion','Construcción',10,true),
 ('tipo_obra','ampliacion','Ampliación',20,true),
 ('tipo_obra','remodelacion','Remodelación',30,true),
 ('tipo_obra','mantenimiento_mayor','Mantenimiento mayor',40,true),
 ('tipo_obra','compra_inmueble','Compra de inmueble',50,true)
ON CONFLICT DO NOTHING;

-- ── 2 · Acciones propias y su lugar en la matriz ────────────────────
/* Van en semillas (024 y 025), no aquí: `sistema.modulos` e
   `identidad.roles` se siembran DESPUÉS de las migraciones, y una llave
   foránea a un módulo que todavía no existe rompe la base desde cero. */

-- ── 3 · El freno de los envíos masivos ───────────────────────────────
/* Estación 27 del manual: nada masivo sin aprobación explícita, y con un
   freno para detenerlo. El freno es una fila: encenderlo detiene todo
   envío masivo en el acto, sin desplegar. */
CREATE TABLE sistema.frenos (
  codigo       text PRIMARY KEY,
  descripcion  text NOT NULL,
  activo       boolean NOT NULL DEFAULT false,
  motivo       text,
  cambiado_por uuid,
  cambiado_en  timestamptz
);
INSERT INTO sistema.frenos (codigo, descripcion) VALUES
 ('comunicaciones_masivas', 'Detiene todo envío de comunicaciones a grupos de personas.');
SELECT plataforma.publicar_tabla('sistema.frenos', 'catalogo_red',
  'Frenos de la red: configuracion sin datos de personas. Se cambian solo por funcion con guardia.',
  'Construccion del 21 sep 2026', false);

CREATE OR REPLACE FUNCTION sistema.cambiar_freno(p_codigo text, p_activo boolean, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = sistema, plataforma, pg_temp AS $$
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Diga por qué se cambia el freno: queda en la auditoría.' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM set_config('app.motivo', btrim(p_motivo), true);
  UPDATE sistema.frenos
     SET activo = p_activo, motivo = btrim(p_motivo),
         cambiado_por = plataforma.ctx_persona_id(), cambiado_en = now()
   WHERE codigo = p_codigo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el freno «%».', p_codigo USING ERRCODE = 'no_data_found';
  END IF;
END $$;
REVOKE ALL ON FUNCTION sistema.cambiar_freno(text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sistema.cambiar_freno(text, boolean, text) TO casaroca_app;

-- ═════════════════════════════════════════════════════════════════════
-- 4 · ORACIÓN (N3)
-- ═════════════════════════════════════════════════════════════════════
CREATE TABLE crm.peticiones_oracion (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id         uuid NOT NULL REFERENCES org.sedes(id),
  persona_id      uuid REFERENCES nucleo.personas(id),
  nombre_contacto text CHECK (nombre_contacto IS NULL OR length(btrim(nombre_contacto)) BETWEEN 2 AND 120),
  contacto        text CHECK (contacto IS NULL OR length(contacto) <= 160),
  categoria       text NOT NULL,
  resumen         text NOT NULL CHECK (length(btrim(resumen)) BETWEEN 3 AND 140),
  detalle         text CHECK (detalle IS NULL OR length(detalle) <= 4000),
  confidencial    boolean NOT NULL DEFAULT false,
  compartir_con_intercesores boolean NOT NULL DEFAULT false,
  origen          text NOT NULL DEFAULT 'interno' CHECK (origen IN ('interno','formulario_publico')),
  estado          text NOT NULL DEFAULT 'abierta'
                  CHECK (estado IN ('abierta','en_oracion','respondida','cerrada')),
  respuesta       text CHECK (respuesta IS NULL OR length(respuesta) <= 4000),
  respondida_en   timestamptz,
  cerrada_en      timestamptz,
  creado_por      uuid DEFAULT plataforma.ctx_persona_id(),
  creado_en       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oracion_quien_pide CHECK (persona_id IS NOT NULL OR nombre_contacto IS NOT NULL),
  CONSTRAINT oracion_respondida_con_respuesta CHECK (estado <> 'respondida' OR respuesta IS NOT NULL),
  /* Lo confidencial no se comparte con el equipo de intercesión. */
  CONSTRAINT oracion_confidencial_no_se_comparte CHECK (NOT (confidencial AND compartir_con_intercesores))
);
CREATE INDEX peticiones_oracion_sede_estado ON crm.peticiones_oracion (sede_id, estado, creado_en DESC);
CREATE TRIGGER trg_categoria_vigente BEFORE INSERT OR UPDATE OF categoria ON crm.peticiones_oracion
  FOR EACH ROW EXECUTE FUNCTION sistema.tg_valor_de_catalogo_vigente('categoria_oracion', 'categoria');
CREATE TRIGGER trg_transicion BEFORE UPDATE OF estado ON crm.peticiones_oracion
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_transicion('estado',
    'abierta>en_oracion','abierta>respondida','abierta>cerrada',
    'en_oracion>respondida','en_oracion>cerrada','respondida>cerrada');
CREATE TRIGGER trg_sellar BEFORE UPDATE OF estado ON crm.peticiones_oracion
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_sellar_estado('estado','respondida:respondida_en','cerrada:cerrada_en');

SELECT plataforma.publicar_tabla('crm.peticiones_oracion', 'por_sede',
  'Peticiones de oracion de la sede. N3: la lista no trae el detalle; la ficha lo trae y deja lectura registrada.',
  'Construccion del 21 sep 2026');
/* ⛔ Además de la sede: lo confidencial solo lo ven quien lo registró y
   quien tenga VER_CONFIDENCIAL_ORACION; lo que no se compartió con los
   intercesores solo lo ve quien atiende oración (crear). Las preguntas de
   permiso van en subconsulta: se evalúan UNA vez por consulta. */
DROP POLICY peticiones_oracion_sel ON crm.peticiones_oracion;
CREATE POLICY peticiones_oracion_sel ON crm.peticiones_oracion FOR SELECT
  USING (plataforma.sede_visible(sede_id) AND (
           creado_por = (SELECT plataforma.ctx_persona_id())
        OR (SELECT identidad.puede(plataforma.ctx_persona_id(), 'oracion', 'VER_CONFIDENCIAL_ORACION'))
        OR (NOT confidencial AND (compartir_con_intercesores
               OR (SELECT identidad.puede(plataforma.ctx_persona_id(), 'oracion', 'crear')))) ));

CREATE TABLE crm.oraciones_hechas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peticion_id uuid NOT NULL REFERENCES crm.peticiones_oracion(id) ON DELETE CASCADE,
  sede_id     uuid NOT NULL REFERENCES org.sedes(id),
  persona_id  uuid NOT NULL DEFAULT plataforma.ctx_persona_id(),
  oro_en      timestamptz NOT NULL DEFAULT now(),
  nota        text CHECK (nota IS NULL OR length(nota) <= 300)
);
CREATE INDEX oraciones_hechas_peticion ON crm.oraciones_hechas (peticion_id, oro_en DESC);
CREATE TRIGGER trg_sede_de_la_madre BEFORE INSERT ON crm.oraciones_hechas
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_sede_de_la_madre('crm.peticiones_oracion', 'peticion_id');
SELECT plataforma.publicar_tabla('crm.oraciones_hechas', 'por_sede',
  'Quien oro por que peticion y cuando. Toma la sede de la peticion.', 'Construccion del 21 sep 2026');
/* Quien no ve la petición no ve ni registra oraciones sobre ella. Y una
   oración hecha no se edita. */
DROP POLICY oraciones_hechas_sel ON crm.oraciones_hechas;
CREATE POLICY oraciones_hechas_sel ON crm.oraciones_hechas FOR SELECT
  USING (EXISTS (SELECT 1 FROM crm.peticiones_oracion p WHERE p.id = oraciones_hechas.peticion_id));
DROP POLICY oraciones_hechas_ins ON crm.oraciones_hechas;
CREATE POLICY oraciones_hechas_ins ON crm.oraciones_hechas FOR INSERT
  WITH CHECK (persona_id = plataforma.ctx_persona_id()
              AND EXISTS (SELECT 1 FROM crm.peticiones_oracion p WHERE p.id = oraciones_hechas.peticion_id));
DROP POLICY oraciones_hechas_upd ON crm.oraciones_hechas;
REVOKE UPDATE ON crm.oraciones_hechas FROM casaroca_app;

-- ═════════════════════════════════════════════════════════════════════
-- 5 · PETICIONES INTERNAS (N2)
-- ═════════════════════════════════════════════════════════════════════
CREATE TABLE sistema.peticiones_internas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id        uuid NOT NULL REFERENCES org.sedes(id),
  solicitante_id uuid NOT NULL DEFAULT plataforma.ctx_persona_id(),
  tipo           text NOT NULL,
  asunto         text NOT NULL CHECK (length(btrim(asunto)) BETWEEN 5 AND 160),
  detalle        text NOT NULL CHECK (length(btrim(detalle)) BETWEEN 10 AND 4000),
  dirigida_a     uuid REFERENCES org.unidades(id),
  prioridad      text NOT NULL DEFAULT 'normal' CHECK (prioridad IN ('baja','normal','alta','urgente')),
  estado         text NOT NULL DEFAULT 'enviada'
                 CHECK (estado IN ('enviada','en_revision','aprobada','rechazada','cancelada')),
  decidida_por   uuid,
  decidida_en    timestamptz,
  decision       text,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT peticion_decision_completa
    CHECK (estado NOT IN ('aprobada','rechazada') OR (decision IS NOT NULL AND decidida_por IS NOT NULL)),
  /* ⛔ Nadie aprueba ni rechaza lo que él mismo pidió. */
  CONSTRAINT peticion_nadie_decide_lo_suyo CHECK (decidida_por IS NULL OR decidida_por <> solicitante_id)
);
CREATE INDEX peticiones_internas_sede_estado ON sistema.peticiones_internas (sede_id, estado, creado_en DESC);
CREATE TRIGGER trg_tipo_vigente BEFORE INSERT OR UPDATE OF tipo ON sistema.peticiones_internas
  FOR EACH ROW EXECUTE FUNCTION sistema.tg_valor_de_catalogo_vigente('tipo_peticion_interna', 'tipo');
CREATE TRIGGER trg_transicion BEFORE UPDATE OF estado ON sistema.peticiones_internas
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_transicion('estado',
    'enviada>en_revision','enviada>aprobada','enviada>rechazada','enviada>cancelada',
    'en_revision>aprobada','en_revision>rechazada','en_revision>cancelada');
CREATE TRIGGER trg_sellar BEFORE UPDATE OF estado ON sistema.peticiones_internas
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_sellar_estado('estado','aprobada:decidida_en','rechazada:decidida_en');
SELECT plataforma.publicar_tabla('sistema.peticiones_internas', 'por_sede',
  'Lo que una sede o un equipo le pide a la direccion. La sede ve lo suyo; la direccion, todo.',
  'Construccion del 21 sep 2026');

-- ═════════════════════════════════════════════════════════════════════
-- 6 · REQUERIMIENTOS (N1) · mesa de servicio con plazo por prioridad
-- ═════════════════════════════════════════════════════════════════════
CREATE TABLE sistema.requerimientos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id       uuid NOT NULL REFERENCES org.sedes(id),
  reportado_por uuid DEFAULT plataforma.ctx_persona_id(),
  categoria     text NOT NULL,
  asunto        text NOT NULL CHECK (length(btrim(asunto)) BETWEEN 5 AND 160),
  detalle       text CHECK (detalle IS NULL OR length(detalle) <= 4000),
  prioridad     text NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja','media','alta','urgente')),
  estado        text NOT NULL DEFAULT 'nuevo'
                CHECK (estado IN ('nuevo','asignado','en_curso','resuelto','cerrado','cancelado')),
  asignado_a    uuid REFERENCES nucleo.personas(id),
  vence_en      timestamptz,
  resuelto_en   timestamptz,
  solucion      text,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT requerimiento_resuelto_con_solucion
    CHECK (estado NOT IN ('resuelto','cerrado') OR solucion IS NOT NULL),
  CONSTRAINT requerimiento_asignado_con_persona
    CHECK (estado <> 'asignado' OR asignado_a IS NOT NULL)
);
CREATE INDEX requerimientos_sede_estado ON sistema.requerimientos (sede_id, estado, vence_en);
CREATE TRIGGER trg_categoria_vigente BEFORE INSERT OR UPDATE OF categoria ON sistema.requerimientos
  FOR EACH ROW EXECUTE FUNCTION sistema.tg_valor_de_catalogo_vigente('categoria_requerimiento', 'categoria');
CREATE TRIGGER trg_transicion BEFORE UPDATE OF estado ON sistema.requerimientos
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_transicion('estado',
    'nuevo>asignado','nuevo>en_curso','nuevo>resuelto','nuevo>cancelado',
    'asignado>en_curso','asignado>resuelto','asignado>cancelado',
    'en_curso>resuelto','en_curso>cancelado',
    'resuelto>cerrado','resuelto>en_curso');

/* El plazo sale de la prioridad y lo pone la base: urgente 4 h, alta
   24 h, media 72 h, baja 7 días. Nadie lo escribe a mano. */
CREATE OR REPLACE FUNCTION sistema.tg_plazo_del_requerimiento()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.prioridad IS DISTINCT FROM OLD.prioridad THEN
    NEW.vence_en := COALESCE(NEW.creado_en, now()) + CASE NEW.prioridad
      WHEN 'urgente' THEN interval '4 hours' WHEN 'alta' THEN interval '24 hours'
      WHEN 'media' THEN interval '72 hours' ELSE interval '7 days' END;
  END IF;
  IF NEW.estado IN ('resuelto','cerrado') AND NEW.resuelto_en IS NULL THEN
    NEW.resuelto_en := now();
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.estado = 'en_curso' AND OLD.estado = 'resuelto' THEN
    NEW.resuelto_en := NULL;   -- se reabrió: deja de contar como resuelto
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_plazo BEFORE INSERT OR UPDATE ON sistema.requerimientos
  FOR EACH ROW EXECUTE FUNCTION sistema.tg_plazo_del_requerimiento();
SELECT plataforma.publicar_tabla('sistema.requerimientos', 'por_sede',
  'Mesa de servicio: lo que una sede reporta (mantenimiento, tecnologia, sonido). Sin datos de la congregacion.',
  'Construccion del 21 sep 2026');

-- ═════════════════════════════════════════════════════════════════════
-- 7 · TAREAS (N1)
-- ═════════════════════════════════════════════════════════════════════
CREATE TABLE plataforma.tareas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id       uuid NOT NULL REFERENCES org.sedes(id),
  titulo        text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 3 AND 160),
  detalle       text CHECK (detalle IS NULL OR length(detalle) <= 4000),
  asignada_a    uuid REFERENCES nucleo.personas(id),
  creada_por    uuid DEFAULT plataforma.ctx_persona_id(),
  vence_en      date,
  prioridad     text NOT NULL DEFAULT 'normal' CHECK (prioridad IN ('baja','normal','alta')),
  estado        text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_curso','hecha','cancelada')),
  origen_modulo text,
  origen_id     text,
  hecha_en      timestamptz,
  creado_en     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tareas_asignada ON plataforma.tareas (asignada_a, estado, vence_en);
CREATE INDEX tareas_sede ON plataforma.tareas (sede_id, estado, vence_en);
CREATE TRIGGER trg_transicion BEFORE UPDATE OF estado ON plataforma.tareas
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_transicion('estado',
    'pendiente>en_curso','pendiente>hecha','pendiente>cancelada',
    'en_curso>hecha','en_curso>cancelada','en_curso>pendiente','hecha>pendiente');
CREATE TRIGGER trg_sellar BEFORE UPDATE OF estado ON plataforma.tareas
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_sellar_estado('estado','hecha:hecha_en');
SELECT plataforma.publicar_tabla('plataforma.tareas', 'por_sede',
  'Trabajo interno asignado. Sin dato de la congregacion.', 'Construccion del 21 sep 2026');

-- ═════════════════════════════════════════════════════════════════════
-- 8 · CALENDARIO (N1)
-- ═════════════════════════════════════════════════════════════════════
CREATE TABLE org.eventos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id        uuid NOT NULL REFERENCES org.sedes(id),
  alcance_red    boolean NOT NULL DEFAULT false,
  tipo           text NOT NULL,
  titulo         text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 3 AND 160),
  descripcion    text CHECK (descripcion IS NULL OR length(descripcion) <= 4000),
  lugar          text CHECK (lugar IS NULL OR length(lugar) <= 200),
  inicia         timestamptz NOT NULL,
  termina        timestamptz NOT NULL,
  publico        boolean NOT NULL DEFAULT false,
  cupo           integer CHECK (cupo IS NULL OR cupo > 0),
  responsable_id uuid REFERENCES nucleo.personas(id),
  estado         text NOT NULL DEFAULT 'programado' CHECK (estado IN ('programado','cancelado','realizado')),
  motivo_cancelacion text,
  creado_por     uuid DEFAULT plataforma.ctx_persona_id(),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evento_termina_despues CHECK (termina > inicia),
  CONSTRAINT evento_cancelado_con_motivo CHECK (estado <> 'cancelado' OR motivo_cancelacion IS NOT NULL)
);
CREATE INDEX eventos_sede_inicia ON org.eventos (sede_id, inicia);
CREATE INDEX eventos_red_inicia ON org.eventos (inicia) WHERE alcance_red;
CREATE TRIGGER trg_tipo_vigente BEFORE INSERT OR UPDATE OF tipo ON org.eventos
  FOR EACH ROW EXECUTE FUNCTION sistema.tg_valor_de_catalogo_vigente('tipo_evento', 'tipo');
CREATE TRIGGER trg_transicion BEFORE UPDATE OF estado ON org.eventos
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_transicion('estado',
    'programado>cancelado','programado>realizado');
SELECT plataforma.publicar_tabla('org.eventos', 'por_sede',
  'Agenda de servicios, reuniones y eventos. Un evento de la red (alcance_red) lo ven todas las sedes.',
  'Construccion del 21 sep 2026');
DROP POLICY eventos_sel ON org.eventos;
CREATE POLICY eventos_sel ON org.eventos FOR SELECT
  USING (plataforma.sede_visible(sede_id) OR alcance_red);

/* Solo quien alcanza toda la red publica para toda la red. */
CREATE OR REPLACE FUNCTION org.tg_evento_de_red_solo_desde_la_red()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.alcance_red AND plataforma.ctx_persona_id() IS NOT NULL AND NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'Un evento para toda la red lo publica quien alcanza toda la red.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_evento_de_red BEFORE INSERT OR UPDATE OF alcance_red ON org.eventos
  FOR EACH ROW EXECUTE FUNCTION org.tg_evento_de_red_solo_desde_la_red();

-- ═════════════════════════════════════════════════════════════════════
-- 9 · TEMÁTICAS Y ENSEÑANZA (N1)
-- ═════════════════════════════════════════════════════════════════════
CREATE TABLE formacion.series (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id     uuid NOT NULL REFERENCES org.sedes(id),
  alcance_red boolean NOT NULL DEFAULT false,
  titulo      text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 3 AND 160),
  descripcion text CHECK (descripcion IS NULL OR length(descripcion) <= 4000),
  inicia      date,
  termina     date,
  estado      text NOT NULL DEFAULT 'planeada' CHECK (estado IN ('planeada','en_curso','terminada')),
  creado_por  uuid DEFAULT plataforma.ctx_persona_id(),
  creado_en   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT serie_fechas CHECK (termina IS NULL OR inicia IS NULL OR termina >= inicia)
);
CREATE TRIGGER trg_transicion BEFORE UPDATE OF estado ON formacion.series
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_transicion('estado',
    'planeada>en_curso','planeada>terminada','en_curso>terminada','terminada>en_curso');
CREATE TRIGGER trg_serie_de_red BEFORE INSERT OR UPDATE OF alcance_red ON formacion.series
  FOR EACH ROW EXECUTE FUNCTION org.tg_evento_de_red_solo_desde_la_red();
SELECT plataforma.publicar_tabla('formacion.series', 'por_sede',
  'Series de ensenanza: contenido, no personas. Una serie de la red la ven todas las sedes.',
  'Construccion del 21 sep 2026');
DROP POLICY series_sel ON formacion.series;
CREATE POLICY series_sel ON formacion.series FOR SELECT
  USING (plataforma.sede_visible(sede_id) OR alcance_red);

CREATE TABLE formacion.ensenanzas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serie_id    uuid NOT NULL REFERENCES formacion.series(id),
  sede_id     uuid NOT NULL REFERENCES org.sedes(id),
  titulo      text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 3 AND 160),
  fecha       date NOT NULL,
  predicador  text CHECK (predicador IS NULL OR length(predicador) <= 120),
  pasaje      text CHECK (pasaje IS NULL OR length(pasaje) <= 120),
  resumen     text CHECK (resumen IS NULL OR length(resumen) <= 4000),
  recursos    text CHECK (recursos IS NULL OR length(recursos) <= 1000),
  creado_por  uuid DEFAULT plataforma.ctx_persona_id(),
  creado_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ensenanzas_serie ON formacion.ensenanzas (serie_id, fecha);
CREATE TRIGGER trg_sede_de_la_madre BEFORE INSERT ON formacion.ensenanzas
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_sede_de_la_madre('formacion.series', 'serie_id');
SELECT plataforma.publicar_tabla('formacion.ensenanzas', 'por_sede',
  'Cada ensenanza de una serie. Toma la sede de su serie.', 'Construccion del 21 sep 2026');
DROP POLICY ensenanzas_sel ON formacion.ensenanzas;
CREATE POLICY ensenanzas_sel ON formacion.ensenanzas FOR SELECT
  USING (EXISTS (SELECT 1 FROM formacion.series s WHERE s.id = ensenanzas.serie_id));

-- ═════════════════════════════════════════════════════════════════════
-- 10 · LEGAL (N3)
-- ═════════════════════════════════════════════════════════════════════
CREATE TABLE plataforma.asuntos_legales (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id        uuid NOT NULL REFERENCES org.sedes(id),
  tipo           text NOT NULL,
  titulo         text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 5 AND 200),
  contraparte    text CHECK (contraparte IS NULL OR length(contraparte) <= 200),
  persona_id     uuid REFERENCES nucleo.personas(id),
  estado         text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','en_tramite','cerrado')),
  responsable_id uuid REFERENCES nucleo.personas(id),
  vence_en       date,
  resultado      text CHECK (resultado IS NULL OR length(resultado) <= 4000),
  cerrado_en     timestamptz,
  creado_por     uuid DEFAULT plataforma.ctx_persona_id(),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asunto_cerrado_con_resultado CHECK (estado <> 'cerrado' OR resultado IS NOT NULL)
);
CREATE INDEX asuntos_legales_sede ON plataforma.asuntos_legales (sede_id, estado, vence_en);
CREATE TRIGGER trg_tipo_vigente BEFORE INSERT OR UPDATE OF tipo ON plataforma.asuntos_legales
  FOR EACH ROW EXECUTE FUNCTION sistema.tg_valor_de_catalogo_vigente('tipo_asunto_legal', 'tipo');
CREATE TRIGGER trg_transicion BEFORE UPDATE OF estado ON plataforma.asuntos_legales
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_transicion('estado',
    'abierto>en_tramite','abierto>cerrado','en_tramite>cerrado','en_tramite>abierto','cerrado>en_tramite');
CREATE TRIGGER trg_sellar BEFORE UPDATE OF estado ON plataforma.asuntos_legales
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_sellar_estado('estado','cerrado:cerrado_en');
SELECT plataforma.publicar_tabla('plataforma.asuntos_legales', 'por_sede',
  'Asuntos juridicos de la sede. N3: la API exige el permiso del modulo y registra la lectura de la ficha.',
  'Construccion del 21 sep 2026');

CREATE TABLE plataforma.asuntos_legales_notas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asunto_id   uuid NOT NULL REFERENCES plataforma.asuntos_legales(id),
  sede_id     uuid NOT NULL REFERENCES org.sedes(id),
  autor_id    uuid NOT NULL DEFAULT plataforma.ctx_persona_id(),
  escrita_en  timestamptz NOT NULL DEFAULT now(),
  contenido   text NOT NULL CHECK (length(btrim(contenido)) BETWEEN 5 AND 4000)
);
CREATE INDEX asuntos_legales_notas_asunto ON plataforma.asuntos_legales_notas (asunto_id, escrita_en);
CREATE TRIGGER trg_sede_de_la_madre BEFORE INSERT ON plataforma.asuntos_legales_notas
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_sede_de_la_madre('plataforma.asuntos_legales', 'asunto_id');
SELECT plataforma.publicar_tabla('plataforma.asuntos_legales_notas', 'por_sede',
  'Actuaciones de un asunto legal. Inmutables: se agregan, no se editan ni se borran.',
  'Construccion del 21 sep 2026');
/* Una actuación jurídica es un hecho: no se edita. */
DROP POLICY asuntos_legales_notas_upd ON plataforma.asuntos_legales_notas;
REVOKE UPDATE ON plataforma.asuntos_legales_notas FROM casaroca_app;

-- ═════════════════════════════════════════════════════════════════════
-- 11 · COMUNICACIONES (N2) · cuatro ojos, freno y consentimiento
-- ═════════════════════════════════════════════════════════════════════
CREATE TABLE crm.comunicaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id       uuid NOT NULL REFERENCES org.sedes(id),
  canal         text NOT NULL DEFAULT 'email' CHECK (canal IN ('email')),
  /* ⛔ 'administrativa' NO está: se apoya en contrato y no pide
     consentimiento, y un envío masivo con esa etiqueta saltaría la ley. */
  finalidad     text NOT NULL CHECK (finalidad IN ('convocatoria','pastoral','emergencia')),
  asunto        text NOT NULL CHECK (length(btrim(asunto)) BETWEEN 5 AND 160),
  cuerpo        text NOT NULL CHECK (length(btrim(cuerpo)) BETWEEN 20 AND 5000),
  destinatarios text NOT NULL CHECK (destinatarios IN ('miembros_sede','grupo','servidores')),
  grupo_id      uuid REFERENCES grupos.grupos(id),
  estado        text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','aprobada','enviada','cancelada')),
  creada_por    uuid NOT NULL DEFAULT plataforma.ctx_persona_id(),
  creada_en     timestamptz NOT NULL DEFAULT now(),
  aprobada_por  uuid,
  aprobada_en   timestamptz,
  enviada_en    timestamptz,
  encolados     integer,
  omitidos_sin_consentimiento integer,
  CONSTRAINT comunicacion_grupo_si_es_grupo CHECK ((destinatarios = 'grupo') = (grupo_id IS NOT NULL)),
  CONSTRAINT comunicacion_aprobada_por_alguien CHECK (estado NOT IN ('aprobada','enviada') OR aprobada_por IS NOT NULL),
  /* ⛔ Cuatro ojos: quien escribe un envío masivo no se lo aprueba. */
  CONSTRAINT comunicacion_cuatro_ojos CHECK (aprobada_por IS NULL OR aprobada_por <> creada_por)
);
CREATE INDEX comunicaciones_sede ON crm.comunicaciones (sede_id, estado, creada_en DESC);
CREATE TRIGGER trg_transicion BEFORE UPDATE OF estado ON crm.comunicaciones
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_transicion('estado',
    'borrador>aprobada','borrador>cancelada','aprobada>borrador','aprobada>enviada','aprobada>cancelada');
CREATE TRIGGER trg_sellar BEFORE UPDATE OF estado ON crm.comunicaciones
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_sellar_estado('estado','aprobada:aprobada_en','enviada:enviada_en');

/* Lo aprobado queda congelado: si el autor cambiara el texto después de
   la aprobación, los cuatro ojos no habrían visto lo que sale. Para
   cambiarlo se devuelve a borrador, y la aprobación se pierde. Y a
   «enviada» solo se llega por la función que encola (con su freno y su
   filtro de consentimiento), nunca con un UPDATE directo. */
CREATE OR REPLACE FUNCTION crm.tg_comunicacion_congelada()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.asunto, NEW.cuerpo, NEW.destinatarios, NEW.grupo_id, NEW.finalidad, NEW.sede_id)
     IS DISTINCT FROM (OLD.asunto, OLD.cuerpo, OLD.destinatarios, OLD.grupo_id, OLD.finalidad, OLD.sede_id)
     AND OLD.estado <> 'borrador' THEN
    RAISE EXCEPTION 'Una comunicación aprobada, enviada o cancelada no se edita. Devuélvala a borrador para cambiarla: la aprobación se pierde.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.estado = 'borrador' AND OLD.estado = 'aprobada' THEN
    NEW.aprobada_por := NULL; NEW.aprobada_en := NULL;
  END IF;
  IF NEW.estado = 'enviada' AND OLD.estado <> 'enviada'
     AND current_setting('crm.enviando', true) IS DISTINCT FROM NEW.id::text THEN
    RAISE EXCEPTION 'Una comunicación se envía con la acción «Enviar», que respeta el freno y el consentimiento.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_congelada BEFORE UPDATE ON crm.comunicaciones
  FOR EACH ROW EXECUTE FUNCTION crm.tg_comunicacion_congelada();

/* El grupo destinatario es de la misma sede de la comunicación. */
CREATE OR REPLACE FUNCTION crm.tg_comunicacion_grupo_de_su_sede()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = crm, grupos, pg_temp AS $$
BEGIN
  IF NEW.grupo_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM grupos.grupos g WHERE g.id = NEW.grupo_id AND g.sede_id = NEW.sede_id) THEN
    RAISE EXCEPTION 'Ese grupo no es de la sede de la comunicación.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_grupo_de_su_sede BEFORE INSERT OR UPDATE OF grupo_id, sede_id ON crm.comunicaciones
  FOR EACH ROW EXECUTE FUNCTION crm.tg_comunicacion_grupo_de_su_sede();

SELECT plataforma.publicar_tabla('crm.comunicaciones', 'por_sede',
  'Envios a grupos de personas. Los aprueba otra persona y respetan el consentimiento de cada destinatario.',
  'Construccion del 21 sep 2026');

ALTER TABLE plataforma.notificaciones DROP CONSTRAINT IF EXISTS notificaciones_plantilla_check;
ALTER TABLE plataforma.notificaciones ADD CONSTRAINT notificaciones_plantilla_check
  CHECK (plantilla = ANY (ARRAY['Bienvenida_nuevo','Notificacion_coordinador','Confirmacion_miembro',
                                'Confirmacion_aporte','Certificado_expedido','Comunicacion_general']));

/* Enviar: solo lo aprobado, solo con el freno quieto, y a cada persona
   SOLO si la base legal de la finalidad lo permite (consentimiento
   vigente para convocatoria y pastoral). Lo que no sale se cuenta. */
CREATE OR REPLACE FUNCTION crm.enviar_comunicacion(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = crm, nucleo, grupos, talento, plataforma, sistema, pg_temp AS $$
DECLARE v crm.comunicaciones%ROWTYPE; v_base text; v_enc int := 0; v_omi int := 0; v_sin int := 0; r record;
BEGIN
  SELECT * INTO v FROM crm.comunicaciones WHERE id = p_id;
  IF v.id IS NULL OR NOT plataforma.sede_visible(v.sede_id) THEN
    RAISE EXCEPTION 'Ese envío no existe o no está en su alcance.' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT identidad.puede(plataforma.ctx_persona_id(), 'comunicaciones', 'crear') THEN
    RAISE EXCEPTION 'Su rol no envía comunicaciones.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v.estado <> 'aprobada' THEN
    RAISE EXCEPTION 'Solo se envía lo APROBADO por otra persona. Este envío está «%».', v.estado
      USING ERRCODE = 'check_violation';
  END IF;
  IF (SELECT activo FROM sistema.frenos WHERE codigo = 'comunicaciones_masivas') THEN
    RAISE EXCEPTION 'El freno de envíos masivos está puesto: no sale nada hasta que la central lo quite.'
      USING ERRCODE = 'check_violation';
  END IF;
  SELECT base_legal INTO v_base FROM plataforma.finalidades WHERE codigo = v.finalidad;

  FOR r IN
    SELECT DISTINCT p.id, p.email_principal::text AS email
      FROM nucleo.personas p
     WHERE p.eliminado_en IS NULL AND p.estado::text NOT IN ('fallecida','fusionada')
       AND ((v.destinatarios = 'miembros_sede' AND EXISTS (SELECT 1 FROM nucleo.membresias_sede m
               WHERE m.persona_id = p.id AND m.sede_id = v.sede_id AND m.hasta IS NULL))
         OR (v.destinatarios = 'grupo' AND EXISTS (SELECT 1 FROM grupos.membresias gm
               WHERE gm.persona_id = p.id AND gm.grupo_id = v.grupo_id AND gm.fecha_salida IS NULL))
         OR (v.destinatarios = 'servidores' AND EXISTS (SELECT 1 FROM talento.voluntariados tv
               WHERE tv.persona_id = p.id AND tv.sede_id = v.sede_id AND tv.estado::text = 'activo')))
  LOOP
    IF r.email IS NULL THEN v_sin := v_sin + 1; CONTINUE; END IF;
    IF v_base = 'consentimiento'
       AND NOT plataforma.puede_contactar(r.id, 'email'::plataforma.canal_contacto, v.finalidad) THEN
      v_omi := v_omi + 1; CONTINUE;
    END IF;
    INSERT INTO plataforma.notificaciones
      (sede_id, persona_id, destinatario, canal, plantilla, datos, origen_modulo, origen_id, estado, intentos, finalidad)
    VALUES (v.sede_id, r.id, r.email, 'email', 'Comunicacion_general',
            jsonb_build_object('asunto', v.asunto, 'cuerpo', v.cuerpo, 'finalidad', v.finalidad),
            'comunicaciones', v.id::text, 'pendiente', 0, v.finalidad);
    v_enc := v_enc + 1;
  END LOOP;

  PERFORM set_config('crm.enviando', p_id::text, true);
  UPDATE crm.comunicaciones
     SET estado = 'enviada', encolados = v_enc, omitidos_sin_consentimiento = v_omi
   WHERE id = p_id;
  PERFORM set_config('crm.enviando', '', true);
  RETURN jsonb_build_object('encolados', v_enc, 'omitidos_sin_consentimiento', v_omi, 'sin_correo', v_sin);
END $$;
REVOKE ALL ON FUNCTION crm.enviar_comunicacion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crm.enviar_comunicacion(uuid) TO casaroca_app;

/* Cuántos recibirían, ANTES de aprobar: quien aprueba sabe a cuánta gente
   le llega y cuántos se quedan fuera por no haber autorizado. */
CREATE OR REPLACE FUNCTION crm.alcance_de_comunicacion(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = crm, nucleo, grupos, talento, plataforma, pg_temp AS $$
DECLARE v crm.comunicaciones%ROWTYPE; v_base text; v_total int; v_ok int; v_sin int;
BEGIN
  SELECT * INTO v FROM crm.comunicaciones WHERE id = p_id;
  IF v.id IS NULL OR NOT plataforma.sede_visible(v.sede_id) THEN
    RAISE EXCEPTION 'Ese envío no existe o no está en su alcance.' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT base_legal INTO v_base FROM plataforma.finalidades WHERE codigo = v.finalidad;
  SELECT count(*),
         count(*) FILTER (WHERE p.email_principal IS NOT NULL
                            AND (v_base <> 'consentimiento'
                                 OR plataforma.puede_contactar(p.id, 'email'::plataforma.canal_contacto, v.finalidad))),
         count(*) FILTER (WHERE p.email_principal IS NULL)
    INTO v_total, v_ok, v_sin
    FROM nucleo.personas p
   WHERE p.eliminado_en IS NULL AND p.estado::text NOT IN ('fallecida','fusionada')
     AND ((v.destinatarios = 'miembros_sede' AND EXISTS (SELECT 1 FROM nucleo.membresias_sede m
             WHERE m.persona_id = p.id AND m.sede_id = v.sede_id AND m.hasta IS NULL))
       OR (v.destinatarios = 'grupo' AND EXISTS (SELECT 1 FROM grupos.membresias gm
             WHERE gm.persona_id = p.id AND gm.grupo_id = v.grupo_id AND gm.fecha_salida IS NULL))
       OR (v.destinatarios = 'servidores' AND EXISTS (SELECT 1 FROM talento.voluntariados tv
             WHERE tv.persona_id = p.id AND tv.sede_id = v.sede_id AND tv.estado::text = 'activo')));
  RETURN jsonb_build_object('personas', v_total, 'recibirian', v_ok, 'sin_correo', v_sin,
                            'sin_autorizacion', v_total - v_ok - v_sin);
END $$;
REVOKE ALL ON FUNCTION crm.alcance_de_comunicacion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crm.alcance_de_comunicacion(uuid) TO casaroca_app;

-- ═════════════════════════════════════════════════════════════════════
-- 12 · CONSTRUCCIÓN (N1)
-- ═════════════════════════════════════════════════════════════════════
CREATE TABLE org.obras (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id          uuid NOT NULL REFERENCES org.sedes(id),
  nombre           text NOT NULL CHECK (length(btrim(nombre)) BETWEEN 3 AND 160),
  tipo             text NOT NULL,
  estado           text NOT NULL DEFAULT 'planeada'
                   CHECK (estado IN ('planeada','en_curso','suspendida','terminada','cancelada')),
  presupuesto      numeric(14,2) CHECK (presupuesto IS NULL OR presupuesto >= 0),
  moneda           char(3) NOT NULL DEFAULT 'COP',
  ejecutado        numeric(14,2) NOT NULL DEFAULT 0 CHECK (ejecutado >= 0),
  avance_pct       smallint NOT NULL DEFAULT 0 CHECK (avance_pct BETWEEN 0 AND 100),
  inicia           date,
  termina_estimado date,
  terminada_en     date,
  responsable_id   uuid REFERENCES nucleo.personas(id),
  descripcion      text CHECK (descripcion IS NULL OR length(descripcion) <= 4000),
  creado_por       uuid DEFAULT plataforma.ctx_persona_id(),
  creado_en        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT obra_terminada_al_cien CHECK (estado <> 'terminada' OR avance_pct = 100),
  CONSTRAINT obra_fechas CHECK (termina_estimado IS NULL OR inicia IS NULL OR termina_estimado >= inicia)
);
CREATE INDEX obras_sede ON org.obras (sede_id, estado);
CREATE TRIGGER trg_tipo_vigente BEFORE INSERT OR UPDATE OF tipo ON org.obras
  FOR EACH ROW EXECUTE FUNCTION sistema.tg_valor_de_catalogo_vigente('tipo_obra', 'tipo');
CREATE TRIGGER trg_transicion BEFORE UPDATE OF estado ON org.obras
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_transicion('estado',
    'planeada>en_curso','planeada>cancelada','en_curso>suspendida','en_curso>terminada','en_curso>cancelada',
    'suspendida>en_curso','suspendida>cancelada');
SELECT plataforma.publicar_tabla('org.obras', 'por_sede',
  'Obras fisicas de cada sede. Sin datos de personas mas alla del responsable.',
  'Construccion del 21 sep 2026');

CREATE TABLE org.obras_hitos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id        uuid NOT NULL REFERENCES org.obras(id),
  sede_id        uuid NOT NULL REFERENCES org.sedes(id),
  fecha          date NOT NULL,
  descripcion    text NOT NULL CHECK (length(btrim(descripcion)) BETWEEN 5 AND 2000),
  avance_pct     smallint CHECK (avance_pct IS NULL OR avance_pct BETWEEN 0 AND 100),
  gasto          numeric(14,2) CHECK (gasto IS NULL OR gasto >= 0),
  registrado_por uuid DEFAULT plataforma.ctx_persona_id(),
  registrado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX obras_hitos_obra ON org.obras_hitos (obra_id, fecha);
CREATE TRIGGER trg_sede_de_la_madre BEFORE INSERT ON org.obras_hitos
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_sede_de_la_madre('org.obras', 'obra_id');
SELECT plataforma.publicar_tabla('org.obras_hitos', 'por_sede',
  'Hitos de una obra: avance y gasto. Toma la sede de la obra.', 'Construccion del 21 sep 2026');
DROP POLICY obras_hitos_upd ON org.obras_hitos;
REVOKE UPDATE ON org.obras_hitos FROM casaroca_app;

/* El avance y lo ejecutado salen de los hitos: nadie los escribe a mano
   en dos sitios. Una obra terminada o cancelada no recibe hitos. */
CREATE OR REPLACE FUNCTION org.tg_obra_desde_hitos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = org, pg_temp AS $$
DECLARE v_estado text;
BEGIN
  SELECT estado INTO v_estado FROM org.obras WHERE id = NEW.obra_id;
  IF v_estado IN ('terminada','cancelada') THEN
    RAISE EXCEPTION 'La obra está %: no recibe hitos nuevos.', v_estado USING ERRCODE = 'check_violation';
  END IF;
  UPDATE org.obras o
     SET avance_pct = GREATEST(o.avance_pct, COALESCE(NEW.avance_pct, o.avance_pct)),
         ejecutado  = COALESCE(o.ejecutado, 0) + COALESCE(NEW.gasto, 0),
         estado     = CASE WHEN o.estado = 'planeada' THEN 'en_curso' ELSE o.estado END
   WHERE o.id = NEW.obra_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_obra_desde_hitos BEFORE INSERT ON org.obras_hitos
  FOR EACH ROW EXECUTE FUNCTION org.tg_obra_desde_hitos();

-- ═════════════════════════════════════════════════════════════════════
-- 13 · ANALÍTICA (N2) · agregados con supresión de celdas pequeñas
-- ═════════════════════════════════════════════════════════════════════
/* ⛔ La descripción del módulo lo dice: «un conteo de tres personas
   identifica a las tres». Toda cifra por debajo de 5 sale como «<5». Las
   funciones son INVOKER: el RLS de quien pregunta decide qué se cuenta. */
CREATE OR REPLACE FUNCTION plataforma.celda(n bigint)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN n IS NULL OR n = 0 THEN '0' WHEN n < 5 THEN '<5' ELSE n::text END;
$$;

CREATE OR REPLACE FUNCTION plataforma.tablero(p_sede uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE
SET search_path = plataforma, pg_temp AS $$
  SELECT jsonb_build_object(
    'asistencia_por_semana', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('semana', s.semana, 'contados', s.contados)
                                ORDER BY s.semana), '[]'::jsonb)
        FROM (SELECT date_trunc('week', sv.fecha)::date AS semana, sum(cn.total)::bigint AS contados
                FROM asistencia.servicios sv
                JOIN asistencia.conteos cn ON cn.servicio_id = sv.id
               WHERE sv.fecha >= CURRENT_DATE - 84
                 AND (p_sede IS NULL OR sv.sede_id = p_sede)
               GROUP BY 1) s),
    'personas_activas', plataforma.celda((SELECT count(*) FROM nucleo.personas p
        WHERE p.eliminado_en IS NULL AND p.estado::text = 'activa' AND (p_sede IS NULL OR p.sede_id = p_sede))),
    'grupos_activos', plataforma.celda((SELECT count(*) FROM grupos.grupos g
        WHERE g.cerrado_en IS NULL AND (p_sede IS NULL OR g.sede_id = p_sede))),
    'grupos_sin_reunion_45_dias', plataforma.celda((SELECT count(*) FROM grupos.grupos g
        WHERE g.cerrado_en IS NULL AND (p_sede IS NULL OR g.sede_id = p_sede)
          AND NOT EXISTS (SELECT 1 FROM grupos.reuniones r WHERE r.grupo_id = g.id AND r.fecha >= CURRENT_DATE - 45))),
    'ninos_por_domingo', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('fecha', d.fecha, 'ninos', plataforma.celda(d.n))
                                ORDER BY d.fecha), '[]'::jsonb)
        FROM (SELECT c.ingreso_en::date AS fecha, count(DISTINCT c.menor_id) AS n
                FROM rocakids.checkins c
               WHERE c.ingreso_en >= CURRENT_DATE - 56
                 AND (p_sede IS NULL OR c.sede_id = p_sede)
               GROUP BY 1) d),
    'peticiones_oracion_abiertas', plataforma.celda((SELECT count(*) FROM crm.peticiones_oracion o
        WHERE o.estado IN ('abierta','en_oracion') AND (p_sede IS NULL OR o.sede_id = p_sede))),
    'requerimientos_vencidos', plataforma.celda((SELECT count(*) FROM sistema.requerimientos q
        WHERE q.estado NOT IN ('resuelto','cerrado','cancelado') AND q.vence_en < now()
          AND (p_sede IS NULL OR q.sede_id = p_sede))),
    'tareas_vencidas', plataforma.celda((SELECT count(*) FROM plataforma.tareas t
        WHERE t.estado IN ('pendiente','en_curso') AND t.vence_en < CURRENT_DATE
          AND (p_sede IS NULL OR t.sede_id = p_sede))),
    'generado_en', now(),
    'nota', 'Las cifras menores de 5 se muestran como «<5»: un conteo pequeño identifica a las personas.'
  );
$$;
REVOKE ALL ON FUNCTION plataforma.tablero(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION plataforma.tablero(uuid) TO casaroca_app;

/* «Quién se nos está perdiendo»: vino al menos 3 veces entre la semana 5
   y la 12 hacia atrás y ninguna en las últimas 4. Es una lista de
   PERSONAS (N2), leída con el RLS de quien pregunta: es para llamarlas,
   no para medir. */
CREATE OR REPLACE FUNCTION crm.se_estan_perdiendo(p_sede uuid DEFAULT NULL, p_limite integer DEFAULT 100)
RETURNS TABLE(persona_id uuid, nombre text, sede text, veces_antes bigint, ultima_vez date, telefono text)
LANGUAGE sql STABLE
SET search_path = crm, pg_temp AS $$
  WITH antes AS (
    SELECT e.persona_id, count(*) AS n, max(sv.fecha) AS ultima
      FROM asistencia.entradas e JOIN asistencia.servicios sv ON sv.id = e.servicio_id
     WHERE e.persona_id IS NOT NULL
       AND sv.fecha BETWEEN CURRENT_DATE - 84 AND CURRENT_DATE - 29
       AND (p_sede IS NULL OR sv.sede_id = p_sede)
     GROUP BY 1 HAVING count(*) >= 3),
  recientes AS (
    SELECT DISTINCT e.persona_id
      FROM asistencia.entradas e JOIN asistencia.servicios sv ON sv.id = e.servicio_id
     WHERE sv.fecha >= CURRENT_DATE - 28 AND e.persona_id IS NOT NULL)
  SELECT p.id, p.nombre_completo, s.codigo, a.n, a.ultima, p.telefono_movil
    FROM antes a
    JOIN nucleo.v_personas p ON p.id = a.persona_id
    LEFT JOIN org.sedes s ON s.id = p.sede_id
   WHERE NOT EXISTS (SELECT 1 FROM recientes r WHERE r.persona_id = a.persona_id)
     AND p.eliminado_en IS NULL AND p.estado::text = 'activa'
   ORDER BY a.ultima, a.n DESC
   LIMIT GREATEST(1, LEAST(COALESCE(p_limite, 100), 500));
$$;
REVOKE ALL ON FUNCTION crm.se_estan_perdiendo(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crm.se_estan_perdiendo(uuid, integer) TO casaroca_app;

-- ── 14 · Auditoría de cada tabla principal, sin copiar texto sensible ─
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('crm','peticiones_oracion', ARRAY['-detalle','-respuesta','-contacto','-resumen']),
    ('sistema','peticiones_internas', ARRAY['-detalle']),
    ('sistema','requerimientos', ARRAY[]::text[]),
    ('plataforma','tareas', ARRAY[]::text[]),
    ('org','eventos', ARRAY[]::text[]),
    ('formacion','series', ARRAY[]::text[]),
    ('formacion','ensenanzas', ARRAY[]::text[]),
    ('plataforma','asuntos_legales', ARRAY['-titulo','-contraparte','-resultado']),
    ('crm','comunicaciones', ARRAY['-cuerpo']),
    ('org','obras', ARRAY[]::text[]),
    ('sistema','frenos', ARRAY['#codigo'])
  ) AS t(esquema, tabla, args)
  LOOP
    EXECUTE format('CREATE TRIGGER trg_auditar AFTER INSERT OR UPDATE OR DELETE ON %I.%I '
                   'FOR EACH ROW EXECUTE FUNCTION plataforma.tg_auditar(%s)',
                   r.esquema, r.tabla,
                   COALESCE((SELECT string_agg(quote_literal(a), ',') FROM unnest(r.args) a), ''));
  END LOOP;
END $$;

-- ── 15 · Clasificación de lo sensible ────────────────────────────────
INSERT INTO plataforma.clasificacion_columna (esquema, tabla, columna, nivel, finalidad, cifrada, mecanismo, es_secreto) VALUES
 ('crm','peticiones_oracion','resumen',   3, 'Cuidado pastoral · oración', false, 'rls_y_bitacora', false),
 ('crm','peticiones_oracion','detalle',   3, 'Cuidado pastoral · oración', false, 'rls_y_bitacora', false),
 ('crm','peticiones_oracion','respuesta', 3, 'Cuidado pastoral · testimonio', false, 'rls_y_bitacora', false),
 ('crm','peticiones_oracion','categoria', 3, 'Cuidado pastoral · una categoría de salud es dato de salud', false, 'rls_y_bitacora', false),
 ('crm','peticiones_oracion','contacto',  2, 'Contacto de quien pide oración', false, 'enmascarado', false),
 ('plataforma','asuntos_legales','titulo',      3, 'Gestión jurídica de la iglesia', false, 'rls_y_bitacora', false),
 ('plataforma','asuntos_legales','contraparte', 3, 'Gestión jurídica de la iglesia', false, 'rls_y_bitacora', false),
 ('plataforma','asuntos_legales','resultado',   3, 'Gestión jurídica de la iglesia', false, 'rls_y_bitacora', false),
 ('plataforma','asuntos_legales_notas','contenido', 3, 'Gestión jurídica de la iglesia', false, 'rls_y_bitacora', false)
ON CONFLICT DO NOTHING;

-- ── 16 · Retención de lo que guarda datos de personas ────────────────
ALTER TABLE plataforma.politicas_retencion ADD COLUMN IF NOT EXISTS columna_fecha text;
COMMENT ON COLUMN plataforma.politicas_retencion.columna_fecha IS
  'Columna que mide la edad de la fila. Si falta, se busca por convención; si no se encuentra, la purga lo DICE.';
INSERT INTO plataforma.politicas_retencion (esquema, tabla, meses, accion, base_legal, decidido_por, columna_fecha) VALUES
 ('crm','peticiones_oracion', 24, 'purgar',
  'Propuesta: una petición de oración sirve mientras se acompaña; a los dos años se borra con sus oraciones.',
  'Propuesta técnica 21 sep 2026 · la ratifica el Responsable', 'creado_en'),
 ('crm','comunicaciones', 24, 'purgar',
  'Propuesta: el registro de un envío masivo sirve para responder reclamos; dos años bastan.',
  'Propuesta técnica 21 sep 2026 · la ratifica el Responsable', 'creada_en'),
 ('plataforma','asuntos_legales', 120, 'conservar',
  'Asuntos jurídicos: se conservan diez años (prescripción ordinaria, Código Civil art. 2536).',
  'Propuesta técnica 21 sep 2026 · la ratifica el Responsable', 'creado_en'),
 ('plataforma','asuntos_legales_notas', 120, 'conservar',
  'Actuaciones de un asunto jurídico: siguen la suerte del asunto.',
  'Propuesta técnica 21 sep 2026 · la ratifica el Responsable', 'escrita_en')
ON CONFLICT (esquema, tabla) DO NOTHING;
UPDATE plataforma.politicas_retencion SET columna_fecha = 'marcada_en'
 WHERE esquema = 'asistencia' AND tabla = 'entradas' AND columna_fecha IS NULL;

UPDATE plataforma.politicas_retencion SET columna_fecha = 'registrada_en'
 WHERE esquema = 'rocakids' AND tabla = 'condiciones_medicas' AND columna_fecha IS NULL;

/* ⛔ La purga, corregida. Al declarar la retención de los módulos nuevos
   aparecieron CUATRO defectos que nunca se vieron porque la purga real no
   se había corrido jamás:
   1. `asistencia.entradas` (marcada_en) y `rocakids.condiciones_medicas`
      (registrada_en) no tienen ninguna columna con los nombres de la
      convención: sus políticas NUNCA se aplicaron. Ahora cada política
      declara su columna y, si no la encuentra, lo dice.
   2. El simulacro de «anonimizar» armaba un SQL inválido. Ahora el
      simulacro es un conteo con la MISMA condición que la acción real.
   3. ⛔ Una alergia registrada hace trece meses se habría borrado aunque
      el niño siga viniendo cada domingo. La política dice «se conserva
      mientras sirve para cuidarlo»: en una tabla con `menor_id`, la edad
      se cuenta desde la última vez que ese niño vino, no desde el registro.
   4. ⛔ La primera purga real de `rocakids.checkins` habría ABORTADO
      entera: `intentos_entrega` (evidencia de salvaguarda, cinco años)
      apunta a esos checkins. Ahora una fila que otra tabla sigue
      referenciando no se borra: la evidencia manda, y se cuenta aparte. */
CREATE OR REPLACE FUNCTION plataforma.purgar_por_retencion(p_simulacro boolean DEFAULT true)
RETURNS TABLE(objeto text, que_hizo text, filas bigint)
LANGUAGE plpgsql AS $$
DECLARE r record; fk record; v_col text; v_n bigint; v_prot bigint; v_donde text; v_protegida text;
BEGIN
  FOR r IN SELECT pr.* FROM plataforma.politicas_retencion pr WHERE pr.accion <> 'conservar' LOOP
    v_col := r.columna_fecha;
    IF v_col IS NULL THEN
      SELECT a.attname INTO v_col
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = r.esquema AND c.relname = r.tabla AND NOT a.attisdropped
         AND a.attname IN ('ocurrido_en','ingreso_en','creado_en','registrado_en','fecha','creada_en')
       ORDER BY array_position(ARRAY['ocurrido_en','ingreso_en','fecha','registrado_en','creado_en','creada_en'], a.attname)
       LIMIT 1;
    END IF;
    IF v_col IS NULL OR NOT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = r.esquema AND table_name = r.tabla AND column_name = v_col) THEN
      RETURN QUERY SELECT (r.esquema||'.'||r.tabla)::text, 'SIN COLUMNA DE FECHA: la política no se aplica'::text, 0::bigint;
      CONTINUE;
    END IF;

    v_donde := format('t.%I < now() - make_interval(months => %s)', v_col, r.meses);
    IF r.accion = 'anonimizar' THEN
      v_donde := v_donde || ' AND t.persona_id IS NOT NULL';
    END IF;
    -- 3 · Dato de un menor: cuenta desde la última vez que vino.
    IF r.tabla <> 'checkins' AND EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = r.esquema AND table_name = r.tabla AND column_name = 'menor_id') THEN
      v_donde := v_donde || format(' AND NOT EXISTS (SELECT 1 FROM rocakids.checkins ck WHERE ck.menor_id = t.menor_id'
                                   ' AND ck.ingreso_en >= now() - make_interval(months => %s))', r.meses);
    END IF;
    -- 4 · Lo que otra tabla sigue referenciando (sin cascada) no se borra.
    v_protegida := '';
    IF r.accion = 'purgar' THEN
      FOR fk IN
        SELECT c.conrelid::regclass AS hija,
               (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1]) AS col_hija,
               (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attnum = c.confkey[1]) AS col_madre
          FROM pg_constraint c
         WHERE c.contype = 'f' AND c.confdeltype <> 'c'
           AND c.confrelid = format('%I.%I', r.esquema, r.tabla)::regclass
           AND array_length(c.conkey, 1) = 1
      LOOP
        v_protegida := v_protegida || format(' OR EXISTS (SELECT 1 FROM %s x WHERE x.%I = t.%I)',
                                             fk.hija, fk.col_hija, fk.col_madre);
      END LOOP;
    END IF;

    IF v_protegida <> '' THEN
      EXECUTE format('SELECT count(*) FROM %I.%I t WHERE %s AND (false%s)', r.esquema, r.tabla, v_donde, v_protegida)
         INTO v_prot;
      v_donde := v_donde || ' AND NOT (false' || v_protegida || ')';
    ELSE
      v_prot := 0;
    END IF;

    IF p_simulacro THEN
      EXECUTE format('SELECT count(*) FROM %I.%I t WHERE %s', r.esquema, r.tabla, v_donde) INTO v_n;
      RETURN QUERY SELECT (r.esquema||'.'||r.tabla)::text,
        ('simulacro · '||r.accion || CASE WHEN v_prot > 0 THEN ' · '||v_prot||' se conservan como evidencia' ELSE '' END)::text,
        COALESCE(v_n, 0);
    ELSE
      IF r.accion = 'purgar' THEN
        EXECUTE format('DELETE FROM %I.%I t WHERE %s', r.esquema, r.tabla, v_donde);
      ELSIF r.accion = 'anonimizar' THEN
        EXECUTE format('UPDATE %I.%I t SET persona_id = NULL WHERE %s', r.esquema, r.tabla, v_donde);
      ELSE
        RETURN QUERY SELECT (r.esquema||'.'||r.tabla)::text, ('acción sin implementar: '||r.accion)::text, 0::bigint;
        CONTINUE;
      END IF;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      RETURN QUERY SELECT (r.esquema||'.'||r.tabla)::text,
        (r.accion || CASE WHEN v_prot > 0 THEN ' · '||v_prot||' se conservan como evidencia' ELSE '' END)::text, v_n;
    END IF;
  END LOOP;

  IF NOT p_simulacro THEN
    INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
    VALUES ('purgar_por_retencion', 'plataforma', jsonb_build_object('ejecutada', true));
  END IF;
END $$;

-- ── 17 · La hora de cada sede ────────────────────────────────────────
/* ⛔ El calendario guarda instantes con zona, y las sedes no tenían zona:
   un culto a las 10:00 en Barcelona se habría guardado como las 10:00 de
   Bogotá, siete horas corrido. La zona sale del país y se puede ajustar. */
CREATE OR REPLACE FUNCTION org.zona_de_pais(p_pais text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE upper(p_pais)
    WHEN 'CO' THEN 'America/Bogota'  WHEN 'PA' THEN 'America/Panama'  WHEN 'ES' THEN 'Europe/Madrid'
    WHEN 'EC' THEN 'America/Guayaquil' WHEN 'PE' THEN 'America/Lima' WHEN 'MX' THEN 'America/Mexico_City'
    WHEN 'CR' THEN 'America/Costa_Rica' WHEN 'GT' THEN 'America/Guatemala' WHEN 'VE' THEN 'America/Caracas'
    WHEN 'CL' THEN 'America/Santiago' WHEN 'AR' THEN 'America/Argentina/Buenos_Aires' WHEN 'US' THEN 'America/New_York'
    ELSE 'America/Bogota' END;
$$;
CREATE OR REPLACE FUNCTION org.zona_valida(p_zona text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_zona);
$$;
/* La columna nace llena y sin valor por omisión, ANTES de cualquier
   UPDATE: un ALTER después de tocar filas choca con los disparadores
   diferidos de la tabla («pending trigger events»). */
ALTER TABLE org.sedes ADD COLUMN IF NOT EXISTS zona_horaria text NOT NULL DEFAULT 'America/Bogota';
ALTER TABLE org.sedes ALTER COLUMN zona_horaria DROP DEFAULT;
CREATE OR REPLACE FUNCTION org.tg_zona_de_la_sede()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.zona_horaria IS NULL OR (TG_OP = 'UPDATE' AND NEW.pais IS DISTINCT FROM OLD.pais
                                  AND NEW.zona_horaria = OLD.zona_horaria) THEN
    NEW.zona_horaria := org.zona_de_pais(NEW.pais);
  END IF;
  IF NOT org.zona_valida(NEW.zona_horaria) THEN
    RAISE EXCEPTION 'La zona horaria «%» no existe. Use un nombre como America/Bogota.', NEW.zona_horaria
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_zona_de_la_sede BEFORE INSERT OR UPDATE OF pais, zona_horaria ON org.sedes
  FOR EACH ROW EXECUTE FUNCTION org.tg_zona_de_la_sede();
UPDATE org.sedes SET zona_horaria = org.zona_de_pais(pais) WHERE zona_horaria <> org.zona_de_pais(pais);

-- ── 18 · Las etiquetas que la gente lee, bien escritas ─────────────
/* ⛔ Las semillas se generaron desde los códigos y las etiquetas salieron
   sin tildes y con mayúsculas de título: «Union Libre», «Lider», «Termino
   Fijo», «Oracion». Son lo que aparece en cada lista desplegable de la
   aplicación. El código no cambia (es la llave); la etiqueta, sí. */
UPDATE sistema.catalogo_valores v SET etiqueta = x.etiqueta
  FROM (VALUES
    ('estado_civil','union_libre','Unión libre'),
    ('medio_pago','pse','PSE'), ('medio_pago','datafono','Datáfono'),
    ('medio_pago','nequi_daviplata','Nequi o Daviplata'), ('medio_pago','consignacion','Consignación'),
    ('nivel_compromiso','lider','Líder'),
    ('reaccion_contacto','no_interesado','No interesado'), ('reaccion_contacto','no_contesto','No contestó'),
    ('rol_membresia','anfitrion','Anfitrión'), ('rol_membresia','lider','Líder'), ('rol_membresia','colider','Colíder'),
    ('tipo_aporte','donacion','Donación'),
    ('tipo_contrato','termino_indefinido','Término indefinido'), ('tipo_contrato','termino_fijo','Término fijo'),
    ('tipo_contrato','obra_labor','Obra o labor'), ('tipo_contrato','prestacion_servicios','Prestación de servicios'),
    ('tipo_grupo','pequeno','Grupo pequeño'),
    ('tipo_servicio','entre_semana','Entre semana'), ('tipo_servicio','oracion','Oración'), ('tipo_servicio','celula','Célula')
  ) AS x(catalogo, codigo, etiqueta)
 WHERE v.catalogo = x.catalogo AND v.codigo = x.codigo AND v.etiqueta IS DISTINCT FROM x.etiqueta;

COMMIT;
