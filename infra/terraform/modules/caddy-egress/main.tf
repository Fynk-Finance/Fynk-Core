data "aws_region" "current" {}

data "aws_ami" "al2023_arm64" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-arm64"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

resource "aws_security_group" "caddy" {
  name        = "fynk-${var.environment}-caddy-sg"
  description = "Security group for Caddy egress proxy on public subnet"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow HTTPS 8443 exclusively from fynk-api tasks"
    from_port       = 8443
    to_port         = 8443
    protocol        = "tcp"
    security_groups = [var.api_security_group_id]
  }

  egress {
    description = "Allow outbound traffic to banks, Alpaca, and internal VPC simulator"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "fynk-${var.environment}-caddy-sg"
    module  = "caddy-egress"
    project = "fynk"
    env     = var.environment
  }
}

# IAM Role with SSM agent access (no SSH key on the instance!)
resource "aws_iam_role" "caddy" {
  name = "fynk-${var.environment}-caddy-egress-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })

  tags = {
    Name    = "fynk-${var.environment}-caddy-egress-role"
    module  = "caddy-egress"
    project = "fynk"
    env     = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.caddy.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Policy allowing Caddy to read mTLS certificates from Secrets Manager
resource "aws_iam_role_policy" "secrets" {
  name = "fynk-${var.environment}-caddy-secrets"
  role = aws_iam_role.caddy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          var.mtls_cert_secret_arn,
          var.mtls_key_secret_arn
        ]
      }
    ]
  })
}

resource "aws_iam_instance_profile" "caddy" {
  name = "fynk-${var.environment}-caddy-instance-profile"
  role = aws_iam_role.caddy.name
}

resource "aws_instance" "caddy" {
  ami                  = data.aws_ami.al2023_arm64.id
  instance_type        = var.instance_type
  subnet_id            = var.subnet_id
  vpc_security_group_ids = [aws_security_group.caddy.id]
  iam_instance_profile = aws_iam_instance_profile.caddy.name

  root_block_device {
    volume_size           = 15
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  user_data = <<-EOF
              #!/bin/bash
              set -euo pipefail
              dnf update -y
              dnf install -y docker awscli
              systemctl enable --now docker

              mkdir -p /etc/caddy /run/secrets
              # Fetch client mTLS certificate and private key from Secrets Manager
              aws secretsmanager get-secret-value --secret-id "${var.mtls_cert_secret_arn}" --query SecretString --output text > /run/secrets/fynk-client.crt || true
              aws secretsmanager get-secret-value --secret-id "${var.mtls_key_secret_arn}" --query SecretString --output text > /run/secrets/fynk-client.key || true
              chmod 600 /run/secrets/* || true

              # Run Caddy egress container
              docker run -d --name caddy-egress \
                --restart always \
                -p 8443:8443 \
                -v /etc/caddy:/etc/caddy:ro \
                -v /run/secrets:/run/secrets:ro \
                caddy:2.11.7-alpine
              EOF

  tags = {
    Name    = "fynk-${var.environment}-caddy-egress"
    module  = "caddy-egress"
    project = "fynk"
    env     = var.environment
  }
}

# Elastic IP for stable outbound IP allowlisted by banks
resource "aws_eip" "caddy" {
  instance = aws_instance.caddy.id
  domain   = "vpc"

  tags = {
    Name    = "fynk-${var.environment}-caddy-eip"
    module  = "caddy-egress"
    project = "fynk"
    env     = var.environment
  }
}
