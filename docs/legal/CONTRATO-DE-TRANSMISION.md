# Contrato de transmisión de datos personales · BORRADOR (no vigente)

> Decreto 1377 de 2013, artículo 25. Entre la iglesia (Responsable) y quien opera la plataforma (Encargado). Pendiente: identificar a las partes y revisión de abogado.

**Partes.** El Responsable: Casa Sobre la Roca. El Encargado: la empresa que opera CasaRoca System por encargo de la iglesia. Subencargado: el proveedor de nube (Google Cloud), con su propio acuerdo de tratamiento de datos.

**Objeto.** El Encargado trata los datos personales de la iglesia **solo** para operar, mantener, respaldar y dar soporte a la plataforma, y únicamente según las instrucciones escritas del Responsable.

**Obligaciones del Encargado** (Ley 1581 de 2012, artículo 18):
1. Tratar los datos solo para el objeto del contrato; no usarlos para fines propios.
2. Mantener las medidas de seguridad descritas en `docs/SEGURIDAD-ASVS-L2.md`: acceso por rol y por sede, segundo factor, cifrado de secretos, bitácora de lectura, copias cifradas con restauración probada.
3. Guardar confidencialidad, también después de terminado el contrato.
4. Avisar al Responsable de cualquier incidente de seguridad sin demora injustificada, con lo que se sepa en ese momento, para que el Responsable avise a la Superintendencia y a los titulares cuando corresponda.
5. Apoyar al Responsable en la atención de consultas y reclamos dentro de los plazos legales.
6. No subcontratar sin autorización escrita del Responsable, salvo el proveedor de nube aquí nombrado.
7. Al terminar: devolver los datos en un formato legible y borrarlos de sus sistemas, dejando constancia.

**Ubicación.** Los datos se alojan en la región de Google Cloud que elija el Responsable. Si está fuera de Colombia, esta es una transmisión internacional amparada por este contrato, y se informa a los titulares en la política.

**Inteligencia artificial.** El Encargado no usa los datos para entrenar modelos ni los envía a servicios de inteligencia artificial de terceros. Cualquier uso futuro requiere la cláusula de IA firmada (ver `CLAUSULA-IA.md`).

**Auditoría.** El Responsable puede verificar el cumplimiento, con aviso razonable, revisando las bitácoras del sistema y los registros de acceso.
