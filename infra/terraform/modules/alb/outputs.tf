output "alb_arn" {
  value       = aws_lb.main.arn
  description = "The ARN of the Application Load Balancer"
}

output "alb_dns_name" {
  value       = aws_lb.main.dns_name
  description = "The DNS name of the ALB"
}

output "alb_zone_id" {
  value       = aws_lb.main.zone_id
  description = "The canonical hosted zone ID of the ALB"
}

output "security_group_id" {
  value       = aws_security_group.alb.id
  description = "The ALB security group ID"
}

output "target_group_api_arn" {
  value       = aws_lb_target_group.api.arn
  description = "Target group ARN for fynk-api"
}

output "target_group_keycloak_arn" {
  value       = aws_lb_target_group.keycloak.arn
  description = "Target group ARN for keycloak"
}

output "target_group_bank_simulator_arn" {
  value       = aws_lb_target_group.bank_simulator.arn
  description = "Target group ARN for bank-simulator"
}
output "alb_arn_suffix" {
  value       = aws_lb.main.arn_suffix
  description = "ALB ARN suffix for CloudWatch alarms"
}

output "target_group_api_arn_suffix" {
  value       = aws_lb_target_group.api.arn_suffix
  description = "Target group API ARN suffix for CloudWatch alarms"
}

output "target_group_keycloak_arn_suffix" {
  value       = aws_lb_target_group.keycloak.arn_suffix
  description = "Target group Keycloak ARN suffix for CloudWatch alarms"
}

output "target_group_bank_simulator_arn_suffix" {
  value       = aws_lb_target_group.bank_simulator.arn_suffix
  description = "Target group Bank Simulator ARN suffix for CloudWatch alarms"
}
