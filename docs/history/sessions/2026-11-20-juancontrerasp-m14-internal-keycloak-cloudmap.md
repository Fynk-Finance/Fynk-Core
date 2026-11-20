---
date: 2026-11-20
developer: Juan Pablo Contreras
github: juancontrerasp
module: M14
jira: [SCRUM-46]
branch: fix/infra-internal-keycloak-cloudmap
tool: Antigravity
pr: pending
status: done
---

# M14: Route Internal API-to-Keycloak Calls via AWS Cloud Map

## Instruction

Juan Pablo Contreras requested applying the M14 fix so `fynk-api` in private subnets (without NAT) reaches Keycloak over private VPC DNS via AWS Cloud Map instead of timing out on the public ALB URL, and setting `FYNK_BACKCHANNEL_AUTH_URL=http://localhost:8080` for Keycloak self-calls.

## What was done

* **`infra/terraform/modules/ecs-service/variables.tf` & `main.tf`:**
  * Added `service_discovery_registry_arn` and `internal_ingress_security_group_ids` variables.
  * Added inline `dynamic "ingress"` rules on `aws_security_group.task` and `dynamic "service_registries"` on `aws_ecs_service.main`.
* **`infra/terraform/envs/staging/main.tf`:**
  * Added `aws_service_discovery_private_dns_namespace.internal` (`fynk-staging.local`) and `aws_service_discovery_service.keycloak` (`keycloak`).
  * Registered `module.ecs_keycloak` in Cloud Map and allowed internal ingress from `module.ecs_api.security_group_id`.
  * Updated `ecs_api` `KEYCLOAK_URL` to `http://keycloak.fynk-staging.local:8080` (keeping `KEYCLOAK_ISSUER` public) and `ecs_keycloak` `FYNK_BACKCHANNEL_AUTH_URL` to `http://localhost:8080`.

## Verification

* `terraform fmt -check -recursive infra/terraform` passed.
* `terraform validate` in `infra/terraform/envs/staging` passed.
* `node --test scripts/*.test.mjs` passed (28/28).
