# =====================================================================
# CasaRoca System · Infraestructura en Google Cloud
# Plan de referencia: «PLAN DE COSTOS GCP» del equipo 100p (Jhon Chávez).
#
# Terraform 1.11+ porque las contraseñas se generan con recursos
# EFÍMEROS y se escriben en atributos de solo escritura (`*_wo`): así
# ninguna contraseña ni la llave N4 quedan guardadas en el estado.
# =====================================================================
terraform {
  required_version = ">= 1.11.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 7.0, < 8.0"
    }
    # google-beta solo para las identidades de servicio (CMEK de Cloud
    # SQL, Secret Manager y Redis). Mismo rango de versión.
    google-beta = {
      source  = "hashicorp/google-beta"
      version = ">= 7.0, < 8.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.7.0"
    }
  }

  # ⛔ El estado va en un bucket de GCS con versionado y acceso restringido,
  #    NUNCA en el Mac ni en el repositorio. Aunque las contraseñas no
  #    viajan al estado (ver arriba), el estado sí describe toda la
  #    infraestructura. Crear el bucket una vez, a mano (README, paso 2),
  #    y descomentar:
  #
  # backend "gcs" {
  #   bucket = "PROYECTO-tfstate"
  #   prefix = "casaroca/gcp"
  # }
}
