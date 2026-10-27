terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
  backend "s3" {
    bucket       = "fynk-terraform-state-staging"
    key          = "staging/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      project = "fynk"
      env     = var.environment
      module  = "M14"
    }
  }
}

module "network" {
  source = "../../modules/network"

  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  environment          = var.environment
}

module "endpoints" {
  source = "../../modules/endpoints"

  vpc_id      = module.network.vpc_id
  vpc_cidr    = module.network.vpc_cidr_block
  subnet_ids  = [module.network.primary_private_subnet_id]
  environment = var.environment
}

module "kms" {
  source = "../../modules/kms"

  environment = var.environment
}

module "secrets" {
  source = "../../modules/secrets"

  environment = var.environment
  kms_key_id  = module.kms.data_key_arn
}

module "rds" {
  source = "../../modules/rds"

  vpc_id      = module.network.vpc_id
  subnet_ids  = module.network.private_subnet_ids
  kms_key_id  = module.kms.data_key_arn
  environment = var.environment
}

module "redis" {
  source = "../../modules/redis"

  vpc_id      = module.network.vpc_id
  subnet_ids  = module.network.private_subnet_ids
  kms_key_id  = module.kms.data_key_arn
  environment = var.environment
}
