variable "environment" {
  type        = string
  default     = "staging"
  description = "Deployment environment name"
}

variable "kms_key_id" {
  type        = string
  description = "KMS Key ARN or ID to encrypt secrets at rest"
}
