---
date: 2026-11-05
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-44]
branch: fix/bank-nonce-max-length
tool: Claude Code
pr: none
status: done
---

# Align the X-Request-Nonce length with the contract

## Instruction

Part of the plan Juan Carlos approved: "let's work in the order you proposed". The handoff listed it as a small fix: the contract allows a nonce of up to 64 characters and the service accepted up to 128.

## What was done

* `bank/service/queries.go`: `MaxNonceLength = 64` next to `MinNonceLength`, used by `CheckNonce` and in the `nonce_required` message.
* `bank/service/queries_test.go`: a nonce of 65 characters is refused, and nonces of 16, 32 (what the phone sends) and 64 characters are accepted.

## Result

* Tests: `go test ./internal/bank/...` passes. `go vet` and golangci-lint: 0 issues.
* Pull request: not opened yet.

## Decisions and problems

* The code follows the contract (contract first), not the other way round: no contract change, nothing to regenerate, and the phone already sends 32 characters.
* The contract marks the header `required: false` while the service always requires it and answers `400 nonce_required`. Left as is: if it were required, the generated handler would refuse a missing header with its own error instead of `nonce_required`.

## Next step

Mark consents still pending after 24 hours as failed (M4).
