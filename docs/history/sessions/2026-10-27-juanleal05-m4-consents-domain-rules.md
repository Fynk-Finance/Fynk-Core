---
date: 2026-10-27
developer: Juan Carlos Leal
github: JuanLeal05
module: M4
jira: [SCRUM-20, SCRUM-21]
branch: feature/consents-domain-rules
tool: Claude Code
pr: none
status: done
---

# Consent domain rules (M4 step 1, part 1 of 4)

## Instruction

First M4 session. The developer asked to read the whole developer kit first and to treat it as the source of every criterion, decision and procedure. Then: "Let's start by the first branch in the work plan and then we'll work progressively towards completing the whole M4." The first branch is `feature/consents-backend` (schema, endpoints, real `ConsentChecker`, expiry job, audit). It came out to about 2,100 lines, so the developer chose to split it into 4 stacked branches. This is the first one.

## What was done

* `internal/consents/domain/consent.go`: `Scope`, `Status`, `Text`, `Evidence`, `Consent` and `Request`.
  * `NewPending` checks that the consent is specific (known provider; a non-empty subset of its scopes with no repeats; the purpose and the 365-day term shown on Conectar banco; the text version and the hash of the text the app showed; device id; app version; locale `es-CO`) and stores the acceptance evidence.
  * `Grant` turns a pending consent active only with complete evidence, the same text version and hash, and the bank's consent id. `expires_at = granted_at + term_days`.
  * `StatusAt` and `ActiveAt` report an active consent past its term as expired, even before the daily job writes it.
* `domain/errors.go`: one stable problem code per broken rule (`invalid_scopes`, `purpose_mismatch`, `term_mismatch`, `unknown_text_version`, `text_mismatch`, `missing_evidence` and others).
* Tests from the criteria: what was shown is what is recorded (HU-006), no open or general consents, no activation without evidence and a known text version (module test), and expiry after `term_days` with a fixed time (HU-007 and module test).

## Result

* Tests: 7 tests (13 rejection cases) pass; `go vet` and golangci-lint are clean.
* Pull request: opened right after this log, based on `chore/add-oapi-codegen-runtime`.

## Decisions and problems

* The purpose, the 12-month term and locale `es-CO` are constants taken from the M4 prompt. Changing them needs the team (prompt, "Ask before").
* The scopes each provider supports are listed in the domain until M5 exposes its provider list through `bank/ports`. All three providers support the three scopes.
* Go, pnpm (corepack) and the JS dependencies were not installed on this Mac. With the developer's approval they were installed as `docs/local-dev.md` says.

## Next step

`feature/consents-schema-and-store`: Postgres schema, seed of text `2026-10-v1` and the store.
