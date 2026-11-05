---
date: 2026-11-05
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-58]
branch: feature/subscription-cancellation-guide
tool: Claude Code
pr: none
status: done
---

# "Cómo cancelarla" with the merchant catalog, app side (SCRUM-58)

## Instruction

Written while the backend waited for Go ("puedes ir adelantando el scrum 58"), and opened after "vuelve a revisar el repositorio, y revisa qué falta de mis tareas". The backend (#271) is merged, so this branch was rebuilt on `develop` with only its app commit.

## What was done

* **`domain/catalog.ts` (pure):**
  * `findMerchant`: the same key first, else the longest pattern as whole words.
  * `forDetection`.
  * `safeCancelUrl`: only `https://` links open.
* **Vault migration 5:** `recurring_catalog`, one row with the ETag, the entries and the time of the last check. Content only; not backed up.
* **`adapters/api/catalogApi.ts`:** `GET /catalog/merchants` with `If-None-Match`; a `304` means unchanged.
* **`application/catalogService.ts`:**
  * `load()` on `vault.unlocked`;
  * `refresh()` at most once a day while the app is open; a 304 only updates the time of the check;
  * `lookup()` synchronous for detection and the detail screen.
* **Detalle de suscripción:**
  * "Cómo cancelarla" shows the merchant's numbered steps and "Abrir página de cancelación" (system browser);
  * "Fynk no cancela nada por ti: cuando termines, toca 'Ya la cancelé'";
  * the general text when the merchant is not in the catalog.
* **Detection** now uses the catalog's names and kinds.
* **`getCatalogCategory(merchantKey)`** is exported for M7 (its `TODO(M9)` in `transactions/index.ts`).
* **Tests:**
  * `domain/catalog.test.ts` (4);
  * `adapters/api/catalogApi.test.ts` (3): 200 with ETag, the 304, an error;
  * `application/catalogService.test.ts` (3): empty before the first download, kept in the vault, at most once a day with the ETag;
  * `ui/CancelGuide.test.tsx` (2): the steps and the page; the general text in dark theme.

## Result

* 224 suites and 2540 tests pass. ESLint, tsc and Prettier are clean.

## Decisions and problems

* **Matching by whole words** keeps "pineapple store" from matching "apple".
* **Only https links** are opened, even though the backend already restricts `cancel_url`.

## Next step

Sofia: pass `catalogCategory: getCatalogCategory` in `transactions/index.ts`. Then SCRUM-58 is complete end to end.
