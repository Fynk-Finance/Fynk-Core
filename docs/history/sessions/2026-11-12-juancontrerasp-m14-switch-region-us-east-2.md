---
date: 2026-11-12
developer: Juan Pablo Contreras
github: juancontrerasp
module: M14
jira: [SCRUM-46, SCRUM-47, SCRUM-48]
branch: infra/switch-region-us-east-2
tool: Antigravity
pr: 382
status: done
---

# M14: Switch AWS Deployment Region to us-east-2 (Ohio)

## Instruction

Juan Pablo Contreras requested switching the AWS region configuration across the project: "I believe that I need to change all of it to us-east-2" and "if we're gonna do that, let's make sure that we're up to date with develop".

## What was done

* Synchronized local `develop` with `origin/develop` at commit `aa5cc32` and created branch `infra/switch-region-us-east-2`.
* Audited all occurrences and references of `us-east-1` in Terraform definitions, GitHub Actions CI workflows, and backend configuration defaults.
* Updated Terraform configurations to target `us-east-2` (Ohio):
  * `infra/terraform/bootstrap/main.tf`: Updated `aws_region` default to `us-east-2`.
  * `infra/terraform/envs/staging/main.tf`: Updated S3 remote state backend `region` to `us-east-2`.
  * `infra/terraform/envs/staging/variables.tf`: Changed `aws_region` default to `us-east-2`, and `availability_zones` default to `["us-east-2a", "us-east-2b"]`.
  * `infra/terraform/envs/staging/terraform.tfvars.example`: Updated `aws_region` to `us-east-2`.
  * `infra/terraform/modules/network/variables.tf`: Changed `availability_zones` default to `["us-east-2a", "us-east-2b"]`.
* Updated GitHub Actions workflows:
  * `.github/workflows/deploy-staging.yml`: Set `AWS_REGION: us-east-2`.
  * `.github/workflows/terraform-plan.yml`: Set `AWS_REGION: us-east-2`.
* Updated backend API recommendations module defaults:
  * `services/api/internal/recommendations/module.go`: Updated fallback `AWS_REGION` default to `us-east-2`.
  * `services/api/internal/recommendations/http_test.go`: Updated defaults assertion test for `us-east-2`.

## Verification

* Formatted and validated Terraform configurations:
  * `terraform fmt -check -recursive infra/terraform` passed with 0 issues.
  * `terraform validate` in `infra/terraform/bootstrap` succeeded.
  * `terraform validate` in `infra/terraform/envs/staging` succeeded.
* Ran Go quality checks:
  * `make lint-go` passed with 0 issues.
  * `make test-go` passed all test suites including recommendations.
* Ran script checks and formatting validation:
  * `make test-scripts` passed (27/27 tests).
  * `make format-check` verified all files formatted.
