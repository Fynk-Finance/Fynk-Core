---
date: 2026-11-05
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-22]
branch: feature/disconnect-bank-link
tool: Claude Code
pr: none
status: done
---

# Let Detalle de cuenta end a bank link

## Instruction

Juan Carlos asked to leave M4 and M5 ready even if other modules still miss pieces: "Let's just finish our part and I'll instruct my teammates to make the necessary changes."

## What was done

* M4: `revokeConsentAfterCheck(id, entity)` runs the identity check M2 installs, then revokes.
* M5: `disconnectLink(linkId)` finds the link's consent and entity and calls it. The existing revocation notice ends the link and marks its accounts in M6.
* Tests: 2 in M4, 3 in M5.

## Result

* Jest on `bank` and `consents` passes (29 suites, 244 tests); `tsc`, ESLint and Prettier pass. Pull request: not opened yet.

## Decisions and problems

* M6 owns Detalle de cuenta: it only adds the "Eliminar cuenta" button calling `disconnectLink(account.linkId)`.

## Next step

Sofia adds the button in M6.
