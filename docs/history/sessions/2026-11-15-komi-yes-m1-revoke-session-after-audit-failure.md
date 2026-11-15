---
date: 2026-11-15
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: fix/identity-revoke-session-after-audit-failure
tool: Claude Code
pr: "#385"
status: done
---

# A removed device's Keycloak session ends even when the audit write fails

## Instruction

Daniel asked for "a deep code analysis of the whole Fynk repository" with "a verified list of real bugs", and to "fix the simple ones yourself" in his own modules (M1, M2, M16b), each with a test that fails before and passes after.

## What was done

* `internal/identity/devices/service.go`: `Remove` and `removeOthers` return the session ids of the removed devices together with the audit error.
* `internal/identity/devices_http.go`: `RemoveDevice` and `SignOutOtherDevices` end those sessions before they look at the error.
* `internal/identity/ports/ports.go`: `RemoveOthers`, which the backup reset uses, does the same.
* Tests: `TestRemoveReturnsTheSessionsWhenTheAuditFails` (service), `TestRemovalEndsTheSessionsEvenWhenTheServiceFailsAfterRemoving` (HTTP) and `TestReaderRemoveOthersRevokesSessionsWhenTheAuditFails` (port). The first two were run before the change and failed.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,878 tests, Go and script tests).
* golangci-lint with `--build-tags integration` reports 6 issues in files this branch does not touch. They are on `develop` too.
* Pull request: #385.
* The answer is still an error (500) when the audit fails. The device stays removed, as before.

## Decisions and problems

* The bug: the device is removed in a committed transaction and audited afterwards. When the audit failed, no session id went back, so the session was not ended. A retry found the device already removed and returned no session id either, so the session stayed alive in Keycloak.
* The `device.removed` event of that removal is still missing after a failed audit. Writing the event inside the same transaction needs a change to the audit port, so it is in the analysis report, not here.
* The larger finding of the analysis is not fixed here: `X-Device-Id` is trusted without proof that the caller holds that device. It needs a design decision.

## Next step

Plan the proof of possession for `X-Device-Id` with the team.
