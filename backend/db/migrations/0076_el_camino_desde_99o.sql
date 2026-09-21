-- =====================================================================
-- 0076 · EL CAMINO DESDE 99-o (ADR-006)
--
-- La iglesia usa 99-o hoy. Salir de ahí sin perder a nadie exige cinco
-- cosas que aquí quedan escritas en la base:
--   1. un área de aterrizaje (`migracion`) a la que la aplicación no
--      tiene acceso: nada toca las tablas vivas sin pasar la validación;
--   2. mapas de valores EDITABLES (tipo de documento, parentesco, canal):
--      la exportación real traerá valores que hoy no conocemos;
--   3. rechazos y avisos con la regla que falló, fila por fila;
--   4. aplicación por bloques, idempotente y reanudable, que registra
--      CADA fila que crea: revertir una ola borra exactamente lo suyo;
--   5. conciliación por sede antes de encender nada.
-- =====================================================================
BEGIN;

CREATE SCHEMA IF NOT EXISTS migracion;
REVOKE ALL ON SCHEMA migracion FROM PUBLIC;
COMMENT ON SCHEMA migracion IS 'Área de aterrizaje de la migración desde 99-o. La aplicación NO tiene acceso: se opera con scripts/migrar-99o.sh.';

CREATE TABLE migracion.lotes (
  id           bigserial PRIMARY KEY,
  origen       text NOT NULL DEFAULT '99o',
  descripcion  text NOT NULL,
  estado       text NOT NULL DEFAULT 'cargado'
               CHECK (estado IN ('cargado','validado','aplicando','aplicado','revertido')),
  creado_en    timestamptz NOT NULL DEFAULT now(),
  validado_en  timestamptz,
  aplicado_en  timestamptz,
  revertido_en timestamptz,
  notas        text
);

/* Qué iglesia de 99-o es qué sede de CasaRoca. Lo llena la iglesia: sin
   esto no se carga nada, y la validación lo dice por fila. */
CREATE TABLE migracion.mapa_sedes (
  church_id   text PRIMARY KEY,
  sede_id     uuid NOT NULL REFERENCES org.sedes(id),
  nombre_99o  text,
  confirmado_por text,
  confirmado_en  timestamptz
);

/* Traducción de valores de 99-o a los códigos de CasaRoca. Editable: un
   valor nuevo en la exportación real se agrega aquí, no en el código. */
