---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M12
jira: [SCRUM-70]
branch: fix/notifications-back-up-settings
tool: Claude Code
pr: "#405"
status: done
---

# Ajustes de notificaciones travel in the encrypted backup

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Karol's module, so Karol reviews it as CODEOWNER.

## What was done

* `application/notificationService.ts`: `backupCollection`, the version counter and `markDirty` after each change.
* `index.ts` and `adapters/vault/vaultAccess.ts`: the collection is registered with M2.
* Tests: five in `application/settings.test.ts`.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,886 tests, Go and script tests).
* Pull request: #405.
* The settings are exported, marked and restored.
* `backupCollection` did not exist before, so the five tests could not pass on the old code.

## Decisions and problems

* One record for all the settings, like `analytics.caps` does for its threshold: they are small and change together.
* Settings that were never changed export nothing, so a new phone keeps its defaults.

## Next step

Karol reviews the pull request.
