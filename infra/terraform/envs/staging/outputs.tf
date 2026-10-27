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

output "endpoint_security_group_id" {
  value       = module.endpoints.security_group_id
  description = "Security group for interface endpoints"
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

output "rds_master_user_secret_arn" {
  value       = module.rds.master_user_secret_arn
  description = "RDS master secret ARN in Secrets Manager"
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

output "redis_auth_token_secret_arn" {
  value       = module.redis.auth_token_secret_arn
  description = "Secrets Manager ARN for Redis AUTH token"
}
