-- Sedes de DEMOSTRACIÓN, no el listado real de la iglesia.
-- El listado real es entrega de la Dirección General (etapa 1, esquema 01).
INSERT INTO org.sedes (codigo,nombre,tipo,pais,ciudad,ola_migracion) VALUES
  ('BOG-CHICO','Bogotá Chicó','sede_madre','CO','Bogotá',1),
  ('BOG-NORTE','Bogotá Norte','filial_nacional','CO','Bogotá',2),
  ('MED','Medellín','filial_nacional','CO','Medellín',3),
  ('PTY','Panamá','filial_internacional','PA','Ciudad de Panamá',5),
  ('BCN','Barcelona','filial_internacional','ES','Barcelona',5)
ON CONFLICT DO NOTHING;
