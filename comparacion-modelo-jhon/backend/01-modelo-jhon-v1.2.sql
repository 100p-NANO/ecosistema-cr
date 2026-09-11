-- =====================================================================
-- EL MODELO DE JHON, TAL CUAL, EJECUTABLE
--
-- Transcripción literal del documento «ESTRUCTURA DE DATOS - USUARIOS
-- (PERSONAS)», versión 1.2, del Drive «Sistema 100p Casa Roca Global».
--
-- ⛔ ESTO NO ES UNA PROPUESTA NUESTRA. Es su documento convertido en SQL
-- para poder ejecutarlo y comparar, no para reemplazar nada. No se
-- cambió ni un nombre de campo, ni un tipo, ni una obligatoriedad,
-- incluidos los puntos que hemos observado. Si algo aquí se ve raro,
-- es porque así está escrito en el documento.
-- =====================================================================

DROP SCHEMA IF EXISTS jhon CASCADE;
CREATE SCHEMA jhon;

-- ---------------------------------------------------------------------
-- TABLA 1 · personas  (25.000 filas esperadas)
-- ---------------------------------------------------------------------
CREATE TABLE jhon.personas (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento                 varchar(20),
  tipo_documento            varchar(2),
  nombre_completo           varchar(100) NOT NULL,
  nombre_corto              varchar(50),
  genero                    char(1)      NOT NULL,
  fecha_nacimiento          date,
  edad                      int,                     -- doc v1.2: "calculada automaticamente"
  estado_civil              varchar(20)  NOT NULL,
  nacionalidad              varchar(50),
  pais_residencia           varchar(50)  NOT NULL,
  ciudad_residencia         varchar(50)  NOT NULL,
  zona                      varchar(50),
  -- ⚠️ NO HAY sede_id. Es literal: el documento no lo tiene.

  email_principal           varchar(100) NOT NULL UNIQUE,   -- obligatorio Y unico
  email_secundario          varchar(100),
  telefono_celular          varchar(20),
  telefono_fijo             varchar(20),
  telefono_emergencia       varchar(20),
  permite_whatsapp          boolean      NOT NULL,

  direccion_calle           varchar(150),
  direccion_apartamento     varchar(50),
  direccion_ciudad          varchar(50)  NOT NULL,
  direccion_codigo_postal   varchar(10),

  es_cristiano              varchar(10)  NOT NULL,
  fecha_conversion          date,
  iglesia_anterior          varchar(100),
  ha_sido_bautizado         boolean      NOT NULL,
  fecha_bautismo            date,
  es_ministro               boolean      NOT NULL,
  nivel_compromiso          varchar(20)  NOT NULL,

  foto_url                  varchar(300),
  conyuge_id                uuid REFERENCES jhon.personas(id),
  acudiente_id              uuid REFERENCES jhon.personas(id),

  fecha_registro            timestamp    NOT NULL DEFAULT now(),
  usuario_registro_id       uuid         NOT NULL,
  ultima_actualizacion      timestamp    NOT NULL DEFAULT now(),
  usuario_actualizacion_id  uuid         NOT NULL,
  estado_persona            varchar(20)  NOT NULL,
  activo                    boolean      NOT NULL,

  puede_recibir_email       boolean      NOT NULL,
  puede_recibir_sms         boolean      NOT NULL,
  puede_recibir_llamadas    boolean      NOT NULL,
  en_directorio_publico     boolean      NOT NULL,
  datos_sensibles           boolean      NOT NULL,   -- booleano, sin N0-N4
  consentimiento_gdpr       boolean      NOT NULL,
  fecha_consentimiento_gdpr timestamp,               -- añadido en la v1.2

  CONSTRAINT genero_valido        CHECK (genero IN ('M','F','O')),
  CONSTRAINT tipo_doc_valido      CHECK (tipo_documento IS NULL OR tipo_documento IN ('CC','PP','TI','CE','PE')),
  CONSTRAINT estado_civil_valido  CHECK (estado_civil IN ('Soltero','Casado','Divorciado','Viudo','Union_Libre','Separado')),
  CONSTRAINT cristiano_valido     CHECK (es_cristiano IN ('SI','NO','EN_PROCESO')),
  CONSTRAINT compromiso_valido    CHECK (nivel_compromiso IN ('VISITANTE','MIEMBRO','LIDER')),
  CONSTRAINT estado_valido        CHECK (estado_persona IN ('ACTIVO','INACTIVO','TRASLADADO','FALLECIDO')),
  CONSTRAINT documento_unico      UNIQUE (documento)
);

