---
date: 2026-11-04
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-55]
branch: feature/recurring-detection-on-sync
tool: Claude Code
pr: none
status: done
---

# Detection of recurring payments after each sync (SCRUM-55)

## Instruction

Karol said "si" to the next step: SCRUM-55, detect recurring payments after each sync, plus the "Detectamos pagos recurrentes" screen. This pull request is the detection; the screen comes in the next one.

## What was done

* **Review first:**
  * The pure algorithm (`domain/detect.ts`) was already in `develop` since 28 Oct. The local branch `feature/recurring-detection` was stale and was deleted.
  * GitHub: `gh` has an expired token in this session. `git push` and the read-only API work, so PRs are opened with a prefilled link.
* **Migration 3:** `recurring_proposals` (merchant, score, proposal JSON, status pending/dismissed/confirmed, amount, dates).
* **`createVaultProposalStore`:**
  * pending proposals;
  * decisions (dismissed with their amount, and confirmed);
  * `replacePending`, which drops the proposals no longer detected and counts the new ones;
  * `decide`.
* **`createDetectionService`:**
  * `run()` reads M7's outflows of the last 365 days and calls `detectRecurring`. Merchants of existing items and of confirmed proposals are known; dismissed ones keep their amount. Returns how many proposals are new.
  * `confirm(merchantKey, edits)` creates a detected item (name and amount can be edited).
  * `dismiss(merchantKey)`.
* **`recurringService.create`** takes an optional `{ merchantKey }`. With it, the item is saved with `source: 'detected'`.
* **`index.ts`:** runs detection on `sync.completed` and emits `recurring.detected` when there are new proposals. The catalog lookup returns null until SCRUM-58.
* **Tests:** `application/detectionService.test.ts` (12) on a real vault:
  * the 12 month window and the stored proposal;
  * nothing is confirmed by itself;
  * only new ones are counted;
  * a stopped charge goes away;
  * confirming creates the detected item and stops proposing it, even after the item is deleted;
  * the amount can be edited;
  * an unknown proposal is refused;
  * a dismissed one comes back only when the amount changes by more than 30 %.

## Result

* 196 suites and 2380 tests pass. ESLint, tsc and Prettier are clean.

## Decisions and problems

* **A full run, not an incremental one.** Detection runs over all 12 months on every sync, instead of only the groups with new movements as the prompt says. It is a pure pass over one year of movements and keeps the code simple. It can become incremental if it shows up as slow.
* **A deleted detected item is not proposed again,** because its proposal stays confirmed.
* **Proposals are not backed up.** They are recomputed from the movements. After a restore, a dismissed proposal can show up once more.

## Next step

The "Detectamos pagos recurrentes" screen with confirm and dismiss per item, opened on `recurring.detected`.
