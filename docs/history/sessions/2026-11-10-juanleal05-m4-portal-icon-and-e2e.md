---
date: 2026-11-10
developer: Juan Carlos Leal
github: JuanLeal05
module: M4
jira: [SCRUM-20, SCRUM-21, SCRUM-22, SCRUM-23, SCRUM-24, SCRUM-25, SCRUM-44, SCRUM-45]
branch: fix/consents-portal-button-icon
tool: Claude Code
pr: "#362"
status: done
---

# Draw the external link icon on "Ir al portal de…" and test M4/M5 end to end on the real stack

## Instruction

After the team merged the review follow-ups for M4 and M5, Juan Carlos asked to finish what was left on his side and to test everything: "let's do what's left on our side, including all the necessary changes and let's test that everything's working well with all". He also asked for a recommendation on Bancolombia, whose support has not answered and the time window is short.

## What was done

* `apps/mobile/src/modules/consents/ui/ConsentAcceptance.tsx`: the "Ir al portal de <Entidad>" button uses M0's new `iconAfter="externalLink"`, as in `ConectarBanco.html`.
* `consentUi.test.tsx`: a test that the design's icon path comes after the label. It failed before the change.
* Checked `develop` against the instructions sent to the team on 7 Nov: Banco Demo's authorization page and token scoping (stack #314), `consent.failed` and Privacidad y datos (#326), the Caddy routes to Bancolombia's sandbox, the compose bank settings and keys, the executable `postgres-init.sh`, the Button icon, pull to refresh on the Dashboard and in Billetera, "Eliminar cuenta" in Detalle de cuenta, and the account name of movements after a revocation are all in.
* Ran an end-to-end test on the local stack (`make dev`, no local workaround): the API in Docker with its bank settings from compose, Banco Demo's real authorization page with the banco-demo realm login, Caddy with mTLS. A script walked the bank login and consent page like a browser.

## Result

* Tests: M4 and M5 mobile tests 252 passed; `tsc` and ESLint clean.
* End to end: 14 of 14 checks passed. Consent page at the bank names entity, data, receiver, purpose and term; return to `fynk://bank/callback` with the same state; tokens to the phone; consent active; accounts with only the last 4 digits; 252 movements over 12 months; replay rejected; refresh rotates the token; cancelling at the bank returns `access_denied`; a second entity only asks for the consent; revoking in Fynk and revoking at the bank's portal both make the next read fail with `consent_revoked`; audit events written.
* Pull request: #362.

## Decisions and problems

* An older local `.env` lacks the two variables #318 added (`BANCO_DEMO_BROKER_SECRET`, `BANK_PORTAL_CLIENT_SECRET`), so `make dev` stops until they are copied from `.env.example`. The error message says so; worth a line in `docs/local-dev.md` (M0).
* Staging still cannot deploy: the role ARN has no account id (`AWS_ACCOUNT_ID` secret, M14). Gate B and C items for M4 and M5 wait on it.
* The app was not run on an emulator this time, to save disk space; the mobile flow is covered by the module tests and by the emulator run of 6 Nov.

## Next step

Open the pull request, then check Gate B and C items on staging once it deploys.
