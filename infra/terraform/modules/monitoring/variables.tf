variable "environment" {
  type        = string
  default     = "staging"
  description = "Deployment environment name"
}

variable "alb_arn_suffix" {
  type        = string
  description = "ARN suffix of the ALB for CloudWatch metrics"
}

variable "target_group_api_arn_suffix" {
  type        = string
  description = "ARN suffix of the fynk-api target group"
}

variable "target_group_keycloak_arn_suffix" {
  type        = string
  description = "ARN suffix of the keycloak target group"
}

variable "target_group_bank_simulator_arn_suffix" {
  type        = string
  description = "ARN suffix of the bank-simulator target group"
}

variable "rds_instance_id" {
  type        = string
  description = "RDS DB instance identifier"
}

variable "caddy_instance_id" {
  type        = string
  description = "Caddy EC2 instance ID"
}

variable "api_log_group_name" {
  type        = string
  description = "CloudWatch log group name for fynk-api to attach PII metric filter"
}

variable "alert_emails" {
  type        = list(string)
  default     = ["dev-team@fynk.club"]
  description = "Email addresses subscribed to fynk-alerts SNS topic"
}
