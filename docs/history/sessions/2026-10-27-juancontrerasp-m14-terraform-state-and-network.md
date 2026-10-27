---
date: 2026-10-27
developer: Juan Pablo Contreras
github: juancontrerasp
module: M14
jira: [SCRUM-46, SCRUM-47, SCRUM-48]
branch: infra/terraform-state-and-network
tool: Claude Code
pr: none
status: done
---

# M14 Step 1: Remote state bootstrap, VPC network, and interface VPC endpoints

## Instruction

Juan Pablo Contreras requested to execute all steps of Module M14 (AWS Staging Infrastructure): "Please do the module m14 all the steps please."

## What was done

* Created branch `infra/terraform-state-and-network` from `develop`.
* `infra/terraform/bootstrap/main.tf`:
  * Configured remote state S3 bucket `fynk-terraform-state-staging` with versioning, server-side AES256 encryption, and full public access blocking.
  * Native S3 state locking (`use_lockfile = true`) enabled, eliminating the need for a separate DynamoDB lock table.
* `infra/terraform/modules/network/`:
  * `main.tf`, `variables.tf`, `outputs.tf`:
  * VPC (`10.0.0.0/16`) with DNS hostnames and DNS support enabled.
  * 2 public subnets across 2 AZs (`us-east-1a`, `us-east-1b`) for ALB ingress and Caddy egress.
  * 2 private subnets (`10.0.10.0/24`, `10.0.20.0/24`) with isolated route tables (no NAT gateway).
  * S3 Gateway VPC endpoint attached to both public and private route tables (free).
* `infra/terraform/modules/endpoints/`:
  * `main.tf`, `variables.tf`, `outputs.tf`:
  * Security group allowing inbound HTTPS (443) and SMTP (465/587) from VPC CIDR.
  * 7 interface VPC endpoints deployed in 1 AZ (`ecr.api`, `ecr.dkr`, `logs`, `secretsmanager`, `kms`, `bedrock-runtime`, `email-smtp`) with `private_dns_enabled = true`.
* `infra/terraform/envs/staging/`:
  * Composition assembling `modules/network` and `modules/endpoints`.
  * Configured AWS provider `~> 5.80` with default tags (`project = "fynk"`, `env = "staging"`, `module = "M14"`).
  * Validated syntax with `terraform fmt -check` and `terraform validate`.

## Result

* `terraform fmt -check` passed.
* `terraform validate` passed in both `bootstrap` and `envs/staging`.

## Decisions and problems

* Deployed VPC interface endpoints into the primary private subnet (1 AZ) to avoid multiplying hourly endpoint costs across multiple AZs while saving budget as designed in `docs/modules/M14-infrastructure.md`.

## Next step

Step 2: `infra/data-stores` (RDS PostgreSQL, ElastiCache Redis, KMS keys, Secrets shells).
