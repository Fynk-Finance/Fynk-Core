variable "environment" {
  type        = string
  default     = "staging"
  description = "Deployment environment name"
}

variable "task_role_arns" {
  type        = list(string)
  default     = []
  description = "List of ECS task role ARNs permitted to use KMS keys"
}
