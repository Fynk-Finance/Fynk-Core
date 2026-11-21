---
date: 2026-10-28
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-45, SCRUM-23]
branch: chore/add-egress-config
tool: Claude Code
pr: none
status: done
---

# Egress URL and CA settings in the shared config

## Instruction

Before M5's Banco Demo adapter, the developer asked what is best for the project, not only for the module: put the Caddy egress settings in M0's shared config or keep them inside the bank module. The answer was the shared config, because the egress also serves M15 (Alpaca route), every API setting is read in one place, and M1 already did the same for Keycloak (#22). Key sentence: "Open the chore PR and you know how to do it, if you touch code outside, explain why so that the reviewer can analyze it."

## What was done

* `services/api/internal/platform/config/config.go` (M0): `EgressURL` (`EGRESS_URL`, trailing slash removed, must be `https://`) and `EgressCAFile` (`EGRESS_CA_FILE`, the CA of the egress's own TLS certificate).
* `config_test.go`: both values are read; no egress is accepted; a plain `http://` egress is rejected.
* `docker-compose.yml` (M0): the API gets `EGRESS_URL=https://caddy:8443` and `EGRESS_CA_FILE=/certs/ca.crt`, and mounts only `certs/ca.crt`. The client key stays in Caddy.
* `services/api/.env.example` (M0): the same for an API running on the host (`https://localhost:8443`, `../../certs/ca.crt`).

## Result

* Tests: `make lint` and `make test` pass; `docker compose config` is valid.
* Pull request: opened right after this log, with Sofia as reviewer.

## Decisions and problems

* The egress is optional at startup for now. Staging's ECS task definition (M14) does not set it yet, so requiring it would stop staging from starting as soon as this merges. Without it, bank and market calls fail closed. It can become required once M14 sets it.
* M14 has to add `EGRESS_URL` and `EGRESS_CA_FILE` to the API's task definition. The pull request asks the M14 owner.

## Next step

M5 step 1, part 2: `adapters/bankdemo`, stacked on #52 and on this branch.
