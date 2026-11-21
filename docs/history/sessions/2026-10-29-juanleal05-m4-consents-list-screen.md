---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M4
jira: [SCRUM-21]
branch: feature/consents-list-screen
tool: Claude Code
pr: none
status: done
---

# Consentimientos list (M4 step 4, part 2)

## Instruction

Same session as `2026-10-29-juanleal05-m4-consents-list-data.md`. Key sentence: "For M4 step 4 do the best you can to allow later the full integration with the other modules that would need to be connected."

## What was done

* **`ui/ConsentsListScreen.tsx`**, a new screen built from "Cuentas conectadas" of `CfgPrivacidad.html` (needs design review):
  * one row per consent with the entity, the status chip (Activo, Pendiente, Vencido, Revocado, Fallido), "Otorgado el" or "Solicitado el", and "Vence el", "Venció el" or "Revocado el";
  * read again on every visit and with pull to refresh;
  * skeletons, an error with retry, and an empty state with "Conectar banco".
* **`ui/ConsentsPage.tsx`:** the header of the settings screens (56 px tile, back button, title and subtitle) and the section labels, as M1 built them for Seguridad.
* **`ui/ConsentRow.tsx`:** the row, the status chip and the date lines.
* **`index.ts`:**
  * `consents.List` (`consentimientos`) opens the real screen;
  * `consents.Detail` is a placeholder until part 3;
  * `consentsMiCuentaRow` is exported, a row with the same shape as M1's `miCuentaRows.ts`, so M1 can add the entry in one line.
* **Tests:** 9 for the screen: statuses and dates in Bogotá time, an expired consent shown at once, pull to refresh, opening the detail, empty, error, back, both themes.

## Result

* Tests: `make lint` and `make test` pass on the whole stack.
* Pull request: not opened yet.
* Not checked on a phone.

## Decisions and problems

* **The entry point is not added anywhere.** M1's `miCuentaRows.ts` belongs to Daniel and Privacidad y datos to M13. Both get ready pieces, and the pull request asks them.
* **Every row shows a bank icon** instead of the design's initials, as in Conectar banco.
* **A Jest run did not exit** while the entity names query kept React Query's 5 minute cache timer. The test client now uses `gcTime: Infinity`.

## Next step

`feature/consent-detail-and-revoke`: the detail and revoking from the app.