-- ---------------------------------------------------------------------
-- TABLA 2 · vinculos_personas  (40.000 filas esperadas)
-- ---------------------------------------------------------------------
CREATE TABLE jhon.vinculos_personas (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id_1              uuid NOT NULL REFERENCES jhon.personas(id),
  persona_id_2              uuid NOT NULL REFERENCES jhon.personas(id),
  tipo_relacion             varchar(30) NOT NULL,
  es_bidireccional          boolean     NOT NULL,
  fecha_relacion            date,
  estado_relacion           varchar(20) NOT NULL,
  observaciones             text,
  fecha_registro            timestamp   NOT NULL DEFAULT now(),
  usuario_registro_id       uuid        NOT NULL,
  ultima_actualizacion      timestamp   NOT NULL DEFAULT now(),
  usuario_actualizacion_id  uuid        NOT NULL,

  CONSTRAINT no_consigo_mismo CHECK (persona_id_1 <> persona_id_2),
  CONSTRAINT estado_rel_valido CHECK (estado_relacion IN ('ACTIVO','INACTIVO')),
  CONSTRAINT tipo_rel_valido CHECK (tipo_relacion IN (
    'CONYUGE','HIJO','HIJA','PADRE','MADRE','HERMANO','HERMANA','TIO','TIA',
    'PRIMO','PRIMA','ABUELO','ABUELA','PADRASTRO','MADRASTRA','OTRO_FAMILIAR',
    'ACUDIENTE','TUTOR','APODERADO','EMERGENCIA','REFERENCIA_FAMILIAR')),
  -- regla 10 del documento: coherencia de bidireccionalidad
  CONSTRAINT bidireccional_coherente CHECK (
    (tipo_relacion IN ('CONYUGE','HERMANO','HERMANA','PRIMO','PRIMA') AND es_bidireccional)
    OR (tipo_relacion IN ('HIJO','HIJA','ACUDIENTE','TUTOR','APODERADO','PADRE','MADRE') AND NOT es_bidireccional)
    OR tipo_relacion IN ('TIO','TIA','ABUELO','ABUELA','PADRASTRO','MADRASTRA','OTRO_FAMILIAR','EMERGENCIA','REFERENCIA_FAMILIAR'))
);

-- ---------------------------------------------------------------------
-- TABLA 3 · auditoria_personas  (50.000 filas/mes)
-- ---------------------------------------------------------------------
CREATE TABLE jhon.auditoria_personas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id       uuid        NOT NULL REFERENCES jhon.personas(id),
  tipo_cambio      varchar(30) NOT NULL,
  campo_modificado varchar(50) NOT NULL,
  valor_anterior   text,
  valor_nuevo      text,
  usuario_id       uuid        NOT NULL,
  fecha_cambio     timestamp   NOT NULL DEFAULT now(),
  motivo           text,
  ip_usuario       varchar(20),
  CONSTRAINT tipo_cambio_valido CHECK (tipo_cambio IN ('CREACION','ACTUALIZACION','ELIMINACION'))
);

-- ---------------------------------------------------------------------
-- TABLA 4 · permisos_personas  (persona x usuario)
-- ---------------------------------------------------------------------
CREATE TABLE jhon.permisos_personas (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id               uuid        NOT NULL REFERENCES jhon.personas(id),
  usuario_id               uuid        NOT NULL,
  nivel_acceso             varchar(20) NOT NULL,
  puede_ver_datos_sensibles boolean    NOT NULL,
  puede_editar             boolean     NOT NULL,
  fecha_asignacion         timestamp   NOT NULL DEFAULT now(),
  usuario_asignacion_id    uuid        NOT NULL,
  CONSTRAINT nivel_valido CHECK (nivel_acceso IN
    ('PROPIETARIO','COORDINADOR','TESORERIA','PASTORAL','DIRECTOR','SISTEMA'))
);

-- ---------------------------------------------------------------------
-- TABLA 5 · minores   (el nombre es literal del documento)
-- ---------------------------------------------------------------------
CREATE TABLE jhon.minores (
  persona_id             uuid PRIMARY KEY REFERENCES jhon.personas(id),
  acudiente_principal_id uuid      NOT NULL REFERENCES jhon.personas(id),
  autorizacion_foto      boolean   NOT NULL,
  autorizacion_eventos   boolean   NOT NULL,
  autorizacion_retiros   boolean   NOT NULL,
  necesidades_especiales text,
  medicamentos           text,
  fecha_nacimiento       date      NOT NULL,   -- duplicada: ya esta en personas
  es_mayor_18            boolean   NOT NULL,   -- derivado, pero almacenado
  notas_acudiente        text,
  fecha_registro         timestamp NOT NULL DEFAULT now(),
  usuario_registro_id    uuid      NOT NULL
);

-- Regla 11 del documento: prohibido DELETE sobre personas (borrado logico)
CREATE OR REPLACE FUNCTION jhon.tg_prohibir_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Prohibido DELETE sobre personas. Use estado_persona = INACTIVO.';
END $$;
CREATE TRIGGER prohibir_delete BEFORE DELETE ON jhon.personas
  FOR EACH ROW EXECUTE FUNCTION jhon.tg_prohibir_delete();

COMMENT ON SCHEMA jhon IS
  'Modelo v1.2 del equipo 100p, transcrito literalmente para comparacion. No es produccion.';