CREATE TABLE migracion.mapa_valores (
  campo          text NOT NULL,
  valor_origen   text NOT NULL,
  valor_destino  text NOT NULL,
  PRIMARY KEY (campo, valor_origen)
);
INSERT INTO migracion.mapa_valores (campo, valor_origen, valor_destino) VALUES
 ('tipo_documento','cc','CC'),('tipo_documento','cedula de ciudadania','CC'),('tipo_documento','cédula de ciudadanía','CC'),
 ('tipo_documento','ti','TI'),('tipo_documento','tarjeta de identidad','TI'),
 ('tipo_documento','rc','RC'),('tipo_documento','registro civil','RC'),
 ('tipo_documento','ce','CE'),('tipo_documento','cedula de extranjeria','CE'),('tipo_documento','cédula de extranjería','CE'),
 ('tipo_documento','pa','PA'),('tipo_documento','pasaporte','PA'),
 ('tipo_documento','pep','PEP'),('tipo_documento','ppt','PPT'),('tipo_documento','nit','NIT'),
 ('genero','m','M'),('genero','masculino','M'),('genero','hombre','M'),
 ('genero','f','F'),('genero','femenino','F'),('genero','mujer','F'),
 ('estado_civil','soltero','soltero'),('estado_civil','soltera','soltero'),('estado_civil','soltero(a)','soltero'),
 ('estado_civil','casado','casado'),('estado_civil','casada','casado'),('estado_civil','casado(a)','casado'),
 ('estado_civil','union libre','union_libre'),('estado_civil','unión libre','union_libre'),
 ('estado_civil','divorciado','divorciado'),('estado_civil','divorciada','divorciado'),('estado_civil','divorciado(a)','divorciado'),
 ('estado_civil','viudo','viudo'),('estado_civil','viuda','viudo'),('estado_civil','viudo(a)','viudo'),
 ('estado_civil','separado','separado'),('estado_civil','separada','separado'),('estado_civil','separado(a)','separado'),
 ('parentesco','padre','PADRE'),('parentesco','madre','MADRE'),('parentesco','abuelo','ABUELO'),('parentesco','abuela','ABUELA'),
 ('parentesco','tio','TIO'),('parentesco','tío','TIO'),('parentesco','tia','TIA'),('parentesco','tía','TIA'),
 ('parentesco','tutor','TUTOR'),('parentesco','tutora','TUTOR'),('parentesco','acudiente','ACUDIENTE'),('parentesco','cuidador','CUIDADOR'),
 ('canal','correo','email'),('canal','email','email'),('canal','e-mail','email'),
 ('canal','telefono','llamada'),('canal','teléfono','llamada'),('canal','llamada','llamada'),
 ('canal','whatsapp','whatsapp'),('canal','sms','sms'),
 ('tipo_grupo','grupo familiar','familiar'),('tipo_grupo','familiar','familiar'),
 ('tipo_grupo','grupo pequeño','pequeno'),('tipo_grupo','grupo pequeno','pequeno'),('tipo_grupo','pequeño','pequeno'),
 ('tipo_grupo','discipulado','discipulado'),('tipo_grupo','ministerial','ministerial')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION migracion.traducir(p_campo text, p_valor text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT valor_destino FROM migracion.mapa_valores
   WHERE campo = p_campo AND valor_origen = lower(btrim(p_valor));
$$;

/* Fecha de 99-o (AAAA-MM-DD o DD/MM/AAAA). Lo que no se entiende es NULL,
   y la validación lo avisa; nunca se inventa una fecha. */
CREATE OR REPLACE FUNCTION migracion.fecha(p text)
RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p IS NULL OR btrim(p) = '' THEN RETURN NULL; END IF;
  IF p ~ '^\d{4}-\d{2}-\d{2}' THEN RETURN substr(p, 1, 10)::date; END IF;
  IF p ~ '^\d{2}/\d{2}/\d{4}$' THEN RETURN to_date(p, 'DD/MM/YYYY'); END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

-- ── Las tablas de aterrizaje: el formato de la exportación ────────────
CREATE TABLE migracion.o99_personas (
  lote_id bigint NOT NULL REFERENCES migracion.lotes(id), fila integer NOT NULL,
  id_origen text NOT NULL, church_id text, tipo_documento text, documento text,
  nombres text, apellidos text, fecha_nacimiento text, genero text, estado_civil text,
  email text, telefono text, direccion text, creado_en text,
  PRIMARY KEY (lote_id, id_origen));
CREATE INDEX o99_personas_fila ON migracion.o99_personas (lote_id, fila);
CREATE TABLE migracion.o99_acudientes (
  lote_id bigint NOT NULL REFERENCES migracion.lotes(id),
  menor_id_origen text NOT NULL, acudiente_id_origen text NOT NULL, parentesco text, autoriza_retiro text,
  PRIMARY KEY (lote_id, menor_id_origen, acudiente_id_origen));
CREATE TABLE migracion.o99_grupos (
  lote_id bigint NOT NULL REFERENCES migracion.lotes(id), id_origen text NOT NULL,
  church_id text, nombre text, tipo text, dia text, hora text,
  PRIMARY KEY (lote_id, id_origen));
CREATE TABLE migracion.o99_membresias (
  lote_id bigint NOT NULL REFERENCES migracion.lotes(id),
  grupo_id_origen text NOT NULL, persona_id_origen text NOT NULL, rol text, desde text, hasta text,
  PRIMARY KEY (lote_id, grupo_id_origen, persona_id_origen));
CREATE TABLE migracion.o99_consentimientos (
  lote_id bigint NOT NULL REFERENCES migracion.lotes(id), fila integer NOT NULL,
  persona_id_origen text NOT NULL, canal text, acto text, ocurrido_en text,
  PRIMARY KEY (lote_id, fila));

-- ── Lo que no entra, y por qué ────────────────────────────────────────
CREATE TABLE migracion.rechazos (
  id bigserial PRIMARY KEY, lote_id bigint NOT NULL REFERENCES migracion.lotes(id),
  tabla text NOT NULL, id_origen text NOT NULL, regla text NOT NULL, detalle text,
  creado_en timestamptz NOT NULL DEFAULT now());
CREATE INDEX rechazos_lote ON migracion.rechazos (lote_id, tabla, id_origen);
/* Lo que entra con un ajuste (un correo compartido que se deja en la
   primera persona, un tipo de documento sin equivalente). */
CREATE TABLE migracion.avisos (
  id bigserial PRIMARY KEY, lote_id bigint NOT NULL REFERENCES migracion.lotes(id),
  tabla text NOT NULL, id_origen text NOT NULL, regla text NOT NULL, detalle text,
  creado_en timestamptz NOT NULL DEFAULT now());
CREATE INDEX avisos_lote ON migracion.avisos (lote_id, tabla, id_origen);

/* CADA fila que crea la migración, con su lote: revertir borra esto y
   nada más. */
CREATE TABLE migracion.aplicados (
  lote_id bigint NOT NULL REFERENCES migracion.lotes(id),
  tabla text NOT NULL, destino_id uuid NOT NULL, id_origen text,
  PRIMARY KEY (lote_id, tabla, destino_id));
CREATE TABLE migracion.progreso (
  lote_id bigint NOT NULL REFERENCES migracion.lotes(id), paso text NOT NULL,
  hecho integer NOT NULL DEFAULT 0, actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lote_id, paso));

/* Vista de trabajo: cada persona del lote con sus valores ya traducidos. */
CREATE OR REPLACE VIEW migracion.v_personas_traducidas WITH (security_invoker = true) AS
SELECT o.lote_id, o.fila, o.id_origen, ms.sede_id,
       migracion.traducir('tipo_documento', o.tipo_documento) AS tipo_documento,
       NULLIF(btrim(o.documento), '') AS documento,
       initcap(btrim(split_part(btrim(o.nombres), ' ', 1))) AS primer_nombre,
       NULLIF(initcap(btrim(substr(btrim(o.nombres), length(split_part(btrim(o.nombres), ' ', 1)) + 1))), '') AS segundo_nombre,
       initcap(btrim(split_part(btrim(o.apellidos), ' ', 1))) AS primer_apellido,
       NULLIF(initcap(btrim(substr(btrim(o.apellidos), length(split_part(btrim(o.apellidos), ' ', 1)) + 1))), '') AS segundo_apellido,
       migracion.fecha(o.fecha_nacimiento) AS fecha_nacimiento,
       migracion.traducir('genero', o.genero) AS genero,
       migracion.traducir('estado_civil', o.estado_civil) AS estado_civil,
       lower(NULLIF(btrim(o.email), '')) AS email,
       NULLIF(regexp_replace(COALESCE(o.telefono, ''), '[^0-9+]', '', 'g'), '') AS telefono,
       NULLIF(btrim(o.direccion), '') AS direccion,
       migracion.fecha(o.creado_en) AS creado_en,
       nucleo.es_menor(migracion.fecha(o.fecha_nacimiento)) AS es_menor
  FROM migracion.o99_personas o
  LEFT JOIN migracion.mapa_sedes ms ON ms.church_id = o.church_id;

