# S3 bucket for Terraform remote state with native S3 locking (Terraform 1.10+)
terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
}

variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region for terraform state bucket"
}

variable "state_bucket_name" {
  type        = string
  default     = "fynk-terraform-state-staging"
  description = "S3 bucket name for staging state"
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      project = "fynk"
      env     = "staging"
      module  = "M14"
    }
  }
}

resource "aws_s3_bucket" "state" {
  bucket        = var.state_bucket_name
  force_destroy = false

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "state_bucket_name" {
  value       = aws_s3_bucket.state.bucket
  description = "Name of the remote state bucket"
}

output "state_bucket_arn" {
  value       = aws_s3_bucket.state.arn
  description = "ARN of the remote state bucket"
}
