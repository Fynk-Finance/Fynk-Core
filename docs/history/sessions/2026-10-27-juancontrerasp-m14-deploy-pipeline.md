---
date: 2026-10-27
developer: Juan Pablo Contreras
github: juancontrerasp
module: M14
jira: [SCRUM-46, SCRUM-47, SCRUM-48]
branch: infra/deploy-pipeline
tool: Claude Code
pr: none
status: done
---

# M14 Step 6: GitHub Actions OIDC deploy pipeline, terraform plan workflow, and smoke tests

## Instruction

Juan Pablo Contreras requested to execute all steps of Module M14 (AWS Staging Infrastructure): "Please do the module m14 all the steps please."

## What was done

* Created branch `infra/deploy-pipeline` based on `infra/monitoring-and-alerts`.
* `infra/terraform/modules/github-oidc/`:
  * Configured AWS IAM OpenID Connect Provider for GitHub Actions (`token.actions.githubusercontent.com`).
  * Created least-privilege deployment role `fynk-staging-github-deploy-role` allowing GitHub Actions to assume role via OIDC web identity tokens, eliminating static long-lived AWS secret access keys per HU-034.
  * Attached policies scoped to ECR image pushing and ECS service rolling update triggers.
* `.github/workflows/deploy-staging.yml`:
  * Configured pipeline on push to `develop` and version tags (`v*`):
    * Authenticates via GitHub OIDC.
    * Sets up QEMU and Docker Buildx to cross-compile ARM64 container images (`fynk-api`, `fynk-keycloak`, `fynk-bank-simulator`).
    * Pushes tagged images to ECR.
    * Performs ECS rolling updates and waits for steady state (`aws ecs wait services-stable`).
    * Runs post-deploy smoke tests against staging endpoints.
* `.github/workflows/terraform-plan.yml`:
  * Pull request validation pipeline running `terraform fmt -check` and `terraform validate` on infrastructure modifications.
* `scripts/smoke.sh` & `Makefile`:
  * Added automated smoke verification checking API liveness (`/healthz`), Keycloak OIDC discovery (`/.well-known/openid-configuration`), Banco Demo simulator, and HTTP-to-HTTPS 301 redirection.
  * Added `make smoke` and `make tls-check` commands to `Makefile`.

## Result

* `terraform fmt -check` passed.
* `terraform validate` passed with configuration valid.

## Decisions and problems

* Replaced traditional IAM user access keys with GitHub Actions OIDC federation, enforcing zero static credentials in repository secrets.
* Cross-compiled images for `linux/arm64` within GitHub Actions via QEMU to match AWS Graviton target architecture.

## Next step

Step 7: `docs/egress-cost-finding` (ADR 0005 document detailing interface VPC endpoints vs NAT Gateway cost analysis).
