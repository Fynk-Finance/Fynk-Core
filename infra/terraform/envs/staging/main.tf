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
    region       = "us-east-2"
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
  count  = var.enable_staging_traffic ? 1 : 0
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
  port                  = 8080
  desired_count         = var.enable_staging_traffic ? 1 : 0
  environment           = var.environment

  environment_variables = [
    { name = "APP_ENV", value = var.environment },
    { name = "PORT", value = "8080" },
    { name = "DATABASE_URL", value = "postgres://fynk_master@${module.rds.endpoint}/fynk?sslmode=require" },
    { name = "REDIS_URL", value = "rediss://${module.redis.primary_endpoint_address}:6379/0" },
    { name = "KEYCLOAK_ISSUER", value = "https://auth.${var.domain_name}/realms/fynk" },
    { name = "KEYCLOAK_URL", value = "http://keycloak.${aws_service_discovery_private_dns_namespace.internal.name}:8080" },
    { name = "KEYCLOAK_AUDIENCE", value = "fynk-api" },
    { name = "KEYCLOAK_REALM", value = "fynk" },
    { name = "EGRESS_URL", value = "https://${module.caddy_egress.private_ip}:8443" },
    { name = "RECOMMENDATIONS_PROVIDER", value = "gemini" },
    { name = "RECOMMENDATIONS_VIA_EGRESS", value = "true" }
  ]

  secrets = [
    { name = "PGPASSWORD", valueFrom = "${module.rds.master_user_secret_arn}:password::" },
    { name = "FYNK_ADMIN_CLIENT_SECRET", valueFrom = module.secrets.secret_arns["fynk_admin_client_secret"] },
    { name = "GEMINI_API_KEY", valueFrom = module.secrets.secret_arns["gemini_api_key"] },
    { name = "EGRESS_CA_PEM", valueFrom = module.secrets.secret_arns["egress_ca_pem"] },
    { name = "BANK_SIGNER_KMS_KEY_ID", valueFrom = module.secrets.secret_arns["bank_signer_kms_key_id"] },
    { name = "BANK_FINGERPRINT_KMS_KEY_ID", valueFrom = module.secrets.secret_arns["bank_fingerprint_kms_key_id"] },
    { name = "BANK_REDIRECT_URI", valueFrom = module.secrets.secret_arns["bank_redirect_uri"] },
    { name = "BANCO_DEMO_CLIENT_ID", valueFrom = module.secrets.secret_arns["banco_demo_client_id"] },
    { name = "BANCO_DEMO_ISSUER", valueFrom = module.secrets.secret_arns["banco_demo_issuer"] },
    { name = "BANCO_DEMO_AUTHORIZE_URL", valueFrom = module.secrets.secret_arns["banco_demo_authorize_url"] }
  ]
  secrets_kms_key_arn = module.kms.data_key_arn

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

resource "aws_service_discovery_private_dns_namespace" "internal" {
  name        = "fynk-${var.environment}.local"
  description = "Private DNS for calls between staging tasks"
  vpc         = module.network.vpc_id
}

