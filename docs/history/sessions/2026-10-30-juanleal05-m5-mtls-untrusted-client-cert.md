---
date: 2026-10-30
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-45]
branch: test/bank-mtls-untrusted-client-cert
tool: Claude Code
pr: none
status: done
---

# Refuse a client certificate from another CA at Banco Demo

## Instruction

Part of step D ("Start with D"): the M5 prompt's mTLS test, "Without the client certificate the Banco Demo rejects the connection (test through Caddy with and without the cert)". A separate pull request from `develop`, outside the KMS stack, because it depends on nothing else.

## What was done

* `adapters/bankdemo/simulator_integration_test.go`: `TestSimulatorDirectListenerNeedsTheClientCertificate` now has three cases:
  * no certificate is refused (it was already there);
  * a certificate from a CA the bank doesn't trust is refused, even with Fynk's subject (new; the certificate is made in the test);
  * Fynk's certificate works (it was already there).
* The contract tests through the Caddy egress (accounts, 12 months of movements, PAR, CDT catalog) cover the "through Caddy" side.

## Result

* Tests: run inside the Docker network against the local simulator and Caddy (`docker compose up -d bank-simulator caddy`). The five Simulator tests pass; the revocation test wasn't run because it changes the simulator's state.
* Pull request: not opened yet. About 35 lines, test only.

## Decisions and problems

* **No Caddy change.** A "through Caddy without the certificate" case would need a second Caddy route without `tls_client_auth`. That's M14's file and adds nothing the direct-listener test doesn't show. The direct test proves the bank refuses; the egress tests prove Caddy presents the certificate.
* **Still open for HU-031:** the connection evidence on Fynk's side, rotation on staging, and the staging settings. All of them need Juan Pablo (M14, M16).
* **CI doesn't run these integration tests** (`make test-integration` skips our packages). They run by hand, as the file's header explains.

## Next step

Open the pull request. Then the KMS SDK and settings, after the developer's OK.
