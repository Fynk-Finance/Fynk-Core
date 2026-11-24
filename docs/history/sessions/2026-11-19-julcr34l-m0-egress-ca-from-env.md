---
date: 2026-11-19
developer: Julián Castiblanco
github: JulCR34l
module: M0
jira: [SCRUM-45, SCRUM-38]
branch: feature/egress-ca-from-env
pr: "#426"
status: done
---

# Read the egress CA from EGRESS_CA_PEM

* Who: Julián Castiblanco (`@JulCR34l`), for M0 (owner Sofía Ariza, reviewer)
* Module: M0 Foundations (`internal/platform/config`)
* Jira: SCRUM-45, SCRUM-38
* Branch: `feature/egress-ca-from-env`

## Instruction

To run Gemini (M11), Banco Demo (M5) and Alpaca (M15) through the Caddy egress in staging, the API needs the CA of the egress's own certificate. Juan Pablo (M14) asked to request it from M0, and Julián asked: "puedes hacer el cambio dentro del código".

## What was done

* `config.Load` reads `EGRESS_CA_PEM`. ECS on Fargate cannot mount a Secrets Manager secret as a file, only as an environment variable, so the PEM text is checked (at least one valid certificate) and written to a private temporary file (0600), whose path becomes `EgressCAFile`. The three modules that call the egress do not change.
* `EGRESS_CA_FILE` and `EGRESS_CA_PEM` together are an error, and so is a value without a valid certificate. A value with the line breaks escaped as `\n` also works.

## Result

* `go vet`, golangci-lint and `go test -race` pass for `internal/platform/config` and `cmd/...`.

## Next step

Sofía reviews. M14 stores the CA in Secrets Manager and maps it to the API task as `EGRESS_CA_PEM` (PR #425).
