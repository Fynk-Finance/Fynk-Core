---
date: 2026-11-04
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-55]
branch: feature/recurring-proposals-screen
tool: Claude Code
pr: none
status: done
---

# "Detectamos pagos recurrentes" (SCRUM-55)

## Instruction

Karol said "si" to the screen of detected payments now that detection (#251) is in `develop`. The M9 prompt says: "Detectamos pagos recurrentes (new, shown after a sync with new proposals): list with confirm and dismiss per item".

## What was done

* **`ui/DetectedScreen.tsx`:**
  * Route `recurring.Detected`, path `billetera/detectados`, default push.
  * One card per proposal: name, "Suscripción" or "Gasto fijo", periodicity, "Próximo cobro 7 nov" and the amount, with "Descartar" and "Confirmar".
  * Empty state, error message, and a reload when the proposals change.
* **`ui/DetectedBanner.tsx` in Billetera:** "Detectamos 2 pagos recurrentes · Revisar" above "Gastos recurrentes" while proposals wait. It opens the screen and goes away when none is left.
* **New Billetera dependencies:** `pendingProposals` and `detectedRoute`, plus the `usePendingProposals` hook.
* **Inbox notice:** after a sync with new proposals, M12's `notify` gets "Pagos recurrentes · Encontramos 2 pagos que se repiten. Revísalos en Billetera.", with a deep link to `fynk://billetera/detectados`.
* **Detection `onChange`:** now calls `service.notifyChanged()`, so Billetera and the screen reload.
* **Tests:** `ui/DetectedScreen.test.tsx` (5):
  * the cards with kind, amount and next charge, and nothing added without the person;
  * "Confirmar" adds the detected item;
  * "Descartar" hides it and it is not proposed again;
  * the empty state in dark theme;
  * the banner opens the screen and goes away.

## Result

* 198 suites and 2396 tests pass. ESLint, tsc and Prettier are clean.

## Decisions and problems

* **A banner and a notice, not a screen that opens by itself.** A module cannot navigate on its own outside a screen, and opening a screen in the middle of something the person is doing would be intrusive. The person sees the banner in Billetera and the notice in Notificaciones.
* **The notice uses kind `sync_result`.** `NotificationKind` (a shared file of M0) has no kind for detection. Adding one needs a pull request from M0.
* **No edit before confirming.** Name and amount are changed afterwards with "Editar". The service already accepts edits if the design adds them.
* **A possible conflict in strings.** The `detected` strings sit at the top of `strings.es-CO.ts`, so they do not clash with `feature/subscription-account-and-charges`, which adds lines at the end.

## Next step

SCRUM-61: price increase alerts and the red "Subió" chip.
