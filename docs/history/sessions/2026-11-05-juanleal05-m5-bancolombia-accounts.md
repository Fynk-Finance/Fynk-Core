---
date: 2026-11-05
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-24, SCRUM-23]
branch: feature/bancolombia-adapter-accounts
tool: Claude Code
pr: none
status: done
---

# Bancolombia adapter: accounts, balances and movements

## Instruction

Juan Carlos asked to finish M4 and M5 and to build the Bancolombia part with the API Market access he got: "the idea es to use the sandbox"; "create that part and tell what to do so that we can link that." For the customer document that Bancolombia's consent API requires, he chose to send only the sandbox's fictional customer from the settings.

## What was done

* `Accounts`: from the balances API, savings (SVGS) and checking (CACC) with the available balance (AVLB) in centavos and only the last 4 digits; loans and non-COP accounts left out; paging by `Links.Next`.
* `Transactions`: 40 a page with the bank's page number as cursor, from at most 90 days back; debits negative; rejected and cancelled left out; finalized ones pending; 404 X050 is an empty page.
* Amounts parsed from decimal strings or numbers without floating point.
* Tests with the documented example bodies.

## Result

* Tests pass; golangci-lint 0 issues. Pull request: not opened yet.

## Decisions and problems

* Bancolombia gives 90 days of history, not the 12 months of HU-010. Recorded in ADR 0003.

## Next step

The settings (Sofia's file) and the wiring.
