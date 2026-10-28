---
date: 2026-10-27
developer: Juan Pablo Contreras
github: juancontrerasp
module: M14
jira: [SCRUM-46, SCRUM-47, SCRUM-48]
branch: infra/ecs-services-and-alb
tool: Claude Code
pr: none
status: done
---

# M14 Step 3: Application Load Balancer, Route 53, ACM, and ECS Fargate services

## Instruction

Juan Pablo Contreras requested to execute all steps of Module M14 (AWS Staging Infrastructure): "Please do the module m14 all the steps please."

## What was done

* Created branch `infra/ecs-services-and-alb` based on `infra/data-stores`.
* `infra/terraform/modules/alb/`:
  * Public ALB across 2 AZs with security group allowing inbound port 80 and 443.
  * HTTP listener (port 80) strictly redirecting with HTTP 301 to HTTPS 443 per HU-032.
  * HTTPS listener (port 443) enforcing TLS 1.2+ with policy `ELBSecurityPolicy-TLS13-1-2-2021-06`.
  * Wildcard ACM certificate (`*.fynk.club` and `fynk.club`) with DNS validation.
  * Target groups with HTTPS 8443 backend, IP target type, and `/healthz` healthchecks for `fynk-api`, `keycloak`, and `bank-simulator`.
  * Host rules routing `api.*` -> `fynk-api`, `auth.*` -> `keycloak`, and `bancodemo.*` -> `bank-simulator`.
* `infra/terraform/modules/ecs-service/`:
  * Reusable Fargate ARM64 module: task definition, service (single task in staging to save costs), CloudWatch log group (30-day retention), security groups.
  * Task execution role with least privilege permissions for Secrets Manager and KMS decryption.
  * Task role supporting customized IAM policy statements.
* `infra/terraform/envs/staging/`:
  * Created ECS Cluster `fynk-staging-cluster` with Container Insights.
  * Created ECR repositories (`fynk-api`, `fynk-keycloak`, `fynk-bank-simulator`) with scan-on-push enabled.
  * Instantiated the 3 ECS services:
    * `fynk-api` (0.5 vCPU, 1 GB): least privilege task role for Bedrock Converse invocation (`bedrock:InvokeModel`), PS256 signing with RSA_3072 key, and HMAC_256 token fingerprinting.
    * `keycloak` (1 vCPU, 2 GB): connected to PostgreSQL and Keycloak admin password secret.
    * `bank-simulator` (0.25 vCPU, 0.5 GB): public listener 8443 and internal listener 9443.

## Result

* `terraform fmt -check` passed.
* `terraform validate` passed with configuration valid.

## Decisions and problems

* Reusable `ecs-service` module standardizes ARM64 Fargate task configurations across all 3 services, keeping staging costs lean at ~50 USD/mo for compute.
* Strict least-privilege IAM policies grant `bedrock:InvokeModel` only to `fynk-api`, without wildcard admin access.

## Next step

Step 4: `infra/caddy-egress` (EC2 t4g.nano with Elastic IP, SSM agent, Caddyfile, and rotation runbook).
