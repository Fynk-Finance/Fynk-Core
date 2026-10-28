variable "vpc_id" {
  type        = string
  description = "The VPC ID"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Subnet IDs for the RDS DB subnet group (private subnets)"
}

variable "allowed_security_group_ids" {
  type        = list(string)
  default     = []
  description = "List of security group IDs permitted to connect to RDS (ECS tasks)"
}

variable "kms_key_id" {
  type        = string
  description = "KMS Key ARN or ID for RDS storage encryption and master secret"
}

variable "environment" {
  type        = string
  default     = "staging"
  description = "Deployment environment name"
}

variable "instance_class" {
  type        = string
  default     = "db.t4g.micro"
  description = "RDS instance class"
}

variable "allocated_storage" {
  type        = number
  default     = 20
  description = "Allocated storage in GB (gp3)"
}
