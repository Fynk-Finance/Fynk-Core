---
date: 2026-11-05
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23]
branch: fix/bancolombia-invalid-client
tool: Claude Code
pr: "#291"
status: done
---

# Stop treating Bancolombia's 401 invalid_client as a lost consent

## Instruction

The first run of the Bancolombia sandbox tests failed with `invalid_grant`, while the sandbox was really refusing the connection for lack of an mTLS certificate. Juan Carlos approved fixing the adapter: "Yes, do it".

## What was done

* `services/api/internal/bank/adapters/bancolombia/consent.go`: `resourceError` reads the body of a 401. `invalid_client` (the gateway refused Fynk's certificate or credentials) becomes `provider_unavailable`; any other 401 is still `invalid_grant`.
* `accounts_test.go`: test with the sandbox's two real `invalid_client` answers and with a 401 about the token.
* `sandbox_integration_test.go`: presents the sandbox client certificate from `BANCOLOMBIA_SANDBOX_CERT_FILE` and `BANCOLOMBIA_SANDBOX_KEY_FILE` when set, as the Caddy egress does in staging.

## Result

* Tests: `go test ./internal/bank/...` passes; `gofmt` and `go vet` clean. The sandbox tests still need the certificate from Bancolombia.
* Pull request: #291.

## Decisions and problems

* Before the fix, a certificate problem in staging would have marked every Bancolombia link as needing to reconnect. Now the sync reports the bank as unavailable and tries again later.

## Next step

Run the sandbox tests with the certificate once Bancolombia issues it (ADR 0003, finding 7).
