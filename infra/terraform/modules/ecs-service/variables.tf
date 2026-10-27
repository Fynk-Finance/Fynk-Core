variable "service_name" {
  type        = string
  description = "Name of the ECS service and container"
}

variable "cluster_id" {
  type        = string
  description = "ID of the ECS cluster"
}

variable "vpc_id" {
  type        = string
  description = "The VPC ID"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Subnet IDs for task placement (primary private subnet)"
}

variable "alb_security_group_id" {
  type        = string
  description = "Security group ID of the ALB allowing inbound 8443"
}

variable "target_group_arn" {
  type        = string
  description = "ARN of the ALB target group"
}

variable "image" {
  type        = string
  description = "ECR image URI with tag"
}

variable "cpu" {
  type        = number
  default     = 256
  description = "Fargate CPU units (256 = 0.25 vCPU, 512 = 0.5 vCPU, 1024 = 1 vCPU)"
}

variable "memory" {
  type        = number
  default     = 512
  description = "Fargate Memory in MB"
}

variable "port" {
  type        = number
  default     = 8443
  description = "Container port"
}

variable "environment" {
  type        = string
  default     = "staging"
  description = "Deployment environment name"
}

variable "environment_variables" {
  type = list(object({
    name  = string
    value = string
  }))
  default     = []
  description = "Plaintext environment variables for container"
}

variable "secrets" {
  type = list(object({
    name      = string
    valueFrom = string
  }))
  default     = []
  description = "Secrets from AWS Secrets Manager injected as env vars"
}

variable "task_policy_statements" {
  type        = list(any)
  default     = []
  description = "Additional IAM policy statements for the ECS task role"
}
