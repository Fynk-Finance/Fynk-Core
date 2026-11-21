variable "vpc_id" {
  type        = string
  description = "The VPC ID where interface endpoints are deployed"
}

variable "vpc_cidr" {
  type        = string
  description = "The VPC CIDR block allowed to communicate with interface endpoints"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Subnet IDs where the interface VPC endpoint ENIs will be placed (primary private subnet in 1 AZ)"
}

variable "environment" {
  type        = string
  default     = "staging"
  description = "Deployment environment name"
}
