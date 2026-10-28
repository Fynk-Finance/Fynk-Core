output "role_arn" {
  value       = aws_iam_role.github_deploy.arn
  description = "ARN of the IAM role assumed by GitHub Actions workflows"
}

output "provider_arn" {
  value       = aws_iam_openid_connect_provider.github.arn
  description = "ARN of the GitHub OIDC provider"
}
