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

resource "aws_iam_role_policy" "execution_secrets" {
  name = "fynk-${var.environment}-${var.service_name}-execution-secrets"
  role = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "kms:Decrypt"
        ]
        Resource = "*"
      }
    ]
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

      portMappings = [
        {
          containerPort = var.port
          hostPort      = var.port
          protocol      = "tcp"
        }
      ]

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
  desired_count   = 1
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
