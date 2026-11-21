output "alerts_topic_arn" {
  value       = aws_sns_topic.alerts.arn
  description = "SNS topic ARN for engineering alerts"
}

output "dashboard_name" {
  value       = aws_cloudwatch_dashboard.staging.dashboard_name
  description = "CloudWatch dashboard name"
}
