resource "aws_security_group" "alb" {
  name        = "fynk-${var.environment}-alb-sg"
  description = "Security group for public Application Load Balancer"
  vpc_id      = var.vpc_id

  ingress {
    description = "Allow HTTP for redirect to HTTPS"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow HTTPS from anywhere"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound to ECS target groups"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "fynk-${var.environment}-alb-sg"
    module  = "alb"
    project = "fynk"
    env     = var.environment
  }
}

resource "aws_lb" "main" {
  name               = "fynk-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = false

  tags = {
    Name    = "fynk-${var.environment}-alb"
    module  = "alb"
    project = "fynk"
    env     = var.environment
  }
}

# ACM wildcard certificate for *.domain_name and domain_name
resource "aws_acm_certificate" "wildcard" {
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  tags = {
    Name    = "fynk-${var.environment}-wildcard-cert"
    module  = "alb"
    project = "fynk"
    env     = var.environment
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Target Groups (HTTPS 8443 backend, targets are Fargate IPs)
resource "aws_lb_target_group" "api" {
  name        = "fynk-${var.environment}-tg-api"
  port        = 8443
  protocol    = "HTTPS"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/healthz"
    protocol            = "HTTPS"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name    = "fynk-${var.environment}-tg-api"
    module  = "alb"
    project = "fynk"
    env     = var.environment
  }
}

resource "aws_lb_target_group" "keycloak" {
  name        = "fynk-${var.environment}-tg-keycloak"
  port        = 8443
  protocol    = "HTTPS"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health/ready"
    protocol            = "HTTPS"
    matcher             = "200"
    interval            = 20
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name    = "fynk-${var.environment}-tg-keycloak"
    module  = "alb"
    project = "fynk"
    env     = var.environment
  }
}

resource "aws_lb_target_group" "bank_simulator" {
  name        = "fynk-${var.environment}-tg-bankdemo"
  port        = 8443
  protocol    = "HTTPS"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/healthz"
    protocol            = "HTTPS"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name    = "fynk-${var.environment}-tg-bankdemo"
    module  = "alb"
    project = "fynk"
    env     = var.environment
  }
}

# HTTP Listener port 80 -> HTTP 301 redirect to HTTPS 443 per HU-032
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS Listener port 443 -> Strict TLS 1.2+ policy ELBSecurityPolicy-TLS13-1-2-2021-06 per HU-032
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.wildcard.arn

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "application/json"
      message_body = "{\"error\":\"not_found\",\"message\":\"Route not recognized\"}"
      status_code  = "404"
    }
  }
}

# Host routing rules
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    host_header {
      values = ["api.${var.domain_name}"]
    }
  }
}

resource "aws_lb_listener_rule" "keycloak" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.keycloak.arn
  }

  condition {
    host_header {
      values = ["auth.${var.domain_name}"]
    }
  }
}

resource "aws_lb_listener_rule" "bank_simulator" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 30

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.bank_simulator.arn
  }

  condition {
    host_header {
      values = ["bancodemo.${var.domain_name}"]
    }
  }
}
