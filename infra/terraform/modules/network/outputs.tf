output "vpc_id" {
  value       = aws_vpc.main.id
  description = "The ID of the VPC"
}

output "vpc_cidr_block" {
  value       = aws_vpc.main.cidr_block
  description = "The CIDR block of the VPC"
}

output "public_subnet_ids" {
  value       = aws_subnet.public[*].id
  description = "IDs of the public subnets"
}

output "private_subnet_ids" {
  value       = aws_subnet.private[*].id
  description = "IDs of the private subnets"
}

output "primary_private_subnet_id" {
  value       = aws_subnet.private[0].id
  description = "Primary private subnet ID for 1-AZ workloads to save cross-AZ data transfer costs"
}

output "primary_public_subnet_id" {
  value       = aws_subnet.public[0].id
  description = "Primary public subnet ID for Caddy egress instance"
}
