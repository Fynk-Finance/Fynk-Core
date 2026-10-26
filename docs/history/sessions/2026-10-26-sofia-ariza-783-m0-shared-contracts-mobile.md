---
date: 2026-10-26
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: feature/shared-contracts-mobile
tool: Claude Code
pr: none
status: done
---

# M0 Step 2 (mobile half): shared domain types, events, ports and test stubs

## Instruction

Same session as the monorepo skeleton. Step 2 of the M0 prompt: "Port interfaces from section 3 of the contracts, each with an in memory stub in `src/shared/testing/`", plus the domain types, money helpers (`1248035000` prints `$12.480.350`, `520000000` signed prints `+$5.200.000`), `normalizeMerchant` and the typed app events. Step 2 came to about 3.000 changed lines, so Sofia chose to split it into two pull requests: this mobile one and `feature/shared-contracts-api`.

## What was done

* `src/shared/domain/`: `types.ts` (section 2 of the shared contracts, plus the `ModuleName` union of the 14 modules that section 3 uses but never defined), `snapshot.ts` (`AggregateSnapshot`, section 3.5), `categories.ts` (20 Spanish labels), `money.ts` (`formatCop`, `formatCopSigned`, `parseCopInput`, integer math only, no `Intl`), `normalizeMerchant.ts` (lowercase, no accents, no digits, no card or city words).
* `src/shared/events/appEvents.ts`: typed emitter (section 3.3). A listener that throws does not stop the others, and the default error report prints only the event type.
* `src/shared/ports/`: `vault.ts` (with `VaultLockedError`), `backup.ts`, `notifications.ts`. Types only: M2 and M12 implement them.
* `src/shared/testing/`: `createInMemoryVault` (real SQLite through sql.js, migrations tracked per module in `vault_migrations(module, version)`, rejects tables without the module prefix), `createInMemoryBackupRegistry` (rejects bank collections), `createInMemoryNotifications` (dedupe keys, scheduled notifications fired by `fireDue`), `createFixedClock`.
* `sql.js` 1.15.1 and `@types/sql.js` 1.4.11 added and recorded in `docs/adr/0001-stack.md`.

## Result

* Jest: 94 of 94 pass. 100 % line coverage on `money`, `categories`, `normalizeMerchant`, `appEvents` and every stub.
* Reference numbers of section 7 are fixtures in `money.test.ts`: `$112.600`, `$56.800`, `$1.930.600`, `$8.400.000`, `$1.453.900`, `$840.000`.
* `make lint test` passes on this branch alone.
* Pull request: opened right after this log.

## Decisions and problems

* `formatCopSigned` prints a plain hyphen (`-$184.300`) as the shared contracts say. The design draws a typographic minus (`−`). That is left for `AmountText` in Step 4.
* `parseCopInput` accepts dot thousands and an optional decimal comma with 1 or 2 digits (`1.500,50`), and returns `null` for anything else (`12.48`, `1,234.56`).
* sql.js 1.15.2 was published this morning and pnpm 11's minimum release age policy blocked it. pnpm silently added an exception to `pnpm-workspace.yaml`. The exception was dropped and 1.15.1 (one week old) used instead.
* The city and card word lists of `normalizeMerchant` are constants in the file. M7 and M9 can extend them through a pull request to M0.

## Next step

Review and merge this pull request and `feature/shared-contracts-api` (they are independent). Then Step 3, `feature/api-contract-pipeline`.
