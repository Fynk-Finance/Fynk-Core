# Run with: terraform init -backend=false && terraform test (no AWS account needed).
mock_provider "aws" {
  # The provider checks that these are ARNs, so the mock cannot use random text.
  mock_resource "aws_iam_role" {
    defaults = {
      arn = "arn:aws:iam::111111111111:role/mock"
    }
  }
  mock_resource "aws_ecs_task_definition" {
    defaults = {
      arn = "arn:aws:ecs:us-east-2:111111111111:task-definition/mock:1"
    }
  }
}

variables {
  service_name          = "api"
  cluster_id            = "cluster"
  vpc_id                = "vpc-1"
  subnet_ids            = ["subnet-1"]
  alb_security_group_id = "sg-1"
  target_group_arn      = "arn:aws:elasticloadbalancing:us-east-2:111111111111:targetgroup/api/1"
  image                 = "repo/fynk-api:latest"
}

run "reads_only_its_own_secrets" {
  command = apply

  variables {
    secrets = [
      { name = "A", valueFrom = "arn:aws:secretsmanager:us-east-2:111111111111:secret:fynk/staging/a" },
      { name = "B", valueFrom = "arn:aws:secretsmanager:us-east-2:111111111111:secret:fynk/staging/b" },
    ]
    secrets_kms_key_arn = "arn:aws:kms:us-east-2:111111111111:key/data"
  }

  assert {
    condition = jsondecode(aws_iam_role_policy.execution_secrets[0].policy).Statement == [
      {
        Action = ["secretsmanager:GetSecretValue"]
        Effect = "Allow"
        Resource = [
          "arn:aws:secretsmanager:us-east-2:111111111111:secret:fynk/staging/a",
          "arn:aws:secretsmanager:us-east-2:111111111111:secret:fynk/staging/b",
        ]
      },
      {
        Action   = ["kms:Decrypt"]
        Effect   = "Allow"
        Resource = ["arn:aws:kms:us-east-2:111111111111:key/data"]
      },
    ]
    error_message = "The execution role must read only the secrets of the service and decrypt only with their key"
  }
}

run "a_service_without_secrets_gets_no_secrets_policy" {
  command = apply

  assert {
    condition     = length(aws_iam_role_policy.execution_secrets) == 0
    error_message = "A service with no secrets must not get a policy on Secrets Manager or KMS"
  }
}