-- ═════════════════════════════════════════════════════════════════════
-- VALIDAR · nada se aplica sin pasar por aquí
-- ═════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION migracion.validar(p_lote bigint)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_estado text;
BEGIN
  SELECT estado INTO v_estado FROM migracion.lotes WHERE id = p_lote FOR UPDATE;
  IF v_estado IS NULL THEN RAISE EXCEPTION 'No existe el lote %.', p_lote; END IF;
  IF v_estado NOT IN ('cargado', 'validado', 'revertido') THEN
    RAISE EXCEPTION 'El lote % está «%»: solo se valida lo cargado (o lo revertido, para reintentarlo).', p_lote, v_estado;
  END IF;
  DELETE FROM migracion.rechazos WHERE lote_id = p_lote;
  DELETE FROM migracion.avisos WHERE lote_id = p_lote;

  -- Personas: lo que las deja fuera.
  INSERT INTO migracion.rechazos (lote_id, tabla, id_origen, regla, detalle)
  SELECT p_lote, 'personas', t.id_origen, x.regla, x.detalle
    FROM migracion.v_personas_traducidas t
    CROSS JOIN LATERAL (VALUES
      (CASE WHEN t.sede_id IS NULL THEN 'SEDE_SIN_MAPEAR' END,
       'La iglesia de 99-o no está en migracion.mapa_sedes.'),
      (CASE WHEN COALESCE(t.primer_nombre, '') = '' OR COALESCE(t.primer_apellido, '') = '' THEN 'SIN_NOMBRE' END,
       'Falta el nombre o el apellido.')
    ) AS x(regla, detalle)
   WHERE t.lote_id = p_lote AND x.regla IS NOT NULL;

  -- El mismo documento dos veces en el lote: lo decide una persona.
  INSERT INTO migracion.rechazos (lote_id, tabla, id_origen, regla, detalle)
  SELECT p_lote, 'personas', t.id_origen, 'DOCUMENTO_DUPLICADO',
         'El documento ' || t.tipo_documento || ' ' || t.documento || ' aparece en ' || n || ' personas del lote.'
    FROM (SELECT t.*, count(*) OVER (PARTITION BY t.tipo_documento, t.documento) AS n
            FROM migracion.v_personas_traducidas t
           WHERE t.lote_id = p_lote AND t.documento IS NOT NULL AND t.tipo_documento IS NOT NULL) t
   WHERE t.n > 1;
  -- Y el que ya existe en CasaRoca con otro origen.
  INSERT INTO migracion.rechazos (lote_id, tabla, id_origen, regla, detalle)
  SELECT p_lote, 'personas', t.id_origen, 'DOCUMENTO_YA_EXISTE',
         'Ya hay una persona en CasaRoca con ese documento: se une con la herramienta de duplicados, no se crea otra.'
    FROM migracion.v_personas_traducidas t
    JOIN nucleo.personas p ON p.tipo_documento = t.tipo_documento AND p.numero_documento = t.documento
                          AND p.eliminado_en IS NULL AND p.source_system IS DISTINCT FROM '99o'
   WHERE t.lote_id = p_lote;

  -- Avisos: entra, con un ajuste que se dice.
  INSERT INTO migracion.avisos (lote_id, tabla, id_origen, regla, detalle)
  SELECT p_lote, 'personas', o.id_origen, 'TIPO_DOCUMENTO_SIN_EQUIVALENTE',
         'Tipo «' || o.tipo_documento || '»: entra sin documento. Agréguelo a migracion.mapa_valores (y al catálogo si hace falta) y vuelva a validar.'
    FROM migracion.o99_personas o
   WHERE o.lote_id = p_lote AND NULLIF(btrim(o.tipo_documento), '') IS NOT NULL
     AND migracion.traducir('tipo_documento', o.tipo_documento) IS NULL;
  INSERT INTO migracion.avisos (lote_id, tabla, id_origen, regla, detalle)
  SELECT p_lote, 'personas', t.id_origen, 'CORREO_INVALIDO', 'El correo no tiene forma de correo: entra sin correo.'
    FROM migracion.v_personas_traducidas t
   WHERE t.lote_id = p_lote AND t.email IS NOT NULL AND t.email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$';
  INSERT INTO migracion.avisos (lote_id, tabla, id_origen, regla, detalle)
  SELECT p_lote, 'personas', t.id_origen, 'CORREO_COMPARTIDO',
         'El correo lo comparte con otra persona del lote (suele ser la pareja): se queda en la primera y esta entra sin correo.'
    FROM (SELECT t.*, row_number() OVER (PARTITION BY t.email ORDER BY t.fila) AS orden
            FROM migracion.v_personas_traducidas t
           WHERE t.lote_id = p_lote AND t.email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$') t
   WHERE t.orden > 1;
  INSERT INTO migracion.avisos (lote_id, tabla, id_origen, regla, detalle)
  SELECT p_lote, 'personas', t.id_origen, 'CORREO_YA_EXISTE',
         'Ese correo ya lo tiene otra persona en CasaRoca: entra sin correo.'
    FROM migracion.v_personas_traducidas t
    JOIN nucleo.personas p ON p.email_principal = t.email AND p.eliminado_en IS NULL
                          AND p.source_system IS DISTINCT FROM '99o'
   WHERE t.lote_id = p_lote;
  INSERT INTO migracion.avisos (lote_id, tabla, id_origen, regla, detalle)
  SELECT p_lote, 'personas', o.id_origen, 'FECHA_NACIMIENTO_ILEGIBLE',
         'La fecha «' || o.fecha_nacimiento || '» no se entiende: entra sin fecha de nacimiento.'
    FROM migracion.o99_personas o
   WHERE o.lote_id = p_lote AND NULLIF(btrim(o.fecha_nacimiento), '') IS NOT NULL
     AND migracion.fecha(o.fecha_nacimiento) IS NULL;

  -- Acudientes: el vínculo tiene que dar custodia y apuntar a alguien que entra.
  INSERT INTO migracion.rechazos (lote_id, tabla, id_origen, regla, detalle)
  SELECT p_lote, 'acudientes', a.menor_id_origen || '>' || a.acudiente_id_origen, 'PARENTESCO_SIN_CUSTODIA',
         'Parentesco «' || COALESCE(a.parentesco, '') || '»: no existe o no confiere custodia.'
    FROM migracion.o99_acudientes a
    LEFT JOIN nucleo.tipos_vinculo v ON v.codigo = migracion.traducir('parentesco', a.parentesco)
   WHERE a.lote_id = p_lote AND COALESCE(v.confiere_custodia, false) = false;

  -- ⛔ Un menor sin un acudiente válido que entre con él no se carga.
  INSERT INTO migracion.rechazos (lote_id, tabla, id_origen, regla, detalle)
  SELECT p_lote, 'personas', t.id_origen, 'MENOR_SIN_ACUDIENTE',
         'Es menor de edad y no trae un acudiente con custodia que también entre: no se recibe un menor sin acudiente.'
    FROM migracion.v_personas_traducidas t
   WHERE t.lote_id = p_lote AND t.es_menor
     AND NOT EXISTS (
       SELECT 1 FROM migracion.o99_acudientes a
         JOIN nucleo.tipos_vinculo v ON v.codigo = migracion.traducir('parentesco', a.parentesco) AND v.confiere_custodia
         JOIN migracion.v_personas_traducidas g ON g.lote_id = p_lote AND g.id_origen = a.acudiente_id_origen AND NOT g.es_menor
        WHERE a.lote_id = p_lote AND a.menor_id_origen = t.id_origen
          AND NOT EXISTS (SELECT 1 FROM migracion.rechazos r WHERE r.lote_id = p_lote AND r.tabla = 'personas'
                                                          AND r.id_origen = g.id_origen));

  -- Grupos y membresías.
  INSERT INTO migracion.rechazos (lote_id, tabla, id_origen, regla, detalle)
  SELECT p_lote, 'grupos', g.id_origen, 'SEDE_SIN_MAPEAR', 'La iglesia del grupo no está mapeada.'
    FROM migracion.o99_grupos g LEFT JOIN migracion.mapa_sedes ms ON ms.church_id = g.church_id
   WHERE g.lote_id = p_lote AND ms.sede_id IS NULL;
  INSERT INTO migracion.avisos (lote_id, tabla, id_origen, regla, detalle)
  SELECT p_lote, 'grupos', g.id_origen, 'TIPO_GRUPO_SIN_EQUIVALENTE',
         'Tipo «' || COALESCE(g.tipo, '') || '»: entra como grupo pequeño.'
    FROM migracion.o99_grupos g
   WHERE g.lote_id = p_lote AND migracion.traducir('tipo_grupo', g.tipo) IS NULL;
  INSERT INTO migracion.rechazos (lote_id, tabla, id_origen, regla, detalle)
  SELECT p_lote, 'membresias', m.grupo_id_origen || '>' || m.persona_id_origen, 'REFERENCIA_ROTA',
         'La persona o el grupo no entran en este lote.'
    FROM migracion.o99_membresias m
   WHERE m.lote_id = p_lote
     AND (NOT EXISTS (SELECT 1 FROM migracion.o99_personas o WHERE o.lote_id = p_lote AND o.id_origen = m.persona_id_origen)
       OR NOT EXISTS (SELECT 1 FROM migracion.o99_grupos g WHERE g.lote_id = p_lote AND g.id_origen = m.grupo_id_origen)
       OR EXISTS (SELECT 1 FROM migracion.rechazos r WHERE r.lote_id = p_lote
                   AND ((r.tabla = 'personas' AND r.id_origen = m.persona_id_origen)
                     OR (r.tabla = 'grupos' AND r.id_origen = m.grupo_id_origen))));

  -- Una salida anterior a la entrada: no se adivina cuál fecha está mal.
  INSERT INTO migracion.rechazos (lote_id, tabla, id_origen, regla, detalle)
  SELECT p_lote, 'membresias', m.grupo_id_origen || '>' || m.persona_id_origen, 'FECHAS_INVERTIDAS',
         'Sale del grupo (' || m.hasta || ') antes de entrar (' || m.desde || '): lo corrige quien conoce el grupo.'
    FROM migracion.o99_membresias m
   WHERE m.lote_id = p_lote AND migracion.fecha(m.hasta) < migracion.fecha(m.desde)
     AND NOT EXISTS (SELECT 1 FROM migracion.rechazos r WHERE r.lote_id = p_lote AND r.tabla = 'membresias'
                      AND r.id_origen = m.grupo_id_origen || '>' || m.persona_id_origen);

  -- Consentimientos: sin fecha legible no prueban nada, y no entran.
  INSERT INTO migracion.rechazos (lote_id, tabla, id_origen, regla, detalle)
  SELECT p_lote, 'consentimientos', c.fila::text, x.regla, x.detalle
    FROM migracion.o99_consentimientos c
    CROSS JOIN LATERAL (VALUES
      (CASE WHEN migracion.traducir('canal', c.canal) IS NULL THEN 'CANAL_SIN_EQUIVALENTE' END, 'Canal «' || COALESCE(c.canal, '') || '».'),
      (CASE WHEN migracion.fecha(c.ocurrido_en) IS NULL OR migracion.fecha(c.ocurrido_en) > CURRENT_DATE THEN 'CONSENTIMIENTO_SIN_FECHA' END,
       'Un consentimiento sin fecha cierta no prueba nada ante la SIC: no se migra como otorgado.'),
      (CASE WHEN lower(COALESCE(c.acto, '')) NOT IN ('otorgado','revocado','si','sí','no') THEN 'ACTO_ILEGIBLE' END,
       'Acto «' || COALESCE(c.acto, '') || '».'),
      (CASE WHEN EXISTS (SELECT 1 FROM migracion.rechazos r WHERE r.lote_id = p_lote AND r.tabla = 'personas'
                          AND r.id_origen = c.persona_id_origen)
              OR NOT EXISTS (SELECT 1 FROM migracion.o99_personas o WHERE o.lote_id = p_lote AND o.id_origen = c.persona_id_origen)
            THEN 'REFERENCIA_ROTA' END, 'La persona no entra en este lote.')
    ) AS x(regla, detalle)
   WHERE c.lote_id = p_lote AND x.regla IS NOT NULL;

  UPDATE migracion.lotes SET estado = 'validado', validado_en = now() WHERE id = p_lote;
  RETURN migracion.resumen(p_lote);
END $$;

CREATE OR REPLACE FUNCTION migracion.resumen(p_lote bigint)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'lote', p_lote,
    'estado', (SELECT estado FROM migracion.lotes WHERE id = p_lote),
    'personas', (SELECT count(*) FROM migracion.o99_personas WHERE lote_id = p_lote),
    'personas_rechazadas', (SELECT count(DISTINCT id_origen) FROM migracion.rechazos WHERE lote_id = p_lote AND tabla = 'personas'),
    'grupos', (SELECT count(*) FROM migracion.o99_grupos WHERE lote_id = p_lote),
    'membresias', (SELECT count(*) FROM migracion.o99_membresias WHERE lote_id = p_lote),
    'consentimientos', (SELECT count(*) FROM migracion.o99_consentimientos WHERE lote_id = p_lote),
    'rechazos_por_regla', (SELECT COALESCE(jsonb_object_agg(regla, n), '{}'::jsonb)
                             FROM (SELECT regla, count(*) AS n FROM migracion.rechazos WHERE lote_id = p_lote GROUP BY 1) x),
    'avisos_por_regla', (SELECT COALESCE(jsonb_object_agg(regla, n), '{}'::jsonb)
                           FROM (SELECT regla, count(*) AS n FROM migracion.avisos WHERE lote_id = p_lote GROUP BY 1) x),
    'aplicados', (SELECT COALESCE(jsonb_object_agg(tabla, n), '{}'::jsonb)
                    FROM (SELECT tabla, count(*) AS n FROM migracion.aplicados WHERE lote_id = p_lote GROUP BY 1) x));
