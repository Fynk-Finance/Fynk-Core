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
