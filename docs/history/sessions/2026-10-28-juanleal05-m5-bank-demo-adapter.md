---
date: 2026-10-28
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23, SCRUM-44, SCRUM-45]
branch: feature/bank-demo-adapter
tool: Claude Code
pr: none
status: done
---

# Banco Demo adapter and egress client (M5 step 1, part 2 of 3)

## Instruction

Continue M5 step 1 after the egress settings PR. Key sentence: "proceed so that we can finish step 1 of the order you propose."

## What was done

* `internal/bank/egress`: the HTTP client every bank adapter uses. It trusts only `EGRESS_CA_FILE`, needs TLS 1.2 or newer, never follows a redirect (a token can never be sent elsewhere), and times out after 15 s. `BaseURL` builds `<EGRESS_URL>/<route>` and fails when the egress is not configured.
* `internal/bank/adapters/bankdemo`: `ports.Provider` against `contracts/bank-simulator.yaml`, for two providers on one simulator:
  * Banco Demo keeps savings, credit card and CDT; Billetera Demo keeps the wallet. This matches the onboarding design (Banco Demo 3.200.000, Billetera Demo 4.600.000).
  * Accounts map to the shared shape:
    * centavos, with decimal strings converted exactly, never with floats;
    * only the last 4 digits;
    * a card's debt as a positive amount owed (the simulator reports it as negative);
    * the card's next payment date computed in Bogotá time;
    * CDT rate and dates;
    * unknown product types are skipped.
  * Movements map with booked or pending status, merchant and bank category. Pages follow the cursor, 200 a page.
  * OAuth:
    * PAR with PKCE S256, `state`, `nonce`, Fynk's consent id and a `private_key_jwt` assertion; only `client_id` and `request_uri` travel in the authorize URL;
    * code exchange and refresh return the bank's `consent_id`;
    * revocation uses a client credentials token, and a consent the bank no longer knows counts as done.
  * Bank answers become stable errors (`consent_revoked`, `invalid_grant`, `rate_limited` with `Retry-After`, `provider_unavailable`) and never keep the bank's text.
* Tests against a fake server that follows the simulator's contract, plus TLS tests with a second CA.

## Result

* Tests: `make lint` and `make test` pass.
* Pull request: opened right after this log, stacked on #52 and #53.
* Size: about 1,120 lines, about 490 of them tests.

## Decisions and problems

* The adapter is not wired into the endpoints yet: they answer `501` until M5 step 2 adds authorizations and links.
* Reading the simulator found more points for M16 besides the three in #52:
  * there is no browser authorization page yet, so the full link flow cannot run end to end;
  * consent ids contain `-`, so the refresh grant reads the wrong consent;
  * the public listener (8443, published as `localhost:8082`) serves the same API and OAuth routes without mTLS;
  * the card debt is negative in `fixtures/demo-user.json` while the shared contract says it is positive.

  They go to the M16 owner in part 3, where the tests against the simulator show them.
* A test first trusted a second server by mistake, because every `httptest` TLS server shares one certificate. The test now gives that server its own certificate.

## Next step

Part 3: contract tests against the running simulator through Caddy, and the mTLS test with and without the client certificate.