$$;

-- ═════════════════════════════════════════════════════════════════════
-- APLICAR · por bloques de filas, idempotente, registrando cada fila
-- ═════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION migracion.preparar_aplicacion(p_lote bigint)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_estado text;
BEGIN
  SELECT estado INTO v_estado FROM migracion.lotes WHERE id = p_lote FOR UPDATE;
  IF v_estado NOT IN ('validado', 'aplicando') THEN
    RAISE EXCEPTION 'El lote % está «%»: primero se valida.', p_lote, v_estado;
  END IF;
  UPDATE migracion.lotes SET estado = 'aplicando' WHERE id = p_lote;
END $$;

/* Personas del rango de filas [desde, hasta]. Los menores entran en el
   MISMO bloque que sus acudientes (la regla del menor sin acudiente se
   comprueba al confirmar): por eso los adultos se aplican primero y los
   menores después, cada uno con sus vínculos. */
CREATE OR REPLACE FUNCTION migracion.aplicar_personas(p_lote bigint, p_desde integer, p_hasta integer, p_menores boolean)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_n integer; v_links integer;
BEGIN
  PERFORM set_config('app.motivo', 'Migración desde 99-o · lote ' || p_lote, true);
  WITH candidatos AS (
    SELECT t.*,
           CASE WHEN EXISTS (SELECT 1 FROM migracion.avisos a WHERE a.lote_id = p_lote AND a.tabla = 'personas'
                               AND a.id_origen = t.id_origen AND a.regla IN ('CORREO_INVALIDO','CORREO_COMPARTIDO','CORREO_YA_EXISTE'))
                THEN NULL ELSE t.email END AS email_final
      FROM migracion.v_personas_traducidas t
     WHERE t.lote_id = p_lote AND t.fila BETWEEN p_desde AND p_hasta AND t.es_menor = p_menores
       AND NOT EXISTS (SELECT 1 FROM migracion.rechazos r WHERE r.lote_id = p_lote AND r.tabla = 'personas' AND r.id_origen = t.id_origen)
       AND NOT EXISTS (SELECT 1 FROM nucleo.personas p WHERE p.source_system = '99o' AND p.source_id = t.id_origen)),
  nuevas AS (
    INSERT INTO nucleo.personas (sede_id, tipo_documento, numero_documento, primer_nombre, segundo_nombre, primer_apellido,
                                 segundo_apellido, fecha_nacimiento, genero, estado_civil, email_principal, telefono_movil,
                                 direccion, source_system, source_id, source_payload)
    SELECT c.sede_id, CASE WHEN c.documento IS NOT NULL THEN c.tipo_documento END,
           CASE WHEN c.tipo_documento IS NOT NULL THEN c.documento END,
           c.primer_nombre, c.segundo_nombre, c.primer_apellido, c.segundo_apellido, c.fecha_nacimiento,
           c.genero::nucleo.genero, c.estado_civil, c.email_final, c.telefono, c.direccion, '99o', c.id_origen,
           jsonb_build_object('lote', p_lote, 'fila', c.fila, 'creado_en_99o', c.creado_en)
      FROM candidatos c
    ON CONFLICT (source_system, source_id) WHERE source_system IS NOT NULL DO NOTHING
    RETURNING id, source_id)
  INSERT INTO migracion.aplicados (lote_id, tabla, destino_id, id_origen)
  SELECT p_lote, 'personas', id, source_id FROM nuevas;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF p_menores THEN
    -- Los vínculos de los menores de ESTE bloque, en la misma transacción.
    WITH vinculos AS (
      INSERT INTO nucleo.acudientes (menor_id, acudiente_id, parentesco, es_principal, autoriza_retiro)
      SELECT m.id, g.id, migracion.traducir('parentesco', a.parentesco),
             row_number() OVER (PARTITION BY m.id ORDER BY a.acudiente_id_origen) = 1,
             lower(COALESCE(a.autoriza_retiro, 'si')) IN ('si','sí','true','1')
        FROM migracion.o99_acudientes a
        JOIN migracion.o99_personas om ON om.lote_id = p_lote AND om.id_origen = a.menor_id_origen
                                      AND om.fila BETWEEN p_desde AND p_hasta
        JOIN nucleo.personas m ON m.source_system = '99o' AND m.source_id = a.menor_id_origen
        JOIN nucleo.personas g ON g.source_system = '99o' AND g.source_id = a.acudiente_id_origen
        JOIN nucleo.tipos_vinculo v ON v.codigo = migracion.traducir('parentesco', a.parentesco) AND v.confiere_custodia
       WHERE a.lote_id = p_lote
      ON CONFLICT DO NOTHING
      RETURNING id)
    INSERT INTO migracion.aplicados (lote_id, tabla, destino_id)
    SELECT p_lote, 'acudientes', id FROM vinculos;
    GET DIAGNOSTICS v_links = ROW_COUNT;
  END IF;

  INSERT INTO migracion.progreso (lote_id, paso, hecho)
  VALUES (p_lote, CASE WHEN p_menores THEN 'menores' ELSE 'adultos' END, p_hasta)
  ON CONFLICT (lote_id, paso) DO UPDATE SET hecho = GREATEST(migracion.progreso.hecho, EXCLUDED.hecho), actualizado_en = now();
  RETURN v_n;
