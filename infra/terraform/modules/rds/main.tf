resource "aws_db_subnet_group" "rds" {
  name        = "fynk-${var.environment}-rds-subnet-group"
  subnet_ids  = var.subnet_ids
  description = "Subnet group for RDS PostgreSQL instances in private subnets"

  tags = {
    Name    = "fynk-${var.environment}-rds-subnet-group"
    module  = "rds"
    project = "fynk"
    env     = var.environment
  }
}

resource "aws_security_group" "rds" {
  name        = "fynk-${var.environment}-rds-sg"
  description = "Security group for RDS PostgreSQL instance"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = length(var.allowed_security_group_ids) > 0 ? [1] : []
    content {
      description     = "PostgreSQL from authorized ECS security groups"
      from_port       = 5432
      to_port         = 5432
      protocol        = "tcp"
      security_groups = var.allowed_security_group_ids
    }
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "fynk-${var.environment}-rds-sg"
    module  = "rds"
    project = "fynk"
    env     = var.environment
  }
}

# Parameter group enforcing TLS connection (rds.force_ssl=1) per HU-032
resource "aws_db_parameter_group" "pg16" {
  name        = "fynk-${var.environment}-pg16"
  family      = "postgres16"
  description = "PostgreSQL 16 parameter group with rds.force_ssl=1"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = {
    Name    = "fynk-${var.environment}-pg16-params"
    module  = "rds"
    project = "fynk"
    env     = var.environment
  }
}

resource "aws_db_instance" "postgres" {
  identifier                  = "fynk-${var.environment}-db"
  engine                      = "postgres"
  engine_version              = "16.4"
  instance_class              = var.instance_class
  allocated_storage           = var.allocated_storage
  max_allocated_storage       = 50
  storage_type                = "gp3"
  storage_encrypted           = true
  kms_key_id                  = var.kms_key_id
  db_name                     = "fynk"
  username                    = "fynk_master"
  manage_master_user_password = true
  master_user_secret_kms_key_id = var.kms_key_id

  db_subnet_group_name   = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.pg16.name

  publicly_accessible = false
  multi_az            = false
  skip_final_snapshot = true
  deletion_protection = false

  auto_minor_version_upgrade = true
  backup_retention_period    = 7

  tags = {
    Name    = "fynk-${var.environment}-db"
    module  = "rds"
    project = "fynk"
    env     = var.environment
  }
}
