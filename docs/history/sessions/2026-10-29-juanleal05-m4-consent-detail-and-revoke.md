---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M4
jira: [SCRUM-22, SCRUM-21]
branch: feature/consent-detail-and-revoke
tool: Claude Code
pr: none
status: done
---

# Consent detail and revoking from the app (M4 step 4, part 3)

## Instruction

Same session as `2026-10-29-juanleal05-m4-consents-list-data.md`. Key sentence: "For M4 step 4 do the best you can to allow later the full integration with the other modules that would need to be connected." The developer also asked for a summary of the session, the state of M4 and M5, and the plan.

## What was done

* **`ui/ConsentDetailScreen.tsx`**, a new screen built from the cards of `ConectarBanco.html` (needs design review):
  * the entity and its status chip;
  * the same scope list with the purpose and the term;
  * the dates, the text version, and whether the entity confirmed a revocation;
  * the red "Revocar acceso" (the shared danger button), only for a live consent.
* **`ui/useRevokeFlow.ts`**, the revoke flow, in this order:
  1. a confirmation ("¿Revocar el acceso de <Entidad>?");
  2. the installed identity check, if any;
  3. the revocation;
  4. "Fynk ya no recibirá datos de <Entidad>.";
  5. errors: already ended, offline, other.
* **`ui/ConnectedAccountsSection.tsx`:** "Cuentas conectadas" with "Revocar", as in `CfgPrivacidad.html`, ready for M13's Privacidad y datos.
* **`index.ts`:** `consents.Detail` opens the real screen; `ConsentDetailScreen` and `ConnectedAccountsSection` are exported.
* **Tests:** 14, covering:
  * the detail facts;
  * no revoke on an ended consent;
  * confirm, then revoke, then the message, the new status and the listener notice;
  * cancel;
  * the identity check refusing and passing;
  * the three errors;
  * the M13 section;
  * both themes.

## Result

* Tests: `make lint` and `make test` pass on the whole stack.
* Pull request: not opened yet.
* Not checked on a phone.

## Decisions and problems

* **"Biometrics or password" is not enforced yet.** M2's biometrics and an M1 password check do not exist, and Daniel could not be asked. The confirmation dialog runs, and `installIdentityCheck` lets M1 or M2 add the real check without changing M4. The pull request says so.
* **The phone does not delete the link's bank token yet.** There is no vault. `onConsentRevoked` already tells subscribers; M5 subscribes in its step 3.

## Next step

The developer reviews the stack. Then M5 step 2 (backend link with PAR and PKCE), while M2's vault and M16's authorization page arrive.
