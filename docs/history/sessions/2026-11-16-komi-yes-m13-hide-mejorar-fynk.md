---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M13
jira: [SCRUM-42]
branch: fix/compliance-hide-mejorar-fynk
tool: Claude Code
pr: "#403"
status: done
---

# "Mejorar Fynk" is hidden in Privacidad y datos until the team decides

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Juan Pablo's module, so Juan Pablo reviews it as CODEOWNER.

## What was done

* `apps/mobile/src/modules/compliance/ui/PrivacyScreen.tsx`: the row and `improveFynk` are gone.
* `PrivacyScreen.test.tsx`: the new test, and the old one no longer expects the switch.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,879 tests, Go and script tests).
* Pull request: #403.
* The screen shows two switches.
* The test was run on the old screen and failed. An existing test expected the switch, so it changes too.

## Decisions and problems

* The strings are kept, with a comment, so the row comes back with a small change when the team decides.
* Not done: the other two switches still save nothing, and "Descargar mis datos" and the account deletion are not wired to the API. That is feature work, and where the switches are stored needs a row in "Where data lives".

## Next step

Juan Pablo reviews the pull request.
