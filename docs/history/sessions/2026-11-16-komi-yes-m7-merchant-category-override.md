---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M7
jira: [SCRUM-32]
branch: fix/transactions-merchant-category-over-old-choice
tool: Claude Code
pr: "#411"
status: done
---

# A merchant-wide category also replaces an older choice made for one movement

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Sofia's module, so Sofia reviews it as CODEOWNER.

## What was done

* `adapters/vault/vaultCategoryStore.ts`: the older overrides follow the merchant's category.
* `application/categoryService.ts` and `ports.ts`: every override written is marked dirty.
* Test: one in `categoryService.test.ts`.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,879 tests, Go and script tests).
* Pull request: #411.
* The merchant's category holds after a restore.
* The test was run on the old code and failed after the restore.

## Decisions and problems

* The older choices are rewritten, not deleted: the overrides have no deleted mark in the backup.
* Not done, the other three items of BUG-27, all in M6. Each needs your decision: a manual movement added while connected and deleted after the link ends (the movement would have to record whether it changed a balance, which is a migration), an account the bank stops returning (close it, hide it or keep it), and unknown available credit shown as $0 (what to show instead).

## Next step

Sofia reviews the pull request and decides on the three M6 items.
