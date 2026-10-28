data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  root_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
}

# 1. Symmetric key for data encryption at rest (RDS, Secrets Manager, S3)
resource "aws_kms_key" "data" {
  description             = "Fynk ${var.environment} symmetric key for data at rest"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name    = "fynk-${var.environment}-kms-data"
    module  = "kms"
    project = "fynk"
    env     = var.environment
  }
}

resource "aws_kms_alias" "data" {
  name          = "alias/fynk-${var.environment}-data"
  target_key_id = aws_kms_key.data.key_id
}

# 2. Asymmetric RSA_3072 key for Open Finance private_key_jwt assertions (PS256)
resource "aws_kms_key" "private_key_jwt" {
  description              = "Fynk ${var.environment} asymmetric RSA 3072 key for private_key_jwt (PS256)"
  deletion_window_in_days  = 30
  customer_master_key_spec = "RSA_3072"
  key_usage                = "SIGN_VERIFY"

  tags = {
    Name    = "fynk-${var.environment}-kms-private-key-jwt"
    module  = "kms"
    project = "fynk"
    env     = var.environment
  }
}

resource "aws_kms_alias" "private_key_jwt" {
  name          = "alias/fynk-${var.environment}-private-key-jwt"
  target_key_id = aws_kms_key.private_key_jwt.key_id
}

# 3. HMAC_256 key for pseudonymous token fingerprints (HU-032 / Circular Externa 004)
resource "aws_kms_key" "token_fingerprint" {
  description              = "Fynk ${var.environment} HMAC 256 key for token fingerprints"
  deletion_window_in_days  = 30
  customer_master_key_spec = "HMAC_256"
  key_usage                = "GENERATE_VERIFY_MAC"

  tags = {
    Name    = "fynk-${var.environment}-kms-token-fingerprint"
    module  = "kms"
    project = "fynk"
    env     = var.environment
  }
}

resource "aws_kms_alias" "token_fingerprint" {
  name          = "alias/fynk-${var.environment}-token-fingerprint"
  target_key_id = aws_kms_key.token_fingerprint.key_id
}
