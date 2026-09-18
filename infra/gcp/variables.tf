# =====================================================================
# Variables. Las que mueven dinero están arriba; las de ajuste fino,
# abajo. Los tamaños NO son variables sueltas: salen de `fase`
# (ver fases.tf), para que nadie encienda una pieza de la fase 2 en la
# maqueta sin darse cuenta.
# =====================================================================

variable "proyecto" {
  description = "ID del proyecto de GCP donde vive CasaRoca System."
  type        = string
}

variable "fase" {
  description = "Fase del plan de costos de Jhon: 0 = maqueta (35 USD/mes), 1 = pruebas (218 USD/mes), 2 = producción (526 USD/mes; 473 con compromiso de 1 año)."
  type        = number

  validation {
    condition     = contains([0, 1, 2], var.fase)
    error_message = "La fase es 0, 1 o 2. No hay más fases en el plan."
  }
}

variable "region" {
  description = "Región. us-east1 (Virginia) por decisión del plan: GCP no tiene región en Colombia y la Ley 1581 permite el tratamiento en el exterior con contrato de procesador."
  type        = string
  default     = "us-east1"
}

variable "prefijo" {
  description = "Prefijo de nombres de recursos."
  type        = string
  default     = "casaroca"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,15}$", var.prefijo))
    error_message = "Minúsculas, números y guiones; de 3 a 16 caracteres."
  }
}

# ---------------------------------------------------------------------
# Exposición a internet
# ---------------------------------------------------------------------
variable "api_publica" {
  description = <<-EOT
    ⛔ Si la API se abre a internet (allUsers como invocador).
    HOY la API toma la identidad de la cabecera X-Persona-Id: quien conozca
    un id de persona puede hacerse pasar por ella, incluido el Pastor Director
    General con N4 sobre toda la red. NO se pone en true hasta que la API
    valide un token real (Keycloak u otro) Y esté cargado recaptcha-secreto.
    Mientras tanto se prueba con `gcloud run services proxy` (ver README).
  EOT
  type        = bool
  default     = false
}

variable "dominio_api" {
  description = "Dominio de la API detrás del balanceador (p. ej. api.casaroca.io). Vacío = sin balanceador. casaroca.io está POR COMPRAR."
  type        = string
  default     = ""
}

variable "dominio_app" {
  description = "Dominio del frontend (p. ej. app.casaroca.io o 100p.casaroca.org). Solo se usa si existe la imagen del frontend."
  type        = string
  default     = ""
}

variable "cors_origenes" {
  description = "Orígenes que pueden llamar a la API desde el navegador (CORS_ORIGENES). casaroca.org (cPanel) llama a la API desde sus formularios."
  type        = list(string)
  default     = ["https://casaroca.org", "https://www.casaroca.org", "https://casaroca-system.netlify.app"]
}

variable "armor_solo_observar" {
  description = "Cloud Armor en modo vista previa: registra lo que bloquearía, sin bloquear. Recomendado la primera semana de la fase 1 para cazar falsos positivos; luego false."
  type        = bool
  default     = true
}

# ---------------------------------------------------------------------
# Imágenes. Terraform crea los servicios con una imagen de relleno y
# Cloud Build despliega la real; después Terraform ya no toca la imagen.
# ---------------------------------------------------------------------
variable "imagen_frontend" {
  description = "Imagen del frontend en Cloud Run. Vacío = no se crea. Hoy no existe: el prototipo es HTML estático en Netlify y el React del plan está por construir."
  type        = string
  default     = ""
}

variable "imagen_pastoral" {
  description = "Imagen del servicio Pastoral (fase 2 del plan). Vacío = no se crea."
  type        = string
  default     = ""
}

variable "trabajadores" {
  description = "Cloud Run Jobs de la fase 2 (correos, exportes). Mapa nombre => { imagen, argumentos }. Vacío = ninguno. Solo se crean con fase = 2."
  type = map(object({
    imagen     = string
    argumentos = optional(list(string), [])
  }))
  default = {}
}

# ---------------------------------------------------------------------
# Secretos de terceros. El contenedor del secreto se crea siempre; el
# VALOR lo carga una persona con gcloud (README). Un secreto sin versión
# no se puede montar, así que solo se montan los que se declaran aquí.
# ---------------------------------------------------------------------
variable "secretos_cargados" {
  description = "Secretos de terceros que YA tienen versión y se pueden montar en la API. Valores posibles: recaptcha-secreto, sendgrid-api-key, payu-api-key."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for s in var.secretos_cargados : contains(["recaptcha-secreto", "sendgrid-api-key", "payu-api-key"], s)])
    error_message = "Solo recaptcha-secreto, sendgrid-api-key o payu-api-key."
  }
}

variable "correo_remitente" {
  description = "Remitente de los correos transaccionales (CORREO_REMITENTE). El dominio debe estar verificado en el proveedor de correo."
  type        = string
  default     = "no-responder@casaroca.org"
}

variable "payu_merchant_id" {
  description = "PAYU_MERCHANT_ID. No es secreto (va en el formulario de pago); vacío = no se define."
  type        = string
  default     = ""
}

variable "version_claves_bd" {
  description = <<-EOT
    Versión de las contraseñas de la base (postgres y la de la API). Subirla
    en 1 genera contraseñas nuevas en el próximo apply. Después hay que
    ejecutar el migrador (fija la de la API en la base) y desplegar la API.
  EOT
  type        = number
  default     = 1
}

# ---------------------------------------------------------------------
# Gobierno del gasto y operación
# ---------------------------------------------------------------------
variable "cuenta_facturacion" {
  description = "ID de la cuenta de facturación (XXXXXX-XXXXXX-XXXXXX) para el presupuesto con alertas. Vacío = sin presupuesto. Quién paga la cuenta está POR DECIDIR."
  type        = string
  default     = ""
}

variable "moneda_facturacion" {
  description = "Moneda de la cuenta de facturación. El presupuesto debe ir en la MISMA moneda o GCP lo rechaza."
  type        = string
  default     = "USD"
}

variable "correos_alertas" {
  description = "Correos que reciben las alertas de Cloud Monitoring (fase 2) y del presupuesto."
  type        = list(string)
  default     = []
}

variable "proteger_borrado" {
  description = "Protección contra borrado de Cloud SQL y Cloud Run. En la maqueta se puede apagar para destruir y rehacer; en producción, siempre true."
  type        = bool
  default     = true
}

variable "crear_disparador_github" {
  description = "Crear el disparador de Cloud Build sobre 100p-NANO/ecosistema-cr (rama main). Requiere conectar antes la app de Cloud Build en GitHub (README, paso 5)."
  type        = bool
  default     = false
}

variable "github_propietario" {
  description = "Organización o usuario de GitHub dueño del repositorio."
  type        = string
  default     = "100p-NANO"
}

variable "github_repositorio" {
  description = "Nombre del repositorio en GitHub."
  type        = string
  default     = "ecosistema-cr"
}

variable "dias_retencion_importaciones" {
  description = "Días que un CSV importado vive en el bucket (prefijo importaciones/). Son datos personales: se guardan lo necesario y no más (Ley 1581, principio de finalidad)."
  type        = number
  default     = 30
}

variable "tasa_cop_usd" {
  description = "Tasa para convertir el presupuesto si la cuenta factura en COP. 4.050 es la del modelo financiero."
  type        = number
  default     = 4050
}
