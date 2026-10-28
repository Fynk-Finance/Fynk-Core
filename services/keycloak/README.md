# Keycloak

Login, registration, email verification and password reset for Fynk. Realms and themes are code.

| Path | Owner |
| --- | --- |
| `realms/fynk-realm.json`, `Dockerfile` | M1 Identity (Daniel Palacios) |
| `realms/banco-demo-realm.json` | M16 Banco Demo (Juan Pablo Contreras) |
| `theme/` (Keycloakify, `fynk` and later `banco-demo`) | M1 and M16, added in M1 branch 2 |

Keycloak imports every `realms/*-realm.json` on its first start (`--import-realm`). It only imports a realm that does not exist yet, so after changing a file, reset (see below).

## What the fynk realm sets

The file is written by hand and only holds what differs from Keycloak's defaults. Each line is checked by `services/api/internal/identity/keycloak/realm_test.go`.

| Setting | Value | Why |
| --- | --- | --- |
| Login | Email as username, one account per email, verified email required, reset by email | HU-001, HU-005 |
| Password policy | `length(8) and regexPattern(.*[A-Za-z].*) and digits(1) and notEmail` | HU-050, HU-001 |
| Brute force | Locked 15 minutes after 5 failures, never permanently | HU-050 |
| Tokens | Signed with PS256 from the `fynk-ps256` key, access token 5 minutes, refresh tokens rotate (`revokeRefreshToken`, reuse 0) | HU-050, HU-002 |
| Sessions | 30 days idle, 90 days max, **no `offline_access`** | Team decision on open item 5 |
| Email links | Verification and reset links expire in 10 minutes | HU-050, HU-005 |
| Registration | Custom flow `fynk registration`: email and the terms checkbox. The acceptance date is stored in the user attribute `terms_and_conditions` | HU-001 |
| User profile | Email, optional first and last name, nothing else. Users cannot add attributes (`ADMIN_VIEW`), so no cédula can be stored | HU-001, CLAUDE.md rule 10 |
| Events | Login, errors, registration, verification, reset and logout kept 90 days in the Keycloak database for M13. Admin events without representations, because those contain emails. No `jboss-logging` listener, because it writes the email to the logs | HU-050, HU-002 |
| Locale | Spanish only | |

Clients:

| Client | Type | Used by |
| --- | --- | --- |
| `fynk-mobile` | Public, Authorization Code with PKCE S256 only, redirect `co.fynk.app://oauth/callback`, adds `aud=fynk-api` | The app, in the system browser |
| `fynk-api` | Bearer-only | Audience of the access tokens the API accepts |
| `fynk-admin` | Confidential, service account only, `realm-management` roles `view-users` and `manage-users` | The API, to read the profile and send verification emails. Keycloak cannot narrow `manage-users` to those two operations, so the API only calls those endpoints |

### Things that are easy to break

* **Password on the registration form.** While email verification is on, Keycloak 26 does not take the password on the registration form. The user chooses it after opening the verification link, under the same policy. This protects against account pre-hijacking: someone else registering your email with a password they know. The design's "Crear cuenta" screen has a password field, so the theme follows this order instead. Turning on the deprecated `always_set_password_on_register_form` option would bring the field back. Do not do that without a team decision.
* **`requiredActions` replaces Keycloak's list.** Listing only one action drops the others. Without `VERIFY_EMAIL`, unverified users get tokens. The file therefore lists all of Keycloak 26.8's defaults, with `TERMS_AND_CONDITIONS` turned on. Keycloak only records the terms acceptance date while that action is on.
* **Placeholders.** `${VAR}` is read from Keycloak's environment at import, and `${VAR:default}` falls back to the default. Secrets never have a default (a test checks it).

## Environment

| Variable | Local value | Staging (M14, Secrets Manager) |
| --- | --- | --- |
| `FYNK_ADMIN_CLIENT_SECRET` | from `.env` | Random secret, also given to the API. **Required**: without it the client secret is the literal text `${FYNK_ADMIN_CLIENT_SECRET}` |
| `FYNK_DEMO_USER_PASSWORD` | from `.env` | Password of the seeded `demo@fynk.local` |
| `FYNK_SMTP_HOST`, `FYNK_SMTP_PORT` | `mailpit`, `1025` (defaults) | Amazon SES SMTP endpoint, `587` |
| `FYNK_SMTP_FROM` | `no-reply@fynk.local` (default) | The verified SES sender |
| `FYNK_SMTP_AUTH`, `FYNK_SMTP_STARTTLS` | `false` (defaults) | `true`, `true` |
| `FYNK_SMTP_USER`, `FYNK_SMTP_PASSWORD` | empty | SES SMTP credentials |

## Run it

`make dev` starts Keycloak on http://localhost:8081 with the realms mounted from this folder (see `docs/local-dev.md`). Every email lands in Mailpit (http://localhost:8025).

* Account console of the fynk realm: http://localhost:8081/realms/fynk/account
* The image: `docker build -t fynk-keycloak services/keycloak`. Staging runs `start --optimized --import-realm`.
* Android emulator: the token issuer is `http://localhost:8081/realms/fynk`, so run `adb reverse tcp:8081 tcp:8081` rather than using `10.0.2.2`.

**Reset after changing a realm file.** Either delete the realm in the admin console (http://localhost:8081/admin) and run `docker compose restart keycloak`, or run `docker compose down -v && make dev`, which also deletes all local Postgres data.

## Change the realm

1. Try the change in the admin console of your local Keycloak.
2. Export it: Realm settings → Action → Partial export (with clients). Secrets come out masked.
3. Copy only the keys you changed into `realms/fynk-realm.json`. Keep the file minimal and use placeholders for secrets.
4. Add or adjust the test in `realm_test.go`, reset Keycloak, and run the tests below.

## Tests

```sh
cd services/api
go test ./internal/identity/keycloak/                                 # the file, no Docker
go test -tags integration -count=1 ./internal/identity/keycloak/...   # a real Keycloak 26.8.1 and Mailpit (Docker)
```

The integration tests drive the real flows over HTTP:
* sign-up with the terms, verification link, first password
* PKCE login and PS256 tokens
* refresh token rotation
* password reset by email
* brute-force lock
* stored events
