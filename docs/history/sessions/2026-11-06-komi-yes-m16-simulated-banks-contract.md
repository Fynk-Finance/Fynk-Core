---
date: 2026-11-06
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-73, SCRUM-74]
branch: feature/simulated-banks-contract
tool: Claude Code
pr: none
status: done
---

# Simulator contract for simulated banks

## Instruction

Step 2 of the approved simulated banks plan: extend `contracts/bank-simulator.yaml` only, with the provisioning endpoint, the `entity` parameter in the PAR and the authorization page.

## What was done

- `contracts/bank-simulator.yaml`: server URLs changed to the host roots, and `info.description` says which paths live on which listener.
- Added tags `oauth` and `demo`.
- Documented `POST /oauth/par` (with the new required `entity`), `POST /oauth/token` (three grants), `GET /oauth/authorize` and `POST /demo/v1/customers`.
- Added schemas `ProviderId`, `SimulatedEntity`, `OAuthError` and `TokenResponse`, OAuth error responses, and the `ClientCredentials` security scheme with scope `demo:provision`.
- Added a required `providerId` to `Account` and `Transaction`, with a note that the API returns only the accounts of the consent's entity and customer.

## Result

- The contract passes `redocly lint`.
- Pull request: not opened yet.
- No code changed. The simulator does not implement these changes yet.

## Decisions and problems

- `GET /bank/simulated-entities` in `contracts/modules/bank.yaml` moved to step 6, because its generated strict server would not compile without its handler.
- The OAuth endpoints use OAuth JSON errors, not problem+json, as the existing code does.

## Next step

Step 3: the generator for entities, random balances and backwards history.
