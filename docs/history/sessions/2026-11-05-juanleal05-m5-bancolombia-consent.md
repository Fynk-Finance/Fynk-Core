---
date: 2026-11-05
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23, SCRUM-44]
branch: feature/bancolombia-adapter-consent
tool: Claude Code
pr: none
status: done
---

# Bancolombia adapter: consent and PAR

## Instruction

Juan Carlos asked to finish M4 and M5 and to build the Bancolombia part with the API Market access he got: "the idea es to use the sandbox"; "create that part and tell what to do so that we can link that." For the customer document that Bancolombia's consent API requires, he chose to send only the sandbox's fictional customer from the settings.

## What was done

* `PushAuthorization`: client credentials token, then the account access consent with the permissions the person accepted (`ReadAccountsBasic`, `ReadBalances`, `ReadTransactionsDetail`) and the 12-month term, then the PAR with `openid accounts <ConsentId>`, PKCE S256 and `private_key_jwt`. The authorize URL carries only `client_id` and `request_uri`; the bank's consent id goes back in `PARResult`.
* Resource calls send the FAPI interaction and financial ids. 401, 403 and 404 NAUT map to `invalid_grant` and `consent_revoked`.
* Tests: the full request order and every field, and the error mapping.

## Result

* Tests pass; golangci-lint 0 issues. Pull request: not opened yet.

## Decisions and problems

* The consent's `AccountOwner` comes only from the sandbox settings. Fynk never asks a person for a document.

## Next step

Accounts, balances and movements.
