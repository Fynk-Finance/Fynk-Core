---
date: 2026-11-19
developer: Juan Pablo Contreras
github: juancontrerasp
module: M14
jira: [SCRUM-46, SCRUM-48]
branch: feat/infra-gemini-egress-and-secret
tool: Antigravity
pr: pending
status: done
---

# M14: Add Gemini Egress Route and GEMINI_API_KEY Secret

## Instruction

Juan Pablo Contreras requested wiring Gemini recommendations in staging by adding `RECOMMENDATIONS_PROVIDER=gemini`, `RECOMMENDATIONS_API_BASE_URL` pointing through Caddy egress, a `/gemini/*` reverse-proxy route in Caddy, and a `GEMINI_API_KEY` secret in Secrets Manager.

## What was done

* **`services/caddy/Caddyfile`:** Added `handle_path /gemini/*` reverse proxy to `https://generativelanguage.googleapis.com` with `header_up Host {upstream_hostport}`.
* **`infra/terraform/modules/secrets/main.tf`:** Added `"gemini_api_key" = "fynk/${var.environment}/gemini-api-key"` to `secret_shells`.
* **`infra/terraform/envs/staging/main.tf`:** Configured `ecs_api` with `RECOMMENDATIONS_PROVIDER=gemini`, `RECOMMENDATIONS_API_BASE_URL=https://${module.caddy_egress.private_ip}:8443/gemini/v1beta/openai`, `EGRESS_URL=https://${module.caddy_egress.private_ip}:8443`, and injected `GEMINI_API_KEY` from Secrets Manager.

## Verification

* `terraform fmt -check -recursive infra/terraform` passed.
* `terraform validate` in `infra/terraform/envs/staging` passed.
* `node --test scripts/*.test.mjs` passed.
