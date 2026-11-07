---
date: 2026-11-06
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-75]
branch: feature/simulated-banks-signup-hook
tool: Claude Code
pr: none
status: done
---

# M1: create the demo accounts when the first device registers

## Instruction

Daniel said "continue with the rest of the steps": step 7, call the demo provisioner from `devices.Service.Register`.

## What was done

* `internal/identity/devices/service.go`: after a successful create of a device with status active (the user's first device), `Register` calls `bankports.InstalledDemoProvisioner().Provision(ctx, user.ID)` with a 2 second timeout. `user.ID` is the Keycloak sub (`auth.User.ID`). A new `WithLog` sets the logger; `internal/identity/module.go` passes `d.Log`.
* A failure is logged as a warning with a reason code only (`timeout`, `provider_unavailable` or `error`), never the error text or the sub. A disabled simulator (`ErrDemoProvisioningDisabled`) is skipped without a log line. Registration succeeds in every case.
* Tests in `devices/service_demo_test.go`: the first device calls the provisioner once with the sub; a second (pending) device does not; a replay with the same idempotency key does not; an error and a simulator that never answers (about 2 s) still return the device registered; the captured log never holds the sub; a disabled simulator logs nothing. Each test installs a fake provisioner and restores the previous one.

## Result

* `go vet ./...` and `go test ./...` pass in `services/api`. golangci-lint v2.15.0 with the integration tag reports nothing in `internal/identity`; its remaining issues are in `internal/backup` and `internal/platform/migrate`.
* Pull request: not opened yet. It stacks on `feature/simulated-banks-mobile-entities`.

## Decisions and problems

* The call is synchronous, as asked, so a slow simulator delays the registration response by up to 2 seconds. In production the provisioner is the disabled one, so there is no delay.
* A user who removes their only active device and registers a new one becomes active again and provisions again; the simulator call is idempotent, so this is harmless.
* No audit event was added (needs Juan Pablo's allow-list in M13).

## Next step

Run the stack with the simulator and check the Cuentas step end to end.
