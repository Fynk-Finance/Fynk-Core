output "secret_arns" {
  value       = { for k, v in aws_secretsmanager_secret.shells : k => v.arn }
  description = "ARNs of created Secrets Manager secret shells"
}

output "keycloak_admin_secret_arn" {
  value       = aws_secretsmanager_secret.shells["keycloak_admin"].arn
  description = "Keycloak admin password secret ARN"
}

output "mtls_client_cert_secret_arn" {
  value       = aws_secretsmanager_secret.shells["mtls_client_cert"].arn
  description = "mTLS client certificate secret ARN"
}

output "mtls_client_key_secret_arn" {
  value       = aws_secretsmanager_secret.shells["mtls_client_key"].arn
  description = "mTLS client private key secret ARN"
}
