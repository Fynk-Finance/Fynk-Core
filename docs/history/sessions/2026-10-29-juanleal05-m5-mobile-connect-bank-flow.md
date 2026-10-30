---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23, SCRUM-44]
branch: feature/mobile-connect-bank-flow
tool: Claude Code
pr: none
status: done
---

# The link flow on the phone, through the system browser

## Instruction

Fourth part of step B ("Yes, push and do B"): after "Ir al portal", create the authorization, open the bank in the system browser, check `state`, exchange the code, save the tokens in the vault, then read the accounts, with clear errors for every case.

## What was done

* `application/linkBank.ts`: `linkBank(deps, { provider, consentId })`:
  * creates PKCE and the state, then `POST /bank/authorizations`;
  * opens the `authorizeUrl` as is, and checks the return with `readCallback`;
  * exchanges the code with the verifier and saves the link and tokens in one vault transaction, with the expiry from `expiresIn` and the clock;
  * then `POST /bank/accounts/query`.
* Outcomes:
  * `linked` (with the accounts, an empty list, or `null` if only the accounts query failed);
  * `cancelled` (the browser was closed);
  * `denied`;
  * `failed` with a stable reason: `state_mismatch`, `bank_error`, `expired` (`authorization_not_found`), `already_linked`, `unavailable`, `offline`, `device_required` or `unknown`.
* `adapters/systemBrowser.ts`: `openAuthSessionAsync` with `preferEphemeralSession`, and `secureRandom` from `expo-crypto`.
* Tests:
  * 13 for the flow on a real SQLite vault: the verifier sent at the exchange matches the challenge sent first; a wrong state exchanges nothing; nothing is stored when any step fails; the link stays if only the accounts query fails; every error code maps to its reason;
  * 6 for the browser adapter.

## Result

* Tests: bank 12 suites, 71 tests. Typecheck and ESLint pass.
* Pull request: not opened yet. About 340 lines.
* Not yet on screen: the next layer wires it to Conectar banco and shows the result.

## Decisions and problems

* **The screen comes in its own layer,** so this PR stays near 340 lines and the next one is only UI.
* **Ephemeral browser session:** the bank's cookies aren't kept after the link (iOS). The person logs in at the bank every time they link. That's the safer default for a bank login.
* **The accounts shown right after linking aren't stored.** M6's `upsertFromSync` isn't merged, and storing accounts is the sync's job (step 4, first sync of 12 months).
* **Open risk:** if the exchange works but the vault write fails (for example, the vault locked at that moment), the backend has an active link the phone has no token for. The person sees `unknown` and can revoke the consent and link again. A retry isn't possible: the code is single-use.
* **Only a phone can check:** that Android's Custom Tab return reaches `openAuthSessionAsync`, and that React Navigation ignores `fynk://bank/callback` (no screen has that path).
* **End to end against Banco Demo isn't possible yet:** the simulator has no authorization page (M16, Juan Pablo).

## Next step

`feature/connect-bank-result-screen`: the screen states, `ConnectBankButton` and `BankLinkList`.
