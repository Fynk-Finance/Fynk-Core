output "vpc_id" {
  value       = module.network.vpc_id
  description = "The VPC ID"
}

output "public_subnet_ids" {
  value       = module.network.public_subnet_ids
  description = "Public subnet IDs"
}

output "private_subnet_ids" {
  value       = module.network.private_subnet_ids
  description = "Private subnet IDs"
}

output "primary_private_subnet_id" {
  value       = module.network.primary_private_subnet_id
  description = "Primary private subnet ID"
}

output "primary_public_subnet_id" {
  value       = module.network.primary_public_subnet_id
  description = "Primary public subnet ID"
}

# ALB Outputs
output "alb_dns_name" {
  value       = module.alb.alb_dns_name
  description = "ALB DNS name"
}

output "alb_security_group_id" {
  value       = module.alb.security_group_id
  description = "ALB security group ID"
}

# KMS Outputs
output "kms_data_key_arn" {
  value       = module.kms.data_key_arn
  description = "Symmetric data key ARN"
}

output "kms_private_key_jwt_arn" {
  value       = module.kms.private_key_jwt_arn
  description = "Asymmetric RSA_3072 key ARN for private_key_jwt"
}

output "kms_token_fingerprint_arn" {
  value       = module.kms.token_fingerprint_arn
  description = "HMAC_256 key ARN for token fingerprints"
}

# RDS Outputs
output "rds_endpoint" {
  value       = module.rds.endpoint
  description = "RDS connection endpoint"
}

output "rds_security_group_id" {
  value       = module.rds.security_group_id
  description = "RDS security group ID"
}

# Redis Outputs
output "redis_primary_endpoint" {
  value       = module.redis.primary_endpoint_address
  description = "Redis primary endpoint"
}

output "redis_security_group_id" {
  value       = module.redis.security_group_id
  description = "Redis security group ID"
}

# ECS Cluster & Services
output "ecs_cluster_id" {
  value       = aws_ecs_cluster.main.id
  description = "ECS cluster ID"
}

output "ecs_api_service_name" {
  value       = module.ecs_api.service_name
  description = "fynk-api ECS service name"
}

output "ecs_keycloak_service_name" {
  value       = module.ecs_keycloak.service_name
  description = "keycloak ECS service name"
}

output "ecs_bank_simulator_service_name" {
  value       = module.ecs_bank_simulator.service_name
  description = "bank-simulator ECS service name"
}

# Caddy Egress Outputs
output "caddy_egress_public_ip" {
  value       = module.caddy_egress.public_ip
  description = "Static Elastic IP for Caddy egress proxy"
}

output "caddy_egress_security_group_id" {
  value       = module.caddy_egress.security_group_id
  description = "Security group for Caddy egress proxy"
}

# Monitoring Outputs
output "alerts_topic_arn" {
  value       = module.monitoring.alerts_topic_arn
  description = "SNS topic ARN for engineering alerts"
}

output "dashboard_name" {
  value       = module.monitoring.dashboard_name
  description = "CloudWatch dashboard name"
}
