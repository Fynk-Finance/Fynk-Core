---
date: 2026-11-20
developer: Daniel Palacios
github: Komi-yes
module: M16b
jira: [SCRUM-75]
branch: fix/simulated-entities-sync
tool: Claude Code
pr: none
status: done
---

# Sync the accounts of Banco Digital Demo and Cooperativa Demo

## Instruction

Daniel reported three problems seen locally and in staging, among them: "even when trying to connect to an account that is not banco demo or billetera digital demo it doesnt connect even though it shows that I have money in a digital bank". The consent finished, but nothing appeared in the app and the bank did not show as connected. This session covers that problem. The other two (same movements for a second user, onboarding again after switching accounts) have their own branches and logs.

## What was done

* `apps/mobile/src/shared/domain/types.ts` (M0): `ProviderId` now includes `banco-digital-demo` and `cooperativa-demo`.
* `apps/mobile/src/modules/bank/domain/syncMapping.ts`: the providers accepted by `toAccount` are now `SIMULATOR_ENTITY_IDS` plus `bancolombia`. Before, `toAccount` threw `RangeError("Unknown provider")` for the two new entities, and the sync engine marked the link `failed` after the link screen had already shown success.
* `apps/mobile/src/modules/bank/domain/provider.ts`: `SIMULATOR_ENTITY_IDS` is checked against `ProviderId` with `satisfies`, so the two lists cannot drift apart.
* `apps/mobile/src/modules/accounts/adapters/vault/migrations.ts` (M6): migration 3 rebuilds `accounts_accounts` with the wider `provider` CHECK, because SQLite cannot change a CHECK in place. It copies every column, including `backup_version` from migration 2, and recreates the three indexes. No table references `accounts_accounts`.
* Tests:
  * `syncMapping.test.ts`: `toAccount` maps an account of each of the five providers and still rejects an unknown one.
  * `syncEngine.test.ts`: a `banco-digital-demo` link and a `cooperativa-demo` link each sync their accounts and movements, and the link reports `synced`.
  * New `accounts/adapters/vault/migrations.test.ts`: migration 3 keeps the rows and `backup_version`, accepts both new providers, still rejects an unknown one, and keeps the unique indexes.

## Result

* Against the old code, the new tests fail (9 failures). With the fix, `src/modules/bank` and `src/modules/accounts` pass: 40 suites, 351 tests. `tsc --noEmit` is clean. ESLint and Prettier are clean on the changed files.
* Not yet tried on a phone.

## Decisions and problems

* The backend, the consents module, the simulator, the contracts and the Cuentas step already handled all four entities. Only the mobile sync, the shared type and the vault CHECK did not.
* The old sync test with a `cooperativa-demo` link did not catch this, because its fake failed with `consent_revoked` before `toAccount` ran.
* The in-memory test vault runs one statement per `execute`, so the migration test applies the script of migration 3 statement by statement. The real vault runs the whole script.
* `types.ts` is an M0 file frozen after Gate A, and the accounts migration is M6. Both need Sofia's review.

## Next step

After the merge, open the app so migration 3 runs, link Banco Digital Demo and Cooperativa Demo, and check that their accounts and movements appear in Mis cuentas.
