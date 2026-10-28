resource "aws_elasticache_subnet_group" "redis" {
  name        = "fynk-${var.environment}-redis-subnet-group"
  subnet_ids  = var.subnet_ids
  description = "Subnet group for Redis cluster in private subnets"

  tags = {
    Name    = "fynk-${var.environment}-redis-subnet-group"
    module  = "redis"
    project = "fynk"
    env     = var.environment
  }
}

resource "aws_security_group" "redis" {
  name        = "fynk-${var.environment}-redis-sg"
  description = "Security group for ElastiCache Redis cluster"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = length(var.allowed_security_group_ids) > 0 ? [1] : []
    content {
      description     = "Redis from authorized ECS security groups"
      from_port       = 6379
      to_port         = 6379
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
    Name    = "fynk-${var.environment}-redis-sg"
    module  = "redis"
    project = "fynk"
    env     = var.environment
  }
}

# Generate secure AUTH token for Redis (min 16 chars, no spaces/quotes)
resource "random_password" "redis_auth" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "redis_auth" {
  name                    = "fynk/${var.environment}/redis-auth"
  description             = "ElastiCache Redis AUTH token"
  kms_key_id              = var.kms_key_id
  recovery_window_in_days = 0

  tags = {
    Name    = "fynk-${var.environment}-secret-redis-auth"
    module  = "redis"
    project = "fynk"
    env     = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  secret_id     = aws_secretsmanager_secret.redis_auth.id
  secret_string = random_password.redis_auth.result
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "fynk-${var.environment}-redis"
  description          = "Fynk ${var.environment} Redis 7 cluster"
  node_type            = var.node_type
  port                 = 6379
  parameter_group_name = "default.redis7"
  num_cache_clusters   = 1

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  # In-transit and at-rest encryption per HU-032
  transit_encryption_enabled = true
  at_rest_encryption_enabled = true
  kms_key_id                 = var.kms_key_id
  auth_token                 = random_password.redis_auth.result

  auto_minor_version_upgrade = true
  apply_immediately          = true

  tags = {
    Name    = "fynk-${var.environment}-redis"
    module  = "redis"
    project = "fynk"
    env     = var.environment
  }
}
