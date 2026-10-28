---
date: 2026-10-27
developer: Juan Pablo Contreras
github: juancontrerasp
module: M14
jira: [SCRUM-46, SCRUM-47, SCRUM-48]
branch: infra/data-stores
tool: Claude Code
pr: none
status: done
---

# M14 Step 2: Managed data stores, KMS keys, and Secrets shells

## Instruction

Juan Pablo Contreras requested to execute all steps of Module M14 (AWS Staging Infrastructure): "Please do the module m14 all the steps please."

## What was done

* Created branch `infra/data-stores` based on `infra/terraform-state-and-network`.
* `infra/terraform/modules/kms/`:
  * Symmetric key `fynk-staging-data` with automatic key rotation for data at rest.
  * Asymmetric RSA_3072 key `fynk-staging-private-key-jwt` (`SIGN_VERIFY`) for Open Finance FAPI 2.0 / PS256 assertions towards banks.
  * HMAC_256 key `fynk-staging-token-fingerprint` (`GENERATE_VERIFY_MAC`) for Circular Externa 004 token fingerprinting.
* `infra/terraform/modules/rds/`:
  * RDS PostgreSQL 16 (`db.t4g.micro`, 20 GB gp3, single AZ).
  * Parameter group enforcing TLS connections (`rds.force_ssl = 1`) per HU-032.
  * Managed master password auto-rotation with AWS Secrets Manager.
  * Security group restricting inbound traffic to port 5432 from ECS services.
* `infra/terraform/modules/redis/`:
  * ElastiCache Redis 7 (`cache.t4g.micro`) with `transit_encryption_enabled = true` and `at_rest_encryption_enabled = true`.
  * Secure AUTH token generated and stored in Secrets Manager (`fynk/staging/redis-auth`).
  * Security group restricting port 6379 to ECS services.
* `infra/terraform/modules/secrets/`:
  * Empty secret shells created per HU-034 for manual/CLI populating without committing secrets:
    * `keycloak-admin`, `fynk-admin-client-secret`, `mtls-client-cert`, `mtls-client-key`, `alpaca-api-keys`.
* `infra/terraform/envs/staging/`:
  * Assembled all modules, pinned random provider `~> 3.6`.
  * Validated with `terraform fmt -check` and `terraform validate`.

## Result

* `terraform fmt -check` passed.
* `terraform validate` passed with configuration valid.

## Decisions and problems

* Enforced `rds.force_ssl = 1` and Redis in-transit TLS to strictly satisfy HU-032 (Cifrado en tránsito).
* Used AWS Secrets Manager managed rotation for the RDS master credentials, eliminating static database passwords.

## Next step

Step 3: `infra/ecs-services-and-alb` (ECR repositories, ECS Fargate cluster, 3 services, Application Load Balancer with host rules, ACM, Route 53).
