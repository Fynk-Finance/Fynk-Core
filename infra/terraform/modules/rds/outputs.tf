output "endpoint" {
  value       = aws_db_instance.postgres.endpoint
  description = "The connection endpoint for RDS"
}

output "address" {
  value       = aws_db_instance.postgres.address
  description = "The database hostname"
}

output "port" {
  value       = aws_db_instance.postgres.port
  description = "The database port"
}

output "database_name" {
  value       = aws_db_instance.postgres.db_name
  description = "The default database name"
}

output "master_user_secret_arn" {
  value       = aws_db_instance.postgres.master_user_secret[0].secret_arn
  description = "ARN of the Secrets Manager secret storing the master user password"
}

output "security_group_id" {
  value       = aws_security_group.rds.id
  description = "The RDS security group ID"
}

output "instance_id" {
  value       = aws_db_instance.postgres.identifier
  description = "The RDS instance identifier"
}
