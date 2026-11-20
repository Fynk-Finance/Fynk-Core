---
date: 2026-11-20
developer: Juan Pablo Contreras
github: juancontrerasp
module: M14
jira: [SCRUM-46]
branch: fix/infra-caddy-start-without-bancodemo-ca
tool: Antigravity
pr: pending
status: done
---

# M14: Unblock Caddy Egress Startup Without banco-demo-ca.crt

## Instruction

Juan Pablo Contreras requested the quickest fix to unblock Caddy egress startup in staging (`:8443`), which was failing because `/etc/caddy/banco-demo-ca.crt` does not exist while `bank-simulator` runs in `BANK_DEV_MODE=1`.

## What was done

* **`services/caddy/Caddyfile`:** Commented out `tls_trust_pool file /etc/caddy/banco-demo-ca.crt` with a TODO to restore it once `bank-simulator:9443` mTLS CA is provisioned in staging, allowing Caddy to boot and serve `/gemini/*`, `/alpaca/*`, and `/bancolombia-*/*`.

## Verification

* `terraform fmt -check -recursive infra/terraform` passed.
* `terraform validate` in `infra/terraform/envs/staging` passed.
* `node --test scripts/*.test.mjs` passed (28/28).
