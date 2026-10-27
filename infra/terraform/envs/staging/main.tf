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

  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.private_subnet_ids
  kms_key_id                 = module.kms.data_key_arn
  allowed_security_group_ids = [module.ecs_api.security_group_id, module.ecs_keycloak.security_group_id, module.ecs_bank_simulator.security_group_id]
  environment                = var.environment
}

module "redis" {
  source = "../../modules/redis"

  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.private_subnet_ids
  kms_key_id                 = module.kms.data_key_arn
  allowed_security_group_ids = [module.ecs_api.security_group_id]
  environment                = var.environment
}

module "alb" {
  source = "../../modules/alb"

  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  domain_name       = var.domain_name
  environment       = var.environment
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "fynk-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name    = "fynk-${var.environment}-cluster"
    module  = "ecs"
    project = "fynk"
    env     = var.environment
  }
}

# ECR Repositories (tagged with commit SHA in CI)
locals {
  ecr_repos = ["fynk-api", "fynk-keycloak", "fynk-bank-simulator"]
}

resource "aws_ecr_repository" "services" {
  for_each = toset(local.ecr_repos)

  name                 = each.key
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name    = each.key
    module  = "ecr"
    project = "fynk"
    env     = var.environment
  }
}

# 1. ECS Service: fynk-api (0.5 vCPU, 1 GB)
module "ecs_api" {
  source = "../../modules/ecs-service"

  service_name          = "api"
  cluster_id            = aws_ecs_cluster.main.id
  vpc_id                = module.network.vpc_id
  subnet_ids            = [module.network.primary_private_subnet_id]
  alb_security_group_id = module.alb.security_group_id
  target_group_arn      = module.alb.target_group_api_arn
  image                 = "${aws_ecr_repository.services["fynk-api"].repository_url}:latest"
  cpu                   = 512
  memory                = 1024
  port                  = 8443
  environment           = var.environment

  environment_variables = [
    { name = "APP_ENV", value = var.environment },
    { name = "PORT", value = "8443" },
    { name = "DATABASE_URL", value = "postgres://fynk_master@${module.rds.endpoint}/fynk?sslmode=verify-full" },
    { name = "REDIS_URL", value = "rediss://${module.redis.primary_endpoint_address}:6379/0" },
    { name = "KEYCLOAK_ISSUER", value = "https://auth.${var.domain_name}/realms/fynk" }
  ]

  task_policy_statements = [
    {
      Effect = "Allow"
      Action = [
        "kms:Sign",
        "kms:GetPublicKey"
      ]
      Resource = module.kms.private_key_jwt_arn
    },
    {
      Effect = "Allow"
      Action = [
        "kms:GenerateMac",
        "kms:VerifyMac"
      ]
      Resource = module.kms.token_fingerprint_arn
    },
    {
      Effect = "Allow"
      Action = [
        "bedrock:InvokeModel"
      ]
      Resource = "arn:aws:bedrock:${var.aws_region}::foundation-model/*"
    }
  ]
}

# 2. ECS Service: keycloak (1 vCPU, 2 GB)
module "ecs_keycloak" {
  source = "../../modules/ecs-service"

  service_name          = "keycloak"
  cluster_id            = aws_ecs_cluster.main.id
  vpc_id                = module.network.vpc_id
  subnet_ids            = [module.network.primary_private_subnet_id]
  alb_security_group_id = module.alb.security_group_id
  target_group_arn      = module.alb.target_group_keycloak_arn
  image                 = "${aws_ecr_repository.services["fynk-keycloak"].repository_url}:latest"
  cpu                   = 1024
  memory                = 2048
  port                  = 8443
  environment           = var.environment

  environment_variables = [
    { name = "KC_HOSTNAME", value = "https://auth.${var.domain_name}" },
    { name = "KC_DB", value = "postgres" },
    { name = "KC_DB_URL", value = "jdbc:postgresql://${module.rds.endpoint}/keycloak?ssl=true&sslmode=verify-full" }
  ]

  secrets = [
    { name = "KEYCLOAK_ADMIN_PASSWORD", valueFrom = module.secrets.keycloak_admin_secret_arn }
  ]
}

# 3. ECS Service: bank-simulator (0.25 vCPU, 0.5 GB)
module "ecs_bank_simulator" {
  source = "../../modules/ecs-service"

  service_name          = "bank-simulator"
  cluster_id            = aws_ecs_cluster.main.id
  vpc_id                = module.network.vpc_id
  subnet_ids            = [module.network.primary_private_subnet_id]
  alb_security_group_id = module.alb.security_group_id
  target_group_arn      = module.alb.target_group_bank_simulator_arn
  image                 = "${aws_ecr_repository.services["fynk-bank-simulator"].repository_url}:latest"
  cpu                   = 256
  memory                = 512
  port                  = 8443
  environment           = var.environment

  environment_variables = [
    { name = "BANK_PUBLIC_ADDR", value = ":8443" },
    { name = "BANK_INTERNAL_ADDR", value = ":9443" }
  ]
}
