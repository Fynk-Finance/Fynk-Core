---
date: 2026-11-20
developer: Juan Pablo Contreras
github: juancontrerasp
module: M14
jira: []
branch: fix/infra-banco-demo-mtls-oidc
pr: "#436"
status: done
---

# 2026-11-20 — Staging Infra: Wire Banco Demo mTLS, Cloud Map, and Portal OIDC (M14)

## Context
In staging, `bank-simulator` ran with `BANK_DEV_MODE=1` (internal `:9443` mTLS listener disabled), had no Cloud Map DNS entry (`bank-simulator.fynk-staging.local`), and lacked `BANK_OIDC_*` portal config, causing `/v1/bank/simulated-entities` and `/v1/bank/authorizations` to return `503 provider_unavailable` and `https://bancodemo.habenly.site/oauth/authorize` to return `503`.

## Changes
- `infra/terraform/modules/ecs-service/{variables,main}.tf`: added optional `extra_ports` input to map additional container ports (e.g. `:9443`) with SG ingress rules.
- `infra/terraform/modules/caddy-egress/{variables,main}.tf`: added optional `banco_demo_ca_secret_arn` input, IAM `secretsmanager:GetSecretValue` permission, and `user_data` download of `/etc/caddy/banco-demo-ca.crt`.
- `infra/terraform/envs/staging/main.tf`:
  - Added `aws_service_discovery_service.bank_simulator` (`bank-simulator.fynk-staging.local`).
  - Configured `ecs_bank_simulator` with port `9443` from `caddy_egress` SG, `BANK_TLS_CERT_PEM`, `BANK_TLS_KEY_PEM`, `BANK_CLIENT_CA_PEM`, `BANK_PUBLIC_URL`, and `BANK_OIDC_*` (with `BANK_OIDC_CLIENT_SECRET` via Secrets Manager).
  - Allowed `ecs_bank_simulator` SG to reach `ecs_keycloak` on `8080` and moved `BANK_PORTAL_CLIENT_SECRET` to Secrets Manager.
- `services/caddy/Caddyfile`: pointed `/banco-demo/*` at `https://bank-simulator.fynk-staging.local:9443`.
- `services/keycloak/realms/banco-demo-realm.json`: added `https://bancodemo.habenly.site/*` redirect URI and `https://bancodemo.habenly.site` web origin to `bank-portal`.

## Verification
- `terraform fmt -check -recursive infra/terraform`
- `terraform -chdir=infra/terraform/envs/staging validate`
- `node --test scripts/*.test.mjs`
