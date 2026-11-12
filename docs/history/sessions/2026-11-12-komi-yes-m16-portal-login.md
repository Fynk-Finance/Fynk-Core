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

The developer then asked why a CDT opened in the portal did not appear in the app. That fix went to its own branch and pull request, `fix/banco-demo-cdt-provider`, to keep this one small. See `2026-11-12-komi-yes-m16-cdt-provider.md`.

## Follow-up: "is still not working"

* Checked the running stack: the simulator image had the login and CDT fixes, and `GET /portal/actions` redirected to the banco-demo login. But every sync since the API started had stopped at `POST /v1/bank/tokens/refresh` with 409 (39 calls, 3 links), and no consent or link call had been made. Restarting the stack, and rebuilding the simulator, cleared the simulator's in-memory tokens and consents. So the links in the app were dead, and nothing done in the portal could reach it.
* Found and not fixed (M5): the app ends a link only on `consent_revoked` or `link_not_found`, and nothing listens for `sync.failed`. So a link the bank no longer knows (`invalid_grant`) stays "active" and fails silently on every sync.
* The right test flow: rebuild the simulator once, remove and reconnect the simulated banks in the app with "Ingresar con Fynk", then use the portal (also with "Ingresar con Fynk"), wait 60 s and pull to refresh. Do not restart the simulator in between.

## Next step

Try it in docker compose: reconnect Banco Demo in the app, tap "+ Invertir", choose "Ingresar con Fynk", and check the portal shows the user's accounts.
