variable "github_repository" {
  type        = string
  default     = "Fynk-Finance/Fynk-Core"
  description = "GitHub repository (org/repo) allowed to assume the OIDC deploy role"
}

variable "environment" {
  type        = string
  default     = "staging"
  description = "Deployment environment name"
}

variable "deploy_refs" {
  type        = list(string)
  default     = ["refs/heads/develop", "refs/tags/v*"]
  description = "Git refs whose workflow runs may assume the deploy role. Keep in step with the triggers of .github/workflows/deploy-staging.yml"
}
