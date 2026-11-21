variable "vpc_id" {
  type        = string
  description = "The VPC ID"
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public subnet IDs (minimum 2 AZs for ALB)"
}

variable "domain_name" {
  type        = string
  default     = "fynk.club"
  description = "Base domain name for ACM certificate and Route 53 records"
}

variable "environment" {
  type        = string
  default     = "staging"
  description = "Deployment environment name"
}
