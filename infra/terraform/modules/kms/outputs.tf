output "data_key_arn" {
  value       = aws_kms_key.data.arn
  description = "ARN of the symmetric data key"
}

output "data_key_id" {
  value       = aws_kms_key.data.key_id
  description = "ID of the symmetric data key"
}

output "private_key_jwt_arn" {
  value       = aws_kms_key.private_key_jwt.arn
  description = "ARN of the asymmetric RSA_3072 private_key_jwt key"
}

output "private_key_jwt_id" {
  value       = aws_kms_key.private_key_jwt.key_id
  description = "ID of the asymmetric RSA_3072 private_key_jwt key"
}

output "token_fingerprint_arn" {
  value       = aws_kms_key.token_fingerprint.arn
  description = "ARN of the HMAC_256 token fingerprint key"
}

output "token_fingerprint_id" {
  value       = aws_kms_key.token_fingerprint.key_id
  description = "ID of the HMAC_256 token fingerprint key"
}
