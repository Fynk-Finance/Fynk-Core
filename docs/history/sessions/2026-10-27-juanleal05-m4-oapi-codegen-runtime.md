---
date: 2026-10-27
developer: Juan Carlos Leal
github: JuanLeal05
module: M4
jira: [SCRUM-20]
branch: chore/add-oapi-codegen-runtime
tool: Claude Code
pr: none
status: done
---

# Add the oapi-codegen runtime for M4's generated server

## Instruction

While building `feature/consents-backend` (M4 step 1), the server generated from `contracts/modules/consents.yaml` needed `github.com/oapi-codegen/runtime`, because it has a path parameter, a header parameter and the `uuid` format. CLAUDE.md says "Adding a library is its own small pull request (`chore/add-<library>`), reviewed by M0", so it got its own branch.

## What was done

* `services/api/go.mod` and `go.sum`: `github.com/oapi-codegen/runtime v1.8.0`, the version ADR 0001 already pins, plus its dependency `github.com/apapsch/go-jsonmerge/v2 v2.0.0`. Both stay `// indirect` until the consents server imports them.

## Result

* `go build ./...`, `go mod verify` and `go test ./...` pass.
* Pull request: opened right after this log.

## Decisions and problems

* No ADR change: ADR 0001 already lists `oapi-codegen/runtime v1.8.0`. It was missing from `go.mod` only because no generated server used it yet.

## Next step

The M4 branches stacked on this one, starting with `feature/consents-domain-rules`.