END $$;

CREATE OR REPLACE FUNCTION migracion.aplicar_grupos_y_membresias(p_lote bigint)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_g integer; v_m integer;
BEGIN
  PERFORM set_config('app.motivo', 'Migración desde 99-o · lote ' || p_lote, true);
  WITH nuevos AS (
    INSERT INTO grupos.grupos (sede_id, tipo, nombre, dia_reunion, hora_reunion, source_system, source_id)
    SELECT ms.sede_id, COALESCE(migracion.traducir('tipo_grupo', g.tipo), 'pequeno'), btrim(g.nombre),
           /* 99-o escribe «miércoles» y «sábado»; la base guarda el día sin
              tilde. Un día que no es día entra vacío, nunca inventado. */
           CASE WHEN translate(lower(btrim(g.dia)), 'áéíóú', 'aeiou')
                     IN ('lunes','martes','miercoles','jueves','viernes','sabado','domingo')
                THEN translate(lower(btrim(g.dia)), 'áéíóú', 'aeiou') END,
           CASE WHEN g.hora ~ '^\d{1,2}:\d{2}' THEN substr(g.hora, 1, 5)::time END, '99o', g.id_origen
      FROM migracion.o99_grupos g JOIN migracion.mapa_sedes ms ON ms.church_id = g.church_id
     WHERE g.lote_id = p_lote
       AND NOT EXISTS (SELECT 1 FROM migracion.rechazos r WHERE r.lote_id = p_lote AND r.tabla = 'grupos' AND r.id_origen = g.id_origen)
    ON CONFLICT (source_system, source_id) WHERE source_system IS NOT NULL DO NOTHING
    RETURNING id, source_id)
  INSERT INTO migracion.aplicados (lote_id, tabla, destino_id, id_origen) SELECT p_lote, 'grupos', id, source_id FROM nuevos;
  GET DIAGNOSTICS v_g = ROW_COUNT;

  WITH nuevas AS (
    INSERT INTO grupos.membresias (grupo_id, persona_id, rol, fecha_ingreso, fecha_salida, motivo_salida, source_system, source_id)
    SELECT gr.id, p.id, 'miembro', COALESCE(migracion.fecha(m.desde), CURRENT_DATE), migracion.fecha(m.hasta),
           CASE WHEN migracion.fecha(m.hasta) IS NOT NULL THEN 'Salida registrada en 99-o' END,
           '99o', m.grupo_id_origen || '>' || m.persona_id_origen
      FROM migracion.o99_membresias m
      JOIN grupos.grupos gr ON gr.source_system = '99o' AND gr.source_id = m.grupo_id_origen
      JOIN nucleo.personas p ON p.source_system = '99o' AND p.source_id = m.persona_id_origen
     WHERE m.lote_id = p_lote
       AND NOT EXISTS (SELECT 1 FROM migracion.rechazos r WHERE r.lote_id = p_lote AND r.tabla = 'membresias'
                         AND r.id_origen = m.grupo_id_origen || '>' || m.persona_id_origen)
       AND NOT EXISTS (SELECT 1 FROM grupos.membresias x WHERE x.source_system = '99o'
                         AND x.source_id = m.grupo_id_origen || '>' || m.persona_id_origen)
    ON CONFLICT DO NOTHING
    RETURNING id)
  INSERT INTO migracion.aplicados (lote_id, tabla, destino_id) SELECT p_lote, 'membresias', id FROM nuevas;
  GET DIAGNOSTICS v_m = ROW_COUNT;
  RETURN jsonb_build_object('grupos', v_g, 'membresias', v_m);
