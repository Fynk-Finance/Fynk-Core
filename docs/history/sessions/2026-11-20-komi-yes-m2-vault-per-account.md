---
date: 2026-11-20
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-96]
branch: fix/vault-one-per-account
tool: Claude Code
pr: none
status: done
---

# Keep one vault per account on the phone

## Instruction

Daniel reported, locally and in staging: "when for example signing out of an account and entering with another one and signing out and wanting to get into the first account I get the onboarding again even though I already entered and configured the account with the banks". Asked how account A should come back, Daniel chose "One vault per account": keep a separate vault file and key for each account on the phone. This reverses the 9 Nov rule "erase local, start fresh".

## What was done

* Cause:
  * When B signed in, `lockController` saw an owner tag for another `sub` and ran `vault.wipe()`. That erased A's file and every Keychain entry.
  * The onboarding progress lives only in the vault and has no backup collection. Bank links and tokens are never backed up, by design.
  * So A came back to the onboarding and had no banks, even after a restore with the recovery code.
* `domain/vaultSlot.ts`: the slot is the hex of the first 16 bytes of SHA-256 of the Keycloak `sub`. The raw id never appears in a file or service name.
* `adapters/defaultSlot.ts`:
  * `currentSlot()` is the slot of the signed in account, read on every call.
  * `removalSlot()` is the current slot, or else the last one this process saw.
  * `rememberAccount(id)` sets that last slot.
* `adapters/keychain/dekStore.ts`:
  * Every service ends in `.<slot>`.
  * With nobody signed in, reads find nothing and writes throw.
  * Removals use the removal slot. Removing never leaks data.
* `adapters/sqlite/opSqliteDriver.ts`: each account opens `fynk-vault-<slot>.db`. A deletion with nobody signed in uses the removal slot.
* The four default factories pass both slots.
* `index.ts`: `wipe(userId?)` remembers the given account first.
* `identity/index.ts`, `onRemoved`: it now reads the account before `signOut()` and passes it to `wipe()`. Without this, the slot was already gone and a removed phone erased nothing. The implementer's first version had this bug, and I caught it in review.
* `CLAUDE.md`, "Where data lives" (M0): the vault owner and biometrics offer rows now say each account has its own entries.
* Tests:
  * `vaultSlot.test.ts`: the slot is fixed, 32 hex characters, and different per account.
  * `defaultSlot.test.ts`: the removal slot keeps the last account after sign out.
  * `dekStore.test.ts`: services carry the slot, two slots never see each other, nobody signed in reads nothing, and removals after sign out still remove the last slot.
  * `opSqliteDriver.test.ts`: the file name per slot, and the deletion after sign out.

## Result

* This commit alone: `tsc --noEmit` is clean, and `src/modules/vault` and `src/modules/identity` pass (65 suites, 973 tests). With the commit stacked above it, the whole mobile suite passes (251 suites, 2939 tests). ESLint and Prettier are clean on the changed files.
* With this commit, A, then B, then A keeps A's vault: B gets an empty slot, and the existing first-phone path only wipes B's slot.
* Not tried on a phone yet.

## Decisions and problems

* Reverses `2026-11-09-komi-yes-m2-vault-owner-binding.md` ("Erase local, start fresh"). The rule "one account never reads another account's vault" still holds, because each account only finds its own key.
* About 520 changed lines, more than half of them tests. The stack above it holds the rest (legacy erase, lock controller changes), so this pull request already fixes the bug alone.
* Until the pull request above merges, the vault from before slots stays on the phone, unused.
* The worktree the first implementer got came from an old commit. The work was redone in a new worktree from `develop`.

## Next step

Review the pull request above: legacy erase and backup reset on account switch.
