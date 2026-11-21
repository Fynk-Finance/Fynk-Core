output "service_name" {
  value       = aws_ecs_service.main.name
  description = "The ECS service name"
}

output "service_id" {
  value       = aws_ecs_service.main.id
  description = "The ECS service ID"
}

output "security_group_id" {
  value       = aws_security_group.task.id
  description = "Security group ID of the ECS task"
}

output "task_role_arn" {
  value       = aws_iam_role.task.arn
  description = "IAM task role ARN"
}

output "execution_role_arn" {
  value       = aws_iam_role.execution.arn
  description = "IAM execution role ARN"
}

output "log_group_name" {
  value       = aws_cloudwatch_log_group.service.name
  description = "CloudWatch log group name"
}
