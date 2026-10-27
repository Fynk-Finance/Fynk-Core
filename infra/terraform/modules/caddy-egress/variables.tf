variable "vpc_id" {
  type        = string
  description = "The VPC ID"
}

variable "subnet_id" {
  type        = string
  description = "Public subnet ID for Caddy egress instance"
}

variable "api_security_group_id" {
  type        = string
  description = "Security group ID of fynk-api permitted to reach Caddy egress"
}

variable "mtls_cert_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for mTLS client certificate"
}

variable "mtls_key_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for mTLS client private key"
}

variable "environment" {
  type        = string
  default     = "staging"
  description = "Deployment environment name"
}

variable "instance_type" {
  type        = string
  default     = "t4g.nano"
  description = "EC2 instance type (ARM64 Graviton)"
}
