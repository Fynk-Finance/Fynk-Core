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
