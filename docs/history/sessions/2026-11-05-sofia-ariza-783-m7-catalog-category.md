---
date: 2026-11-05
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M7
jira: [SCRUM-32, SCRUM-31]
branch: feature/transaction-catalog-category
tool: Claude Code
pr: "#272"
status: partial
---

# Categorize with the M9 merchant catalog

## Instruction

Close two items left open in earlier M7 session logs: "Hook up catalogCategory: getCatalogCategory once M9 exports it" and "Gate C: search over 12 months of data in under 300 ms on a mid-range Android phone", in one pull request if that is correct.

## What was done

* At first `develop` had no `getCatalogCategory`. The plan was to leave M7 ready and ask Karol. During the session, Karol pushed `feature/subscription-cancellation-guide` (SCRUM-58), which exports `getCatalogCategory(merchantKey): string | null`. Sofia chose to stack this branch on it.
* `adapters/catalog/catalogCategory.ts`: turns M9's lookup into the catalog step of the categorization. It keeps only category ids the app knows (`isCategoryId`), and a lookup that throws counts as no category.
* `index.ts`: `catalogCategory` wired to M9 and loaded on first use (inline `require`, like `vault/adapters/crypto/argon2Kdf.ts`).
* Tests:
  * `catalogCategory.test.ts`: known category, unknown merchant, a category the app does not know, a failing lookup.
  * `categorization.test.ts`: `categorizeNew` with the catalog. The catalog beats the keyword rules, the person's merchant category beats the catalog, small food stays `treats`, and the catalog is asked only for movements with a merchant key.

## Result

* Tests: 2448 of 2448 in the app. Lint, typecheck and Prettier clean on the touched files.
* Removing the catalog step from `categorize.ts` makes the new service test fail.
* Pull request: #272, on top of Karol's branch, which has no pull request yet.

## Decisions and problems

* **Import cycle.** M9 imports M7 and reads `getTransactionsBetween`, `getAccounts` and `TRANSACTION_DETAIL_ROUTE` while its file loads. The registry loads accounts, then transactions. A top-level import of M9 in M7 would load M9 halfway through M7, and the app crashes on start (checked: `Cannot read properties of undefined (reading 'DETAIL_ROUTE')`). So M7 loads M9 on first use. If M9 ever reads those exports only inside functions, a normal import works.
* M9 returns `string`, not `CategoryId`, because the catalog comes from the backend. M7 checks the id instead of trusting it.
* Until M9 has read its catalog from the vault (`vault.unlocked`), every lookup is null and the keyword rules decide. The first sync after opening the app can run before that. Those movements keep the rule's category, and the person can still change it.
* Gate C (SCRUM-31), the timing on a mid-range Android phone, was skipped by decision. No phone was reachable from this machine. The Jest check (3.000 movements under 300 ms on a laptop) still passes. The phone check stays open.
* `git fetch` failed with an SSL certificate error. It worked with `-c http.sslBackend=schannel`, which still checks certificates.

## Next step

* Karol opens the pull request of `feature/subscription-cancellation-guide`. Then this pull request is linked into a stack (`gh stack link`) and merges after it.
* Gate C: time the search on a mid-range Android phone with 12 months of data.
