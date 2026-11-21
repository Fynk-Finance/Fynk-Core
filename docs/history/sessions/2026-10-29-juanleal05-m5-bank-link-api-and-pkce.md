---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23, SCRUM-44]
branch: feature/bank-link-api-and-pkce
tool: Claude Code
pr: none
status: done
---

# The bank API adapter, PKCE and the callback check on the phone

## Instruction

Third part of step B ("Yes, push and do B"): the phone's adapter for the bank endpoints, with tokens only in bodies and a new `X-Request-Nonce` on every call, plus pure helpers for the verifier, the S256 challenge and the state.

## What was done

* `domain/pkce.ts`:
  * `base64Url`;
  * `challengeOf` (SHA-256 from `@noble/hashes`, as M2's domain already uses);
  * `createPkce(random)`: a 43 character verifier from 32 random bytes, and a state from 16;
  * `newNonce(random)`: 32 characters.
  * The random bytes are injected, so the domain stays pure.
* `domain/callback.ts`: `BANK_CALLBACK_URL` (`fynk://bank/callback`) and `readCallback(url, expectedState)`. It returns:
  * `code`;
  * `denied` (`access_denied`);
  * `failed` (other bank errors);
  * `state_mismatch`;
  * `invalid` (another URL, or no code or error).
  * The state is checked before the code or the error is trusted. It parses the query by hand, because React Native's `URL` has no `searchParams`.
* `adapters/bankApi.ts` with the `BankApiPort` port: `authorize`, `exchange`, `accounts`, `transactions` (cursor) and `refresh`.
* Tests:
  * PKCE against the RFC 7636 Appendix B vector, plus unique values and lengths;
  * 6 callback cases;
  * the adapter on a fake fetch: request bodies, no token in any URL, a new nonce per call, and `consent_revoked` coming through as `ApiError.code`.

## Result

* Tests: bank 10 suites, 52 tests. Typecheck and ESLint pass.
* Pull request: not opened yet. About 475 lines, more than half tests.
* Nothing calls the adapter yet. Step B4 wires it to Conectar banco.

## Decisions and problems

* **Contract mismatch in our own module:** `contracts/modules/bank.yaml` says the nonce is 16 to 64 characters, and the backend (`service/queries.go`) accepts 16 to 128. The phone sends 32, which fits both. To fix later in a contract PR of ours: change `maxLength` to 128, or the backend to 64.
* **A mistake in the first test,** caught by the test itself: the RFC verifier string was typed wrong. Node's `crypto` confirmed that the code and the RFC's octets and challenge agree, and the test was fixed.
* **The verifier and state stay in memory** during the browser handoff (B4), never in the vault or a log.

## Next step

`feature/mobile-connect-bank-flow`.
