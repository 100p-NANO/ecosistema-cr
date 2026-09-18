# =====================================================================
# Disparador de Cloud Build: cada push a main de 100p-NANO/ecosistema-cr
# que toque el backend construye, migra y despliega (infra/gcp/cloudbuild.yaml).
#
# ⚠️ Requisito manual previo (una vez): instalar la app «Google Cloud
#    Build» en la organización 100p-NANO de GitHub y conectar el
#    repositorio al proyecto. Eso exige autorización en GitHub y no se
#    puede hacer desde Terraform. Por eso el disparador nace apagado
#    (var.crear_disparador_github = false).
# =====================================================================
resource "google_cloudbuild_trigger" "main" {
  count       = var.crear_disparador_github ? 1 : 0
  name        = "${var.prefijo}-main"
  location    = "global"
  description = "Push a main: imágenes, migraciones y despliegue de la API."

  github {
    owner = var.github_propietario
    name  = var.github_repositorio
    push {
      branch = "^main$"
    }
  }

  filename        = "infra/gcp/cloudbuild.yaml"
  service_account = google_service_account.construccion.id

  # Solo lo que cambia la imagen o el despliegue. Un cambio en el
  # prototipo (Netlify) o en los documentos no dispara nada.
  included_files = ["backend/api/**", "backend/db/migrations/**", "backend/db/seeds/**", "backend/scripts/migrar-produccion.sh", "backend/Dockerfile.migrador", "infra/gcp/cloudbuild.yaml"]

  substitutions = {
    _REGION  = var.region
    _PREFIJO = var.prefijo
  }

  depends_on = [google_project_service.apis]
}
