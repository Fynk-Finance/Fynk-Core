---
date: 2026-10-28
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23, SCRUM-24, SCRUM-45]
branch: feature/bank-demo-simulator-tests
tool: Claude Code
pr: none
status: done
---

# Banco Demo adapter against the running simulator (M5 step 1, part 3 of 3)

## Instruction

Last part of M5 step 1. Key sentence: "proceed so that we can finish step 1 of the order you propose."

## What was done

* `adapters/bankdemo/simulator_integration_test.go` (`-tags integration`), against the simulator in docker compose through the Caddy egress:
  * the public CDT catalog;
  * the seeded demo user: Banco Demo 3 accounts (Ahorros 3.200.000, card owed 500.000, CDT 2.000.000), Billetera Demo 4.600.000; the customer's email and the masked number that the simulator sends never leave the adapter;
  * 12 months of movements paged by cursor, no duplicates, 12 salaries (HU-010);
  * a PAR with a real PS256 `private_key_jwt` assertion (HU-030);
  * HU-031: the mTLS listener refuses a client without Fynk's certificate and accepts it with one;
  * HU-008 and Gate C: after revoking at the bank, the next query is `consent_revoked`.
* The file header has the two commands: inside the Docker network (all 6 tests) and from the host (the mTLS listener is not published, as in AWS, so that test skips). The revocation test needs `BANKDEMO_ALLOW_REVOKE=1`, because it revokes the demo consent until the simulator restarts.

## Result

* Inside the Docker network: 6 of 6 pass. From the host: 4 pass, 2 skip as designed. `make lint` and `make test` pass.
* Banco Demo's log records the client certificate serial on every call through Caddy (connection evidence for HU-031).
* Pull request: opened right after this log, stacked on the adapter PR.

## Decisions and problems

* The simulator has no browser authorization page yet, so the tests read the demo user with Banco Demo's static `dev-token`. The full link (code exchange) is tested in M5 step 2, once M16 adds that page.
* Checked by hand for the M16 owner, all on the public listener `localhost:8082`, with no mTLS:
  * `GET /open-finance/v1/accounts` with any random token answers `200` with the demo user's data;
  * `POST /oauth/par` with an unsigned RS256 assertion answers `201`;
  * `GET /oauth/authorize` answers `404`.
* CI's `make test-integration` (M0's Makefile) does not run these tests; they need the stack up.
* My first command from the host used a relative CA path. `go test` runs inside the package folder, so the header now asks for an absolute path.

## Next step

M4 step 2, revocation with the provider, now that `ports.Revoker` and the adapter's `RevokeConsent` exist.
