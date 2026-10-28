locals {
  secret_shells = {
    "keycloak_admin"           = "fynk/${var.environment}/keycloak-admin"
    "fynk_admin_client_secret" = "fynk/${var.environment}/fynk-admin-client-secret"
    "mtls_client_cert"         = "fynk/${var.environment}/mtls-client-cert"
    "mtls_client_key"          = "fynk/${var.environment}/mtls-client-key"
    "alpaca_api_keys"          = "fynk/${var.environment}/alpaca-api-keys"
  }
}

resource "aws_secretsmanager_secret" "shells" {
  for_each = local.secret_shells

  name                    = each.value
  description             = "Fynk ${var.environment} secret shell for ${each.key} (values set via CLI/SSM)"
  kms_key_id              = var.kms_key_id
  recovery_window_in_days = 0

  tags = {
    Name    = each.value
    module  = "secrets"
    project = "fynk"
    env     = var.environment
  }
}
