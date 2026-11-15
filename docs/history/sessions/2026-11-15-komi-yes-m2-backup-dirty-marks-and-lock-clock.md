---
date: 2026-11-15
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62, SCRUM-8]
branch: fix/vault-dirty-marks-and-lock-clock
tool: Claude Code
pr: none
status: done
---

# Two vault bugs found in the code analysis: a lost backup mark and a lock that a clock change skips

## Instruction

Daniel asked for "a deep code analysis of the whole Fynk repository" with "a verified list of real bugs", and to "fix the simple ones yourself" in his own modules (M1, M2, M16b), each with a test that fails before and passes after.

## What was done

* `application/backupRegistry.ts`: `clearDirty(rows)` deletes a mark only when its `seq` is still the one the round read. It took a `maxSeq` before and deleted every mark up to it.
* `application/backupSync.ts`: the two `clearDirty` calls no longer pass `maxSeq`.
* `domain/lockPolicy.ts`: `shouldLock` also locks when the time now is before the time the app went to the background.
* Tests: one new case in `backupRegistry.test.ts` (a record marked again after the row with the highest seq was cleared stays dirty) and one in `lockPolicy.test.ts` (clock set back). Both failed before the change.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,880 tests, Go and script tests).
* Pull request: not opened yet.
* A record edited while its own upload is in flight now always stays marked, so the next round uploads the edit.

## Decisions and problems

* The bug: a new mark gets `MAX(seq) + 1` of the rows left in the table. Once a round clears the row with the highest seq (a record that no longer exists, or an earlier chunk when there are more than 200), a new mark can repeat a seq the round already saw, and `seq <= maxSeq` deleted it. The edit stayed out of the backup until the record changed again.
* The exact seq is safe because a row that is marked again always gets a seq above its own.
* The lock compares wall clock times (`Date.now()`). A clock set back while the app waits gave a negative wait and no lock. The real wait is unknown in that case, so the vault locks.
* Found in the same analysis and left for a decision: the lock rule is skipped in the `recoveryCode` and `restoring` states, and a restore that skips records it cannot decrypt still reports "restored".

## Next step

Daniel reviews the analysis report and decides which of the open findings of M2 to plan.
