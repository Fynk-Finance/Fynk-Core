output "security_group_id" {
  value       = aws_security_group.endpoints.id
  description = "The security group ID attached to interface VPC endpoints"
}

output "endpoint_ids" {
  value       = { for k, v in aws_vpc_endpoint.interfaces : k => v.id }
  description = "IDs of the created interface VPC endpoints"
}

output "endpoint_network_interface_ids" {
  value       = { for k, v in aws_vpc_endpoint.interfaces : k => v.network_interface_ids }
  description = "Network interface IDs of the VPC endpoints"
}
