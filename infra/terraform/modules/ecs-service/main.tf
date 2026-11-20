data "aws_region" "current" {}

resource "aws_cloudwatch_log_group" "service" {
  name              = "/ecs/fynk-${var.environment}-${var.service_name}"
  retention_in_days = 30

  tags = {
    Name    = "/ecs/fynk-${var.environment}-${var.service_name}"
    module  = "ecs-service"
    project = "fynk"
    env     = var.environment
  }
}

resource "aws_security_group" "task" {
  name        = "fynk-${var.environment}-${var.service_name}-sg"
  description = "Security group for ECS task ${var.service_name}"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow HTTPS from ALB"
    from_port       = var.port
    to_port         = var.port
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
  }

  dynamic "ingress" {
    for_each = var.internal_ingress_security_group_ids
    content {
      description     = "Allow direct calls from another task"
      from_port       = var.port
      to_port         = var.port
      protocol        = "tcp"
      security_groups = [ingress.value]
    }
  }

  dynamic "ingress" {
    for_each = { for ep in var.extra_ports : tostring(ep.port) => ep if length(ep.security_group_ids) > 0 }
    content {
      description     = "Extra port ${ingress.value.port} from allowed security groups"
      from_port       = ingress.value.port
      to_port         = ingress.value.port
      protocol        = "tcp"
      security_groups = ingress.value.security_group_ids
    }
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "fynk-${var.environment}-${var.service_name}-sg"
    module  = "ecs-service"
    project = "fynk"
    env     = var.environment
  }
}

# Task Execution Role (used by ECS agent to pull images, read secrets, write logs)
resource "aws_iam_role" "execution" {
  name = "fynk-${var.environment}-${var.service_name}-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })

  tags = {
    Name    = "fynk-${var.environment}-${var.service_name}-execution-role"
    module  = "ecs-service"
    project = "fynk"
    env     = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "execution_standard" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# The execution role reads only the secrets of this service, and decrypts only with their key.
resource "aws_iam_role_policy" "execution_secrets" {
  count = length(var.secrets) > 0 ? 1 : 0
  name  = "fynk-${var.environment}-${var.service_name}-execution-secrets"
  role  = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [{
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = distinct([for s in var.secrets : length(split(":", s.valueFrom)) >= 7 ? join(":", slice(split(":", s.valueFrom), 0, 7)) : s.valueFrom])
      }],
      var.secrets_kms_key_arn == null ? [] : [{
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = [var.secrets_kms_key_arn]
      }]
    )
  })
}

# Task Role (used by the application inside the container)
resource "aws_iam_role" "task" {
  name = "fynk-${var.environment}-${var.service_name}-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })

  tags = {
    Name    = "fynk-${var.environment}-${var.service_name}-task-role"
    module  = "ecs-service"
    project = "fynk"
    env     = var.environment
  }
}

resource "aws_iam_role_policy" "task_custom" {
  count = length(var.task_policy_statements) > 0 ? 1 : 0
  name  = "fynk-${var.environment}-${var.service_name}-task-policy"
  role  = aws_iam_role.task.id

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = var.task_policy_statements
  })
}

resource "aws_ecs_task_definition" "main" {
  family                   = "fynk-${var.environment}-${var.service_name}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = tostring(var.cpu)
  memory                   = tostring(var.memory)
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name      = var.service_name
      image     = var.image
      essential = true

      portMappings = concat(
        [
          {
            containerPort = var.port
            hostPort      = var.port
            protocol      = "tcp"
          }
        ],
        [
          for ep in var.extra_ports : {
            containerPort = ep.port
            hostPort      = ep.port
            protocol      = "tcp"
          }
        ]
      )

      environment = var.environment_variables
      secrets     = var.secrets

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.service.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "fargate"
        }
      }
    }
  ])

  tags = {
    Name    = "fynk-${var.environment}-${var.service_name}"
    module  = "ecs-service"
    project = "fynk"
    env     = var.environment
  }
}

resource "aws_ecs_service" "main" {
  name            = "fynk-${var.environment}-${var.service_name}"
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.main.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.task.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = var.service_name
    container_port   = var.port
  }

  dynamic "service_registries" {
    for_each = var.service_discovery_registry_arn == null ? [] : [1]
    content {
      registry_arn = var.service_discovery_registry_arn
    }
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  tags = {
    Name    = "fynk-${var.environment}-${var.service_name}"
    module  = "ecs-service"
    project = "fynk"
    env     = var.environment
  }
}
