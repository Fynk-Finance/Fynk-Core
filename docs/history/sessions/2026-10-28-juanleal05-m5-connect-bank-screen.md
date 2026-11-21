---
date: 2026-10-28
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23, SCRUM-20]
branch: feature/connect-bank-screen
tool: Claude Code
pr: none
status: partial
---

# Conectar banco screen hosting the consent of M4 (M5)

## Instruction

Same session as `2026-10-28-juanleal05-m5-bank-providers-selector.md`. Key sentence: "Continue to push and open PRs and then let's keep going with the workflow." This branch puts M4's consent part on a real screen, the last piece of M4 step 3.

## What was done

* **`ui/ConnectBankHeader.tsx`:** the blue header of `ConectarBanco.html`, with its three squares, the shine, the back button, "Conecta tu banco" and its subtitle.
* **`ui/ConnectBankScreen.tsx`:**
  * the header, then the entity selector and M4's `ConsentScopeCard` in the scroll;
  * M4's `ConsentAcceptance` in the bottom bar;
  * skeletons while loading;
  * an error with a retry when the entities or the consent text fail;
  * an empty state when no entity is listed.
* **The flow stops once the consent is recorded.** An alert says "Autorización registrada · Pronto podrás continuar en el portal de <Entidad>." M5 step 3 replaces it with the portal.
* **`index.ts`:** `bank.Connect` (`bank/conectar`) now opens the real screen, and `ConnectBankScreen` is exported.
* **Tests:** 9, with the API faked at `fetch` so M4's real exports run:
  * header, "Simulado", the cards and the disabled button;
  * choosing another entity moves the consent part;
  * the request carries the chosen entity and the text hash;
  * the errors, the empty state and "Volver";
  * both themes.

## Result

* Tests: `make lint` and `make test` pass on the whole stack.
* Pull request: not opened yet.
* **Not checked on a phone or next to `ConectarBanco.png`:** no simulator build exists on this machine, and making one takes a full Expo prebuild and native build. Status is `partial` for that reason.

## Decisions and problems

* **The design's back button is 48 px.** The shared `BackButton` (44 px) is used, as on Mi cuenta.
* **"¿No encuentras tu entidad? Agrégala manualmente" is left out.** Its target, a manual cash account (M6), does not exist yet.
* **"Política de privacidad" stays plain text** until M13's policy screen exists.
* **`expo-crypto`'s `randomUUID` returns nothing under Jest.** The first run sent the consent without an `Idempotency-Key`. The screen test now mocks `randomUUID`; in the app it works, as M1's device registration shows.
* **New copy, needs design review:** the loading, error and empty texts and the "Autorización registrada" alert.

## Next step

Check the screen on a simulator next to `ConectarBanco.png` in light and dark. Then M4 step 4, after the developer decides how to confirm identity before revoking and where the Consentimientos entry goes.
