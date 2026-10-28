output "primary_endpoint_address" {
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  description = "Primary endpoint address for Redis"
}

output "port" {
  value       = aws_elasticache_replication_group.redis.port
  description = "Port number for Redis"
}

output "auth_token_secret_arn" {
  value       = aws_secretsmanager_secret.redis_auth.arn
  description = "Secrets Manager ARN storing the Redis AUTH token"
}

output "security_group_id" {
  value       = aws_security_group.redis.id
  description = "The Redis security group ID"
}