END $$;

/* ⛔ El consentimiento conserva la FECHA DE ORIGEN (Ley 1581): uno
   recapturado hoy no cubre el tratamiento de ayer. 99-o no distingue la
   finalidad, así que entra como «convocatoria», la de menor alcance. */
CREATE OR REPLACE FUNCTION migracion.aplicar_consentimientos(p_lote bigint)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_n integer;
BEGIN
  WITH nuevos AS (
    INSERT INTO plataforma.consentimientos (persona_id, sede_id, finalidad, canal, acto, ocurrido_en, evidencia_tipo,
                                            evidencia_ref, calidad, source_system, source_id)
    SELECT p.id, p.sede_id, 'convocatoria', migracion.traducir('canal', c.canal)::plataforma.canal_contacto,
           CASE WHEN lower(c.acto) IN ('otorgado','si','sí') THEN 'otorgado' ELSE 'revocado' END::plataforma.acto_consentimiento,
           migracion.fecha(c.ocurrido_en)::timestamptz, 'importado_origen', '99-o · lote ' || p_lote || ' · fila ' || c.fila,
           'titular', '99o', p_lote || ':' || c.fila
      FROM migracion.o99_consentimientos c
      JOIN nucleo.personas p ON p.source_system = '99o' AND p.source_id = c.persona_id_origen
     WHERE c.lote_id = p_lote
       AND NOT EXISTS (SELECT 1 FROM migracion.rechazos r WHERE r.lote_id = p_lote AND r.tabla = 'consentimientos' AND r.id_origen = c.fila::text)
       AND NOT EXISTS (SELECT 1 FROM plataforma.consentimientos x JOIN nucleo.personas px ON px.id = x.persona_id AND px.eliminado_en IS NULL
                        WHERE x.source_system = '99o' AND x.source_id = p_lote || ':' || c.fila)
    RETURNING id)
  INSERT INTO migracion.aplicados (lote_id, tabla, destino_id) SELECT p_lote, 'consentimientos', id FROM nuevos;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

