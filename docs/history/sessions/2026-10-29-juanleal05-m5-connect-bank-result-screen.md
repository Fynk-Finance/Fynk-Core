---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23]
branch: feature/connect-bank-result-screen
tool: Claude Code
pr: none
status: partial
---

# Show the link result in Conectar banco

## Instruction

Last part of step B ("Yes, push and do B"): after "Ir al portal", show the accounts the bank returned or a clear message, the connection state and clear errors. The developer then asked to split this layer to fit the guideline: "you can split layer 5 so that it falls inside the guideline". `BankLinkList` and `ConnectBankButton` moved to `feature/bank-account-rows`, the layer below.

## What was done

* `ui/ConnectBankScreen.tsx`: the placeholder alert ("Pronto podrás continuar…") is gone. The screen takes the link flow as `link` and moves through three phases:
  * **form;**
  * **linking:** "Conectando con <Entidad>", with the bottom bar hidden;
  * **result.**
  * A closed portal goes back to the form.
* `ui/LinkResult.tsx`:
  * "<Entidad> conectada" with the accounts, or "no tiene cuentas para compartir", or "Traeremos tus cuentas en la próxima actualización";
  * a message and "Intentar de nuevo" for a denial and for each failure reason;
  * "Listo" goes back.
* The accounts are drawn with `BankLinkList` from the layer below.
* `index.ts`: wires the real `linkBank` (API with nonces, system browser, vault, `expo-crypto`).
* Copy in `strings.es-CO.ts`.
* Tests:
  * the screen with the consent and the linked consent id;
  * linking, then the accounts, then Listo;
  * no accounts, and accounts later;
  * a closed portal, a denial with retry, and 5 failure messages;
  * both themes (the existing theme tests of the screen).

## Result

* Tests: full mobile suite 120 suites, 1,419 tests. Typecheck and ESLint pass.
* Pull request: not opened yet. About 340 changed lines after the split, about 120 of them tests.
* **Status partial:** nothing was checked on a phone or simulator, and no screenshot was put next to the design PNGs. The colors come from `useTheme()`, and the light and dark tests check them.

## Decisions and problems

* **New screens, need design review:** the linking state and the result view aren't in the design. They're built from `EmptyState`, `ErrorState`, `IconTile` and OnbCuentas.html's rows.
* **Retry creates a new consent.** "Intentar de nuevo" goes back to the form, and "Ir al portal" records a new pending consent. The old pending one stays pending in the backend, since M4 has no job that ends abandoned pending consents. Something to decide for M4.
* **The balance shown is `balanceMinor` for every kind.** For a credit card that's the amount owed, which the design doesn't cover here. M6's screens decide how cards look.
* **Nobody opens Conectar banco from the app yet.** `ConnectBankButton` (layer below) is ready for M3 and M6 (Sofia).
* **The split replayed this layer onto the new one.** Git merged the shared strings twice; the duplicate was removed, and the app code is identical to before the split.

## Next step

Check the screens on a phone or simulator against `docs/design/screens/{light,dark}/` (OnbCuentas, ConectarBanco). Then M5 step 4, the sync engine.
