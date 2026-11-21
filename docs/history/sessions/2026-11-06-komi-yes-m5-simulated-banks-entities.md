---
date: 2026-11-06
developer: Daniel Palacios
github: Komi-yes
module: M5
jira: [SCRUM-75]
branch: feature/simulated-banks-fynk-providers
tool: Claude Code
pr: none
status: done
---

# M5 backend: four simulated entities and the demo provisioner port

## Instruction

Daniel said "continue with the rest of the steps", which for this slice is step 6 of the simulated banks plan: the Fynk side of the four fictional entities, built against `contracts/bank-simulator.yaml`.

## What was done

* `internal/bank/ports/providers.go`: the catalog lists Banco Demo, Billetera Demo, Banco Digital Demo and Cooperativa Demo (same shape and scopes as before), plus `Simulated()` with their ids. `GET /providers` keeps its shape.
* `internal/bank/ports/provisioner.go`: the `DemoProvisioner` interface, `InstallDemoProvisioner` and `InstalledDemoProvisioner`, copying the Revoker pattern. The default returns `ErrDemoProvisioningDisabled`, which wraps `ErrProviderUnavailable`.
* `internal/bank/adapters/bankdemo/bankdemo.go`: each adapter accepts any simulated provider id and sends it as `entity` in the PAR. The split of the wallet by account type is gone. `Provision(ctx, sub)` gets a `client_credentials` token with `scope=demo:provision` and posts `{"customerRef": sub}` to `/demo/v1/customers`. Failures become `provider_unavailable` (rate limits keep `Retry-After`); the sub and the bank's text are never put in an error.
* `internal/bank/wiring.go`: one adapter per simulated entity with the shared simulator settings, and Banco Demo's adapter is installed as the demo provisioner. The provisioner is reset to the disabled one at the start of `bankProviders`. No new environment variables.
* Tests: `ports/provisioner_test.go`, entity and provision cases in `bankdemo_test.go` (fake simulator extended), updated catalog and wiring tests, and `simulator_integration_test.go` (integration tag, compiled but not run here) now covers the PAR for every entity and idempotent provisioning.

## Result

* `go vet ./...` and `go test ./...` pass in `services/api`. golangci-lint v2.15.0 with the integration tag reports no issue in `internal/bank`; it reports 6 issues in `internal/backup` and `internal/platform/migrate` (other modules, not touched here).
* Pull request: not opened yet. This is slice 1 of 2; the endpoint and the contract are the next branch.
* The integration test was not run, because it needs the live simulator stack.

## Decisions and problems

* `ErrDemoProvisioningDisabled` wraps `ErrProviderUnavailable`, so the endpoint answers 503 and the sign-up hook can skip a disabled simulator without logging.
* M4 only calls `bankports.Lookup`, so the new ids pass its scope check with no M4 change. `contracts/modules/consents.yaml` has no enum of provider ids.
* The integration test no longer reads Billetera Demo with the static demo token, because the simulator now filters accounts by the consent's entity.
* The slice was split from the endpoint to stay under about 400 changed lines.

## Next step

Add the contract path and handler for `GET /bank/simulated-entities`.
