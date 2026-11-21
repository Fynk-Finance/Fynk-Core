variable "aws_region" {
  type        = string
  default     = "us-east-2"
  description = "AWS region for deployment"
}

variable "environment" {
  type        = string
  default     = "staging"
  description = "Deployment environment name"
}

variable "domain_name" {
  type        = string
  default     = "fynk.club"
  description = "Base domain name for Route 53 and ACM"
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
  description = "CIDR block for the VPC"
}

variable "availability_zones" {
  type        = list(string)
  default     = ["us-east-2a", "us-east-2b"]
  description = "Availability zones for subnets"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
  description = "CIDR blocks for public subnets"
}

variable "private_subnet_cidrs" {
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
  description = "CIDR blocks for private subnets"
}

variable "enable_github_oidc" {
  type        = bool
  default     = false
  description = "Enable GitHub Actions OIDC deploy role (set to false if AWS Organization SCP blocks iam:CreateOpenIDConnectProvider)"
}

variable "enable_staging_traffic" {
  type        = bool
  default     = true
  description = "When true, runs VPC endpoints and ECS tasks. When false, turns them off to save AWS credits (sleep mode)."
}
