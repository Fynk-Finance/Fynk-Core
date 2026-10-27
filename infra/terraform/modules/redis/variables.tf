variable "vpc_id" {
  type        = string
  description = "The VPC ID"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Subnet IDs for the Redis subnet group (private subnets)"
}

variable "allowed_security_group_ids" {
  type        = list(string)
  default     = []
  description = "List of security group IDs permitted to connect to Redis (ECS tasks)"
}

variable "kms_key_id" {
  type        = string
  description = "KMS Key ARN or ID for Redis encryption at rest"
}

variable "environment" {
  type        = string
  default     = "staging"
  description = "Deployment environment name"
}

variable "node_type" {
  type        = string
  default     = "cache.t4g.micro"
  description = "ElastiCache node instance type"
}
