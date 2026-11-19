---
date: 2026-11-19
developer: Juan Pablo Contreras
github: juancontrerasp
module: M14
jira: [SCRUM-46, SCRUM-47, SCRUM-48]
branch: infra/switch-region-us-east-2
tool: Antigravity
pr: 420
status: done
---

# M14: Staging Deployment in us-east-2 (Domain, Free Tier, Runtime Env, Sleep Toggle)

## Instruction

Juan Pablo Contreras deployed the staging stack to AWS `us-east-2`, configured the custom domain `habenly.site` with AWS ACM, pushed ARM64 container images to ECR, verified live endpoints with `scripts/smoke.sh`, added a cost-saving sleep toggle (`enable_staging_traffic`), merged `origin/develop`, and opened PR #420.

## What was done

* **Staging domain & Free Tier compatibility:**
  * Created `infra/terraform/envs/staging/terraform.tfvars` with `domain_name = "habenly.site"` and `enable_staging_traffic = false`.
  * Updated `infra/terraform/modules/caddy-egress/variables.tf` to default to `t4g.micro` (Free Tier eligible).
  * Updated `infra/terraform/modules/rds/main.tf` and `variables.tf` to PostgreSQL `16.13` (retired `16.4` in `us-east-2`).
  * Added `enable_github_oidc` toggle in `infra/terraform/envs/staging/` to bypass AWS Organization SCP restrictions on `iam:CreateOpenIDConnectProvider`.
* **ALB, ECS & Secrets wiring:**
  * Updated `infra/terraform/modules/alb/main.tf` target groups to HTTP on port `8080` (TLS 1.3 terminated at the ALB) and Keycloak health matcher `200-404`.
  * Added runtime env vars and Secrets Manager mappings in `infra/terraform/envs/staging/main.tf` (`KEYCLOAK_URL`, `KEYCLOAK_AUDIENCE`, `KEYCLOAK_REALM`, `PGPASSWORD`, `FYNK_ADMIN_CLIENT_SECRET`, `KC_HTTP_ENABLED`, `KC_PROXY_HEADERS`, `KC_DB_*`, `BANK_DEV_MODE`).
  * Updated `infra/terraform/modules/ecs-service/main.tf` to strip `:json-key:version-stage:version-id` suffixes from `secretsmanager:GetSecretValue` IAM policy resources while preserving least-privilege scoping from `develop`.
* **Dockerfiles & Keycloak realms:**
  * Enabled native Go cross-compilation (`--platform=$BUILDPLATFORM`, `GOOS`, `GOARCH`) in `services/api/Dockerfile` and `services/bank-simulator/Dockerfile`.
  * Parameterized `services/keycloak/realms/banco-demo-realm.json` and `fynk-realm.json` with `FYNK_AUTH_URL` and `FYNK_BACKCHANNEL_AUTH_URL` for HTTPS in staging while keeping local defaults, and updated `bancodemo_realm_test.go` / `realm_test.go`.
* **Cost-saving sleep toggle:**
  * Added `enable_staging_traffic` in `infra/terraform/envs/staging/` and `desired_count` in `infra/terraform/modules/ecs-service/` to toggle VPC interface endpoints and ECS tasks between `1` and `0`.

## Verification

* `terraform fmt -check -recursive infra/terraform` passed.
* `terraform validate` in `infra/terraform/envs/staging` and `infra/terraform/bootstrap` passed.
* `terraform test` in `infra/terraform/modules/ecs-service` passed (2/2).
* `go test ./internal/identity/keycloak/...` in `services/api` passed.
* `node --test scripts/*.test.mjs` passed (28/28).
* `node scripts/ci-changes.mjs session-log origin/develop HEAD` passed.
* Live staging smoke tests (`./scripts/smoke.sh habenly.site`) passed.