CREATE OR REPLACE FUNCTION migracion.cerrar_aplicacion(p_lote bigint)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  UPDATE migracion.lotes SET estado = 'aplicado', aplicado_en = now() WHERE id = p_lote;
  RETURN migracion.resumen(p_lote);
END $$;

-- ═════════════════════════════════════════════════════════════════════
-- CONCILIAR · origen contra destino, por sede
-- ═════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION migracion.conciliar(p_lote bigint)
RETURNS TABLE(sede text, entidad text, en_origen bigint, rechazados bigint, esperados bigint, en_destino bigint, diferencia bigint)
LANGUAGE sql STABLE AS $$
  WITH por_sede AS (
    SELECT s.codigo AS sede, 'personas' AS entidad,
           count(*) AS en_origen,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM migracion.rechazos r WHERE r.lote_id = p_lote
                                            AND r.tabla = 'personas' AND r.id_origen = t.id_origen)) AS rechazados,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM migracion.aplicados a JOIN nucleo.personas p ON p.id = a.destino_id
                                           WHERE a.lote_id = p_lote AND a.tabla = 'personas' AND a.id_origen = t.id_origen)) AS en_destino
      FROM migracion.v_personas_traducidas t JOIN org.sedes s ON s.id = t.sede_id
     WHERE t.lote_id = p_lote GROUP BY s.codigo
    UNION ALL
    SELECT s.codigo, 'grupos', count(*),
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM migracion.rechazos r WHERE r.lote_id = p_lote AND r.tabla = 'grupos' AND r.id_origen = g.id_origen)),
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM migracion.aplicados a WHERE a.lote_id = p_lote AND a.tabla = 'grupos' AND a.id_origen = g.id_origen))
      FROM migracion.o99_grupos g JOIN migracion.mapa_sedes ms ON ms.church_id = g.church_id JOIN org.sedes s ON s.id = ms.sede_id
     WHERE g.lote_id = p_lote GROUP BY s.codigo)
  SELECT sede, entidad, en_origen, rechazados, en_origen - rechazados, en_destino, en_destino - (en_origen - rechazados)
    FROM por_sede
  UNION ALL
  SELECT '(todas)', 'membresias',
         (SELECT count(*) FROM migracion.o99_membresias WHERE lote_id = p_lote),
         (SELECT count(*) FROM migracion.rechazos WHERE lote_id = p_lote AND tabla = 'membresias'),
         (SELECT count(*) FROM migracion.o99_membresias WHERE lote_id = p_lote)
           - (SELECT count(*) FROM migracion.rechazos WHERE lote_id = p_lote AND tabla = 'membresias'),
         (SELECT count(*) FROM migracion.aplicados WHERE lote_id = p_lote AND tabla = 'membresias'),
         (SELECT count(*) FROM migracion.aplicados WHERE lote_id = p_lote AND tabla = 'membresias')
           - ((SELECT count(*) FROM migracion.o99_membresias WHERE lote_id = p_lote)
              - (SELECT count(*) FROM migracion.rechazos WHERE lote_id = p_lote AND tabla = 'membresias'))
  UNION ALL
  SELECT '(todas)', 'consentimientos',
         (SELECT count(*) FROM migracion.o99_consentimientos WHERE lote_id = p_lote),
         (SELECT count(DISTINCT id_origen) FROM migracion.rechazos WHERE lote_id = p_lote AND tabla = 'consentimientos'),
         (SELECT count(*) FROM migracion.o99_consentimientos WHERE lote_id = p_lote)
           - (SELECT count(DISTINCT id_origen) FROM migracion.rechazos WHERE lote_id = p_lote AND tabla = 'consentimientos'),
         (SELECT count(*) FROM migracion.aplicados WHERE lote_id = p_lote AND tabla = 'consentimientos'),
         (SELECT count(*) FROM migracion.aplicados WHERE lote_id = p_lote AND tabla = 'consentimientos')
           - ((SELECT count(*) FROM migracion.o99_consentimientos WHERE lote_id = p_lote)
              - (SELECT count(DISTINCT id_origen) FROM migracion.rechazos WHERE lote_id = p_lote AND tabla = 'consentimientos'))
  ORDER BY 1, 2;
