---
date: 2026-10-29
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-26, SCRUM-28, SCRUM-33]
branch: feature/accounts-model-and-net-worth
tool: Claude Code
pr: none
status: done
---

# Balance total, connected count and number masking of M6

## Instruction

Sofia pasted the full M6 prompt ("You are building module M6 of Fynk: the account model on the phone, balances, consolidated net worth, cards, digital wallets and the manual cash account") and asked to follow its work plan. This branch is the first step: "net worth function with tests".

## What was done

* `domain/netWorth.ts`: `balanceTotal` (savings, checking, wallets and cash, minus what is owed on active credit cards, CDTs left out), `connectedAccountsSummary` ("N cuentas conectadas": active bank accounts, cards and wallets, without cash and CDTs) and `sortAccounts` (accounts, wallets, cards, CDTs, cash).
* `domain/masking.ts`: `last4Of` and `maskedNumber` (`•• 4821`), never more than 4 digits.
* `domain/syncedAccounts.ts`: `cleanSyncedAccounts` checks what M5 writes after a sync (no manual or cash accounts, provider account id and link required, integer centavos, CDT details) and keeps one account per `(provider, providerAccountId)` with only the last 4 digits. `bogotaDate` gives the day of a balance history point.
* `testing/fixtures.ts`: accounts with the design numbers (Banco Demo ahorros 3.200.000, Billetera Demo 4.600.000, cash 600.000, a card owing 500.000, a CDT).
* 31 unit tests: `$8.400.000`, `$7.900.000` with the card, a CDT does not change the total, revoked accounts leave the total and the count, masking of full card numbers.

## Result

* Tests: 31 of 31 pass. Lint and typecheck clean.
* Pull request: bottom of the M6 stack, opened at the end of the session.

## Decisions and problems

* The first work plan branch was about 990 lines with tests, so it was split in two stacked branches: this pure domain branch and `feature/accounts-vault-and-sync-api` with the tables, the M5 write API and the read API.
* Credit cards count in "N cuentas conectadas": the prompt excludes only cash and CDTs, and a card is a connected bank product.
* Credit card debt follows the shared contract: `balanceMinor` of a card is the positive amount owed and is subtracted. The demo fixture of M16 has the card balance as a negative number; M5 must map it to the contract.

## Next step

Vault tables, `upsertFromSync`, `markLinkRevoked` and `useAccounts()` on the branch above.
