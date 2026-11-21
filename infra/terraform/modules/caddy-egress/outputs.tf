output "instance_id" {
  value       = aws_instance.caddy.id
  description = "EC2 instance ID of Caddy egress"
}

output "public_ip" {
  value       = aws_eip.caddy.public_ip
  description = "Stable Elastic IP for outbound banking requests allowlisting"
}

output "private_ip" {
  value       = aws_instance.caddy.private_ip
  description = "Private IP of Caddy egress for internal VPC routing"
}

output "security_group_id" {
  value       = aws_security_group.caddy.id
  description = "Security group ID of Caddy egress"
}