$$;

-- ═════════════════════════════════════════════════════════════════════
-- REVERTIR · borra exactamente lo de la ola, o se niega y dice por qué
-- ═════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION migracion.revertir(p_lote bigint, p_forzar boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_uso jsonb; v_hay boolean;
BEGIN
  /* ⛔ Si después de la ola la sede YA USÓ a esa gente (asistencia,
     aportes, casos, inscripciones), revertir borraría trabajo nuevo. Se
     niega y lo cuenta; forzar es una decisión escrita, no un reflejo. */
  WITH personas AS (SELECT destino_id FROM migracion.aplicados WHERE lote_id = p_lote AND tabla = 'personas')
  SELECT jsonb_build_object(
           'asistencia', (SELECT count(*) FROM asistencia.entradas e WHERE e.persona_id IN (SELECT destino_id FROM personas)),
           'aportes', (SELECT count(*) FROM aportes.aportes a WHERE a.persona_id IN (SELECT destino_id FROM personas)),
           'casos', (SELECT count(*) FROM consejeria.casos k WHERE k.consultante_id IN (SELECT destino_id FROM personas)),
           'inscripciones', (SELECT count(*) FROM formacion.inscripciones i WHERE i.persona_id IN (SELECT destino_id FROM personas)),
           'checkins', (SELECT count(*) FROM rocakids.checkins c WHERE c.menor_id IN (SELECT destino_id FROM personas)))
    INTO v_uso;
  SELECT bool_or((value)::bigint > 0) INTO v_hay FROM jsonb_each_text(v_uso);
  IF v_hay AND NOT p_forzar THEN
    RAISE EXCEPTION 'La ola % ya se usó después de migrarla (%): revertirla borraría trabajo nuevo. Si de verdad hay que hacerlo, se fuerza con una decisión escrita.', p_lote, v_uso;
  END IF;

  PERFORM set_config('app.motivo', 'Reversión de la migración desde 99-o · lote ' || p_lote, true);
  /* ⛔ La base NO deja borrar personas (regla `personas_no_delete`: solo
     borrado lógico) ni tocar un consentimiento (solo se anexa: es
     evidencia). La reversión lo respeta:
     1. las personas de la ola se dan de BAJA y su linaje pasa a
        «99o-revertido», para que la ola se pueda reintentar limpia;
     2. se borra lo que la ola creó y sí se puede borrar (vínculos de
        acudiente, membresías, grupos, lo que los disparadores anotaron);
     3. los consentimientos quedan como evidencia de lo que pasó en 99-o:
        con la persona de baja ya no autorizan ningún contacto. */
  UPDATE nucleo.personas
     SET eliminado_en = now(), source_system = '99o-revertido',
         source_payload = COALESCE(source_payload, '{}'::jsonb) || jsonb_build_object('revertido_en', now(), 'lote_revertido', p_lote)
   WHERE id IN (SELECT destino_id FROM migracion.aplicados WHERE lote_id = p_lote AND tabla = 'personas');
  DELETE FROM nucleo.acudientes WHERE id IN (SELECT destino_id FROM migracion.aplicados WHERE lote_id = p_lote AND tabla = 'acudientes');
  DELETE FROM grupos.membresias WHERE id IN (SELECT destino_id FROM migracion.aplicados WHERE lote_id = p_lote AND tabla = 'membresias');
  DELETE FROM grupos.membresias WHERE grupo_id IN (SELECT destino_id FROM migracion.aplicados WHERE lote_id = p_lote AND tabla = 'grupos');
  DELETE FROM grupos.grupos WHERE id IN (SELECT destino_id FROM migracion.aplicados WHERE lote_id = p_lote AND tabla = 'grupos');
  DELETE FROM crm.linea_tiempo WHERE persona_id IN (SELECT destino_id FROM migracion.aplicados WHERE lote_id = p_lote AND tabla = 'personas');
  DELETE FROM nucleo.membresias_sede WHERE persona_id IN (SELECT destino_id FROM migracion.aplicados WHERE lote_id = p_lote AND tabla = 'personas');
  -- El registro de lo que se aplicó se conserva para los consentimientos (siguen existiendo).
  DELETE FROM migracion.aplicados WHERE lote_id = p_lote AND tabla <> 'consentimientos';
  DELETE FROM migracion.progreso WHERE lote_id = p_lote;
  UPDATE migracion.lotes SET estado = 'revertido', revertido_en = now() WHERE id = p_lote;
  RETURN jsonb_build_object('lote', p_lote, 'revertido', true, 'uso_previo', v_uso);
END $$;

-- La migración es de operadores, no de la aplicación.
REVOKE ALL ON ALL TABLES IN SCHEMA migracion FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA migracion FROM PUBLIC;
SELECT plataforma.publicar_tabla(format('migracion.%I', c.relname)::regclass, 'cerrada',
         'Area de aterrizaje de la migracion desde 99-o: solo operadores con scripts/migrar-99o.sh.',
         'Construccion del 21 sep 2026')
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'migracion' AND c.relkind = 'r';

COMMIT;
