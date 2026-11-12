---
date: 2026-11-12
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-65]
branch: fix/banco-demo-portal-login
tool: Claude Code
pr: none
status: done
---

# Banco Demo portal shows the logged in user instead of the demo customer

## Instruction

The developer reported that money actions and investments in the simulator always opened as the guest account: "when trying to do investments or movements from the simulator it just opens the simulator with the example email for the guest account and I need it to work with the user account that was signed in".

## What was done

* Cause: `internal/portal/portal.go` had no login. Every page and action took the customer from `?user=` and otherwise used the seeded `cliente.demo@bancodemo.local`. "+ Invertir" opens `/portal/actions` with no user, so it always landed on the demo customer.
* `internal/authorize/authorize.go`: the realm login and session of the authorization page now also serve the portal. New `PortalSession` returns the session's customer and CSRF token, or starts the login and comes back to the page that was asked for (only `/portal` paths, see `portalReturn`). The session cookie path moved from `/oauth` to `/` so the portal receives it. New `Enabled`.
* `internal/portal/portal.go`: pages and actions go through `page` and `action` wrappers that identify the visitor. Actions check the CSRF token. `?user=` and the demo fallback are used only when the realm login is not configured. Revoking a consent checks it belongs to the visitor. The consents page now passes the customer to the header.
* `internal/portal/templates.go`: every form carries the hidden `csrf` field.
* `cmd/bank-simulator/server.go`: gives the portal the authorization handler when the login is configured.
* Tests: `cmd/bank-simulator/portal_login_test.go` (login and return to the page, session cookie path, the Fynk `sub` is shown, `?user=` ignored, post without session, CSRF required, the payment lands on the logged in customer and not on the demo one, another customer's consent cannot be revoked, fallback without the realm) and `internal/authorize/portal_return_test.go` (the login return never leaves the portal).
* `docs/modules/M16b-simulated-banks.md`: the note about `?user=` now describes the login.

## Result

* Tests: `go vet` clean. `cmd/bank-simulator`, `internal/authorize`, `internal/portal`, `internal/api`, `internal/domain`, `internal/oidc` and `internal/store` pass. The `internal/oauth` test binary could not run on this Windows machine because App Control blocked the executable; that package was not changed and CI runs it. golangci-lint is not installed locally.
* Pull request: not opened yet.
* Works: opening the portal (from "+ Invertir" or directly) asks for the banco-demo login; with "Ingresar con Fynk" the portal shows and changes the Fynk user's simulated products.

## Decisions and problems

* Reused the authorization page's OIDC client, callback and session instead of a second login, because the `bank-portal` client and its redirect URI already exist in the realm.
* `services/bank-simulator/` is owned by `@juancontrerasp` in CODEOWNERS, so the pull request needs that approval.
* Not done: the `demo-admin` role check of `/portal/admin` from the M16 spec, and a "Cerrar sesión" link. The app could send `kc_idp_hint=fynk` so the realm skips its own login form; that touches M15 and the realm, so it is left for the owners.

## Follow-up in the same session: a CDT opened in the portal does not reach the app

The developer then asked: "check why when for example generating a CDT with my account is not appering in the app check if the error is also happening with the other 3 options".

* Cause in the simulator: `OpenCDT` in `internal/store/store.go` created the CDT account with no `ProviderID`. `GET /accounts` returns only the accounts of the consent's entity, so the new CDT was filtered out for every link. The CDT now gets the provider of the account that paid for it.
* The other three actions (Registrar un pago, Transferir, Pagar tarjeta) did reach `GET /transactions`; their movements only had an empty `providerId`, which the Fynk backend does not read. Every movement the portal books now carries its account's provider id.
* Before the portal login fix above, none of the four actions could reach the app, because they ran on the demo customer.
* Tests: `internal/store/portal_actions_test.go` runs the four actions through `GetAccounts` and `GetTransactions` of a consent, including a transfer between Banco Demo and Cooperativa Demo and a CDT paid from Cooperativa Demo. They failed before the fix and pass after it.
* Found and not fixed (other modules, frozen contract): the app accepts only `banco-demo`, `billetera-demo` and `bancolombia` as providers (`ProviderId` in `apps/mobile/src/shared/domain/types.ts` and `00-shared-contracts.md`, `PROVIDERS` in `modules/bank/domain/syncMapping.ts`, the `CHECK` on `provider` in `modules/accounts/adapters/vault/migrations.ts`). A link to Banco Digital Demo or Cooperativa Demo can be made, but every sync of it fails with `Unknown provider`, so nothing from those two entities shows. This needs a shared contract change reviewed by M0, M5 and M6.

## Next step

Try it in docker compose: log in to Fynk, tap "+ Invertir", choose "Ingresar con Fynk", and check the portal shows the user's accounts. Then push and open the pull request.
