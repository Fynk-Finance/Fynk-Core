---
date: 2026-11-20
developer: Daniel Palacios
github: Komi-yes
module: M16b
jira: [SCRUM-74]
branch: fix/bank-login-bound-to-fynk-user
tool: Claude Code
pr: "#441"
status: partial
---

# Sign the previous person out of the bank realms, and reset the app cache on lock

## Instruction

On the emulator, a second account could not link its banks. The bank showed "Vuelva a autenticar para continuar" with only a password field, and the second account's password failed. The second account's onboarding also showed the first account's accounts and balances. Daniel asked to fix "both fixes if posible in the same branch so I can test them both at the same time".

## What was done

* Cause of the login problem: the first session's `prompt=login` does not let someone else log in. Keycloak re-authenticates the person already in the shared Android Custom Tab. That is the first account's `banco-demo` user, created by "Ingresar con Fynk" and without a password, so no password works (Keycloak `LOGIN_ERROR invalid_user_credentials` in `banco-demo`). The tab also kept that person's `fynk` realm session from the broker hop.
* Simulator (`internal/authorize`, `internal/oidc`):
  * `prompt=login` and `AuthURLWithPrompt` are removed.
  * Sessions keep the realm ID token.
  * When the session, or the login that just came back, belongs to someone other than the PAR's `fynk_sub` (and not to `cliente.demo`), the simulator shows a "Cambio de cuenta" page. The page posts the realm logout with that person's `id_token_hint` and returns to the authorization page. The ID token never goes in a URL.
  * A second wrong person for the same request gets the 403 page, so it never loops.
  * `oidc.LogoutURL()`.
* Realms:
  * `banco-demo-realm.json`: `bank-portal` gets `post.logout.redirect.uris: +`. The `fynk` provider gets `logoutUrl`, `sendIdTokenOnLogout` and `sendClientIdOnLogout`, so a `banco-demo` logout also ends the `fynk` session.
  * `fynk-realm.json`: `banco-demo-broker` gets `post.logout.redirect.uris` for `…/broker/fynk/endpoint/logout_response`.
* Cause of the leaked accounts: the app's single QueryClient was never cleared on sign out. `['accounts']` has `staleTime: Infinity` and is refreshed only by a mounted screen, so the next account's onboarding read the first account's accounts from memory. The vault files were already separate (one per account).
* App (`app/startup.ts`): `bindQueryClient` resets every query on `vault.locked`. That event fires after the vault is closed, on sign out, device removal and the idle lock.
* Tests:
  * Simulator `authorize_binding_test.go`, rewritten:
    * Another person's session is signed out with their own token, and the form returns to the request.
    * After the logout, the right user reaches consent.
    * A realm SSO of another person is signed out at the callback.
    * A second wrong person gets a 403.
    * The demo customer is accepted for that request only.
    * Matching or no `fynk_sub` still shows consent.
    * The ID token is never logged.
    * No realm login sends `prompt`.
  * `oidc_test.go`: `LogoutURL`.
  * API `bancodemo_realm_test.go`: the logout settings of both realms.
  * Mobile `startup.test.ts`: a lock forgets cached data, and an open screen reloads.

## Result

* The 6 new binding tests about the new behavior failed before the change, and the realm test failed without the realm edits. The two new mobile tests failed before the change.
* `go test ./...` passes in `services/bank-simulator` except `TestResolveTLSFilesFromPEM`, which also fails on `develop` on Windows. `internal/identity/keycloak` and `internal/bank/...` pass in `services/api`.
* golangci-lint: 0 issues in `services/bank-simulator`, and in `services/api` (`internal/identity`, `internal/bank`, with the integration tag).
* Mobile: Jest 2954 tests in 252 suites pass. ESLint, Prettier and `tsc` are clean.
* Local stack: the simulator image was rebuilt. The realm settings were applied to the running Keycloak with `kcadm`, because realms are imported only once. Keycloak accepts the simulator's post logout redirect (302) and refuses an unknown one (400 Invalid redirect uri). The `fynk` realm accepts the broker's `logout_response`.
* Not yet checked end to end in the app by Daniel: the second account linking Banco Demo through "Cambio de cuenta" and "Ingresar con Fynk".

## Decisions and problems

* Logout instead of `prompt=login`, because Keycloak's re-authentication keeps the current user and the next Fynk user can never log in.
* POST logout, so the ID token stays out of URLs (security rule). Keycloak itself sends the ID token in the redirect to the `fynk` realm logout (`sendIdTokenOnLogout`). Without it, the `fynk` realm shows its own "¿Cerrar sesión?" page.
* The cache is reset on `vault.locked`, not on "signed out". The sign out event comes before the vault closes, so a reset then could re-read the old account's data.
* Owners: `app/startup.ts` is M0 (Sofia) and `banco-demo-realm.json` is M16 (Juan Pablo). Both need to approve. Daniel asked for both fixes in one branch to test them together.
* Staging: deploy does not apply realm changes. The three realm settings must be set by hand in staging, with the staging URLs.

## Next step

Daniel tests on the emulator: the second account's onboarding shows no data of the first, and linking Banco Demo passes through "Cambio de cuenta", "Ingresar con Fynk" and the second account's own login. Then apply the realm settings in staging after the merge.
