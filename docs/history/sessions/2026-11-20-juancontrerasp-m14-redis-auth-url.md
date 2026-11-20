---
date: 2026-11-20
developer: Juan Pablo Contreras
github: juancontrerasp
module: M14
jira: [SCRUM-46, SCRUM-48]
branch: fix/infra-redis-auth-url
tool: Antigravity
pr: pending
status: done
---

# M14: Inject Authenticated REDIS_URL from Secrets Manager

## Instruction

Juan Pablo Contreras reported `POST /v1/bank/authorizations` returning `500 Internal Server Error` in staging with `bank: nonce: NOAUTH Authentication required.` because `REDIS_URL` lacked the ElastiCache `auth_token`.

## What was done

* **`infra/terraform/modules/redis/main.tf` & `outputs.tf`:** Added `aws_secretsmanager_secret.redis_url` (`fynk/${var.environment}/redis-url`) storing `rediss://:${urlencode(random_password.redis_auth.result)}@${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379/0` and exported `redis_url_secret_arn`.
* **`infra/terraform/envs/staging/main.tf`:** Moved `REDIS_URL` from `ecs_api` plaintext `environment_variables` into `secrets` (`valueFrom = module.redis.redis_url_secret_arn`).

## Verification

* `terraform fmt -check -recursive infra/terraform` passed.
* `terraform validate` in `infra/terraform/envs/staging` passed.
* `node --test scripts/*.test.mjs` passed (28/28).