resource "aws_service_discovery_service" "keycloak" {
  name = "keycloak"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.internal.id
    routing_policy = "MULTIVALUE"
    dns_records {
      type = "A"
      ttl  = 10
    }
  }

  health_check_custom_config {
    failure_threshold = 1
  }
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
  port                  = 8080
  desired_count         = var.enable_staging_traffic ? 1 : 0
  environment           = var.environment

  service_discovery_registry_arn      = aws_service_discovery_service.keycloak.arn
  internal_ingress_security_group_ids = [module.ecs_api.security_group_id]

  environment_variables = [
    { name = "KC_HOSTNAME", value = "https://auth.${var.domain_name}" },
    { name = "FYNK_AUTH_URL", value = "https://auth.${var.domain_name}" },
    { name = "FYNK_BACKCHANNEL_AUTH_URL", value = "http://localhost:8080" },
    { name = "KC_HTTP_ENABLED", value = "true" },
    { name = "KC_PROXY_HEADERS", value = "xforwarded" },
    { name = "KC_DB", value = "postgres" },
    { name = "KC_DB_URL", value = "jdbc:postgresql://${module.rds.endpoint}/fynk?ssl=true&sslmode=require" },
    { name = "KC_DB_USERNAME", value = "fynk_master" },
    { name = "KC_BOOTSTRAP_ADMIN_USERNAME", value = "admin" },
    { name = "FYNK_DEMO_USER_PASSWORD", value = "Demo-staging-1" },
    { name = "BANCO_DEMO_USER_PASSWORD", value = "Banco-staging-1" },
    { name = "BANCO_DEMO_BROKER_SECRET", value = "banco-demo-broker-staging" },
    { name = "BANK_PORTAL_CLIENT_SECRET", value = "bank-portal-staging" },
    { name = "FYNK_SMTP_HOST", value = "email-smtp.${var.aws_region}.amazonaws.com" },
    { name = "FYNK_SMTP_PORT", value = "587" },
    { name = "FYNK_SMTP_FROM", value = "no-reply@${var.domain_name}" },
    { name = "FYNK_SMTP_AUTH", value = "true" },
    { name = "FYNK_SMTP_STARTTLS", value = "true" }
  ]

  secrets = [
    { name = "KEYCLOAK_ADMIN_PASSWORD", valueFrom = module.secrets.keycloak_admin_secret_arn },
    { name = "KC_BOOTSTRAP_ADMIN_PASSWORD", valueFrom = module.secrets.keycloak_admin_secret_arn },
    { name = "KC_DB_PASSWORD", valueFrom = "${module.rds.master_user_secret_arn}:password::" },
    { name = "FYNK_ADMIN_CLIENT_SECRET", valueFrom = module.secrets.secret_arns["fynk_admin_client_secret"] },
    { name = "FYNK_SMTP_USER", valueFrom = module.secrets.secret_arns["ses_smtp_user"] },
    { name = "FYNK_SMTP_PASSWORD", valueFrom = module.secrets.secret_arns["ses_smtp_password"] }
  ]
  secrets_kms_key_arn = module.kms.data_key_arn
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
  port                  = 8080
  desired_count         = var.enable_staging_traffic ? 1 : 0
  environment           = var.environment

  environment_variables = [
    { name = "BANK_PUBLIC_ADDR", value = ":8080" },
    { name = "BANK_DEV_MODE", value = "1" }
  ]
}

# Caddy Egress Proxy on EC2 (Public subnet, Elastic IP, SSM only)
module "caddy_egress" {
  source = "../../modules/caddy-egress"

  vpc_id                = module.network.vpc_id
  subnet_id             = module.network.primary_public_subnet_id
  api_security_group_id = module.ecs_api.security_group_id
  mtls_cert_secret_arn  = module.secrets.mtls_client_cert_secret_arn
  mtls_key_secret_arn   = module.secrets.mtls_client_key_secret_arn
  egress_ca_secret_arn  = module.secrets.secret_arns["egress_ca_pem"]
  kms_key_id            = module.kms.data_key_arn
  caddyfile_content     = file("${path.module}/../../../../services/caddy/Caddyfile")
  environment           = var.environment
}

# Monitoring & Alarms (CloudWatch Alarms, Dashboard, SNS Alerts)
module "monitoring" {
  source = "../../modules/monitoring"

  environment                            = var.environment
  alb_arn_suffix                         = module.alb.alb_arn_suffix
  target_group_api_arn_suffix            = module.alb.target_group_api_arn_suffix
  target_group_keycloak_arn_suffix       = module.alb.target_group_keycloak_arn_suffix
  target_group_bank_simulator_arn_suffix = module.alb.target_group_bank_simulator_arn_suffix
  rds_instance_id                        = module.rds.instance_id
  caddy_instance_id                      = module.caddy_egress.instance_id
  api_log_group_name                     = module.ecs_api.log_group_name
}

# GitHub Actions OIDC Deploy Role (No static AWS keys per HU-034)
module "github_oidc" {
  count  = var.enable_github_oidc ? 1 : 0
  source = "../../modules/github-oidc"

  environment = var.environment
}
