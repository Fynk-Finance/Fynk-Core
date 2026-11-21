data "aws_region" "current" {}

resource "aws_security_group" "endpoints" {
  name        = "fynk-${var.environment}-vpce-sg"
  description = "Security group for VPC interface endpoints"
  vpc_id      = var.vpc_id

  ingress {
    description = "Allow HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  ingress {
    description = "Allow SMTP TLS (587) for SES from VPC"
    from_port   = 587
    to_port     = 587
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  ingress {
    description = "Allow SMTPS (465) for SES from VPC"
    from_port   = 465
    to_port     = 465
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "Allow all outbound from endpoint ENIs"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "fynk-${var.environment}-vpce-sg"
    module  = "endpoints"
    project = "fynk"
    env     = var.environment
  }
}

locals {
  services = {
    "ecr_api"         = "ecr.api"
    "ecr_dkr"         = "ecr.dkr"
    "logs"            = "logs"
    "secretsmanager"  = "secretsmanager"
    "kms"             = "kms"
    "bedrock_runtime" = "bedrock-runtime"
    "email_smtp"      = "email-smtp"
  }
}

resource "aws_vpc_endpoint" "interfaces" {
  for_each = local.services

  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.${each.value}"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = var.subnet_ids
  security_group_ids  = [aws_security_group.endpoints.id]

  tags = {
    Name    = "fynk-${var.environment}-vpce-${each.key}"
    module  = "endpoints"
    project = "fynk"
    env     = var.environment
  }
}
