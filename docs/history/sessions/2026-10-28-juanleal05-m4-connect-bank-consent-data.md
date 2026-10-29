---
date: 2026-10-28
developer: Juan Carlos Leal
github: JuanLeal05
module: M4
jira: [SCRUM-20]
branch: feature/connect-bank-consent-data
tool: Claude Code
pr: none
status: done
---

# Record the consent of Conectar banco from the app (M4 step 3, part 1)

## Instruction

The developer started the session from the handoff file and then asked to begin M4 step 3. Key sentence: "Fine, let's start with the first task at hand which is M4 step 3. Make a quick audit on develop and from there, you can start building in the dedicated branch." The developer also asked to read the developer kit and both `CLAUDE.md` files first, to check the logs, to write the session entry with today's date, and to use `gh stack`.

## What was done

* **Audit of `develop`** (at `80da693`, M4 step 2):
  * all of 28 Oct's M4 and M5 pull requests are merged;
  * `make generate`, `make lint` and `make test` pass: 721 mobile tests, every Go package, 0 lint issues.
* **The plan changed**, agreed with the developer: M4 step 3 → M4 step 4 → M5 step 2. M4's steps 3 and 4 only need what is on `develop`, while M5 steps 3 and 4 wait for M2's vault and M16's authorization page.
* **The work is split into a stack**, because it was about 1,360 lines:
  * this branch has the data side;
  * `feature/connect-bank-consent-ui`, on top, has the cards and the button;
  * the M5 host screen will come above both.
* **`apps/mobile/src/modules/consents/`:**
  * `domain/consent.ts`, pure:
    * `scopesOf` gives the provider's scopes in the design's order and drops unknown ones;
    * `buildConsentRequest` builds the request from exactly what was shown;
    * `purposeAndTerm` writes "Finalidad: … Vigencia: 12 meses." from the published text;
    * `canGoToPortal` is the button rule;
    * `consentErrorKind` groups the API's codes.
  * `adapters/consentsApi.ts`: `GET /consent-texts/current` and `POST /consents` with `Idempotency-Key`.
  * `adapters/appInfo.ts`: the app version from `app.json`, kept as evidence.
  * `application/`: `useConsentText()`, `createConsent()` and `useCreateConsent()`, which keeps one key per provider and text.
  * `index.ts`: exports `useConsentText`, `createConsent`, `scopesOf` and the types.
* **Tests:** 39, covering:
  * the domain rules;
  * the adapter's request, headers and problem codes;
  * the hooks: one key for retries, a new key for another provider, the error kinds, and reloading the text when it changed.

## Result

* Tests: `make lint` and `make test` pass on the whole stack (776 mobile tests). This branch alone: 39 module tests, ESLint, `tsc` and Prettier pass.
* Pull request: not opened yet.
* Nothing is on a screen in this part. The cards and the button are in the branch above.

## Decisions and problems

* **The app version comes from `app.json`,** because the app has no shared source for it. The PR asks M0 whether to add one to `@shared`.
* **One `Idempotency-Key` per provider and text,** so a double tap or a retry after a lost answer does not leave a second pending consent.
* **The purpose and term are not hardcoded.** They come from `GET /consent-texts/current`, so the line shown and the request always match what the API checks.
* **A Jest run did not exit at first.** React Query's 5 minute cache timer for mutations kept it open. The test client now uses `gcTime: Infinity` for mutations too, as M1's tests do for queries.

## Next step

`feature/connect-bank-consent-ui`: the consent cards, the checkbox and the "Ir al portal" button, stacked on this branch.
