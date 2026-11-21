---
date: 2026-11-05
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23]
branch: chore/api-bancolombia-settings
tool: Claude Code
pr: none
status: done
---

# Optional settings of Bancolombia's sandbox

## Instruction

Juan Carlos asked to finish M4 and M5 and to build the Bancolombia part with the API Market access he got: "the idea es to use the sandbox"; "create that part and tell what to do so that we can link that." For the customer document that Bancolombia's consent API requires, he chose to send only the sandbox's fictional customer from the settings. Juan Carlos approved adding the settings to M0's `platform/config` in their own pull request, with Sofia as reviewer.

## What was done

* `platform/config`: `BANCOLOMBIA_CLIENT_ID`, `BANCOLOMBIA_CLIENT_SECRET`, `BANCOLOMBIA_ISSUER`, `BANCOLOMBIA_AUTHORIZE_URL`, `BANCOLOMBIA_SANDBOX` and `BANCOLOMBIA_SANDBOX_OWNER_{ID_TYPE,ID,NAME}`, all optional and off.
* The sandbox owner is refused unless `BANCOLOMBIA_SANDBOX=true`; the authorize URL must be https outside local.
* 4 tests.

## Result

* `go test ./internal/platform/config/` passes; golangci-lint 0 issues. Pull request: not opened yet.

## Decisions and problems

* The layer sits above M5's own layers so Sofia's review does not block them.

## Next step

The wiring.
