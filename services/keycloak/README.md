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
| Login | Email as username, one account per email, verified email required (by a 6-digit code), reset by a 6-digit code | HU-001, HU-005 |
| Password policy | `length(8) and regexPattern(.*[A-Za-z].*) and digits(1) and notEmail` | HU-050, HU-001 |
| Brute force | Locked 15 minutes after 5 failures, never permanently | HU-050 |
| Tokens | Signed with PS256 from the `fynk-ps256` key, access token 5 minutes, refresh tokens rotate (`revokeRefreshToken`, reuse 0) | HU-050, HU-002 |
| Sessions | 30 days idle, 90 days max, **no `offline_access`** | Team decision on open item 5 |
| Email codes | The verification code and the reset code expire in 10 minutes (`actionTokenGeneratedByUserLifespan`) | HU-050, HU-005 |
| Registration | Custom flow `fynk registration`: email, password and the terms checkbox, then the email code. The acceptance date is stored in the user attribute `terms_and_conditions` | HU-001 |
| User profile | Email, optional first and last name, nothing else. Users cannot add attributes (`ADMIN_VIEW`), so no cédula can be stored | HU-001, CLAUDE.md rule 10 |
| Events | Login, errors, registration, verification, reset and logout kept 90 days in the Keycloak database for M13. Admin events without representations, because those contain emails. No `jboss-logging` listener, because it writes the email to the logs | HU-050, HU-002 |
| Locale | Spanish only | |

Clients:

| Client | Type | Used by |
| --- | --- | --- |
| `fynk-mobile` | Public, Authorization Code with PKCE S256 only, redirect `co.fynk.app://oauth/callback`, adds `aud=fynk-api` | The app, in the system browser |
| `fynk-api` | Bearer-only | Audience of the access tokens the API accepts |
| `fynk-admin` | Confidential, service account only, `realm-management` roles `view-users` and `manage-users` | The API, to read and update the profile and to end a removed device's session. Keycloak cannot narrow `manage-users` to those operations, so the API only calls those endpoints |

### Things that are easy to break

* **Password on the registration form.** While email verification is on, Keycloak 26 does not take the password on the registration form, against account pre-hijacking (someone registering your email with a password they know). The team decided to follow the design's "Crear cuenta" screen (email, password, terms, then the code), so the `registration-password-action` execution has `always_set_password_on_register_form: true`. Keycloak marks that option deprecated: check it still exists before upgrading Keycloak. Pre-hijacking stays harmless: an account whose email is not verified never gets tokens, and the real owner takes it back with the reset flow, which verifies the email and ends every other session.
* **`requiredActions` replaces Keycloak's list.** Listing only one action drops the others. The file therefore lists all of Keycloak 26.8's defaults, with `TERMS_AND_CONDITIONS` turned on (Keycloak only records the terms acceptance date while that action is on). `VERIFY_EMAIL` (the link) is listed but disabled, and `fynk-verify-email-code` replaces it. Without an enabled verification action, unverified users get tokens.
* **Placeholders.** `${VAR}` is read from Keycloak's environment at import, and `${VAR:default}` falls back to the default. Secrets never have a default (a test checks it).

## Email codes (`extensions/email-code`)

Keycloak only sends links. The design asks for a 6-digit code at sign-up and at password recovery, so this Java extension adds a required action, `fynk-verify-email-code` (sign-up, and login of an unverified email), and an authenticator, `fynk-reset-credential-code` (password recovery). The Dockerfile builds it with Maven, runs its unit tests and puts the jar in `providers/`.

* The code is random (`SecureRandom`), stored only as a salted SHA-256 hash in the browser's authentication session, and compared in constant time. It lives 10 minutes and allows 5 attempts.
* Per user: a new code at most every 60 s, and at most 10 wrong codes in 12 hours. Wrong codes do not count toward the brute-force lock, so nobody can lock someone else's login with them.
* The code, the address and the user name never reach the logs or the stored events (`SEND_VERIFY_EMAIL`, `VERIFY_EMAIL`, errors `invalid_code`, `expired_code`, `email_send_failed`).
* **Password recovery** is the custom flow `fynk reset credentials` (`resetCredentialsFlow`): `reset-credentials-choose-user`, `fynk-reset-credential-code`, `reset-password`. Keycloak's link authenticator `reset-credential-email` is used nowhere.
  * **No account enumeration.** An email without an account (or a disabled one) gets a decoy: the same page, messages, cooldown and wrong-code budget (keyed by `decoy-` plus a SHA-256 of the realm and the lowercased address), a code note stored like a real one, no email sent, and every code refused, even a lucky guess. The one difference left is time: sending the SMTP message makes the real path slower, as in Keycloak's own link flow. A failed send is not shown either.
  * A right code marks the email as verified (owning the mailbox proves it, which is how an account somebody pre-registered is taken back), ends every other session of the user (back-channel logout, offline sessions and other authentication sessions; Keycloak's `AuthenticatorUtil.logoutOtherSessions` only accepts a required action or action token context, so its steps are repeated with public APIs), and then asks for the new password.
  * The flow ends on Keycloak's info page ("account updated") after the new password. The person is not logged in and no authorization code is issued; they sign in again from the app.
  * Events: `SEND_RESET_PASSWORD` and the errors `invalid_code` and `expired_code`, without the address, the user name or the code.
* Pages and emails: `fynk-email-code.ftl` (login and email) and `messages_*.properties` under `src/main/resources/theme-resources/`. They work with Keycloak's default theme until the Fynk theme overrides them.

```sh
cd services/keycloak/extensions/email-code && mvn -B verify   # unit tests, JDK 21+
```

## Environment

| Variable | Local value | Staging (M14, Secrets Manager) |
| --- | --- | --- |
| `FYNK_ADMIN_CLIENT_SECRET` | from `.env` | Random secret, also given to the API. **Required**: without it the client secret is the literal text `${FYNK_ADMIN_CLIENT_SECRET}` |
| `FYNK_DEMO_USER_PASSWORD` | from `.env` | Password of the seeded `demo@fynk.local` |
| `FYNK_SMTP_HOST`, `FYNK_SMTP_PORT` | `mailpit`, `1025` (defaults) | Amazon SES SMTP endpoint, `587` |
| `FYNK_SMTP_FROM` | `no-reply@fynk.local` (default) | The verified SES sender |
| `FYNK_SMTP_AUTH`, `FYNK_SMTP_STARTTLS` | `false` (defaults) | `true`, `true` |
| `FYNK_SMTP_USER`, `FYNK_SMTP_PASSWORD` | empty | SES SMTP credentials |

## Theme (`theme/`)

A Keycloakify 11 project for the login theme `fynk`. It is its own pnpm project with its own lockfile, not part of the root workspace. For now every page renders as Keycloak's default. Versions are in `docs/adr/0001-stack.md`.

```sh
cd services/keycloak/theme
pnpm install --ignore-workspace   # needs Node 22.20 or newer
pnpm typecheck
pnpm build-keycloak-theme         # needs a JDK and Maven; writes dist_keycloak/fynk-keycloak-theme.jar
```

`src/kc.gen.tsx` is generated by `pnpm gen` (Keycloakify's `update-kc-gen`), which `typecheck` and `build` run first, so it is not committed. `pnpm dev` only shows "No Keycloak Context" until a page context is mocked in `src/main.tsx`. The JAR is not committed. Copying it into the image (`Dockerfile`) and building it in CI come in a later pull request. The email theme is also left for later.

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
go test -tags integration -count=1 ./internal/identity/keycloak/...   # this image (built from the Dockerfile) and Mailpit (Docker)
```

The integration tests drive the real flows over HTTP:
* sign-up with the password and the terms, then the email code
* the code page on login for an unverified email, wrong codes, 5 attempts, the 60 s resend cooldown
* PKCE login and PS256 tokens
* refresh token rotation
* password reset by the code: wrong code, policy, info page, other sessions ended, unknown email looks the same, unverified email becomes verified
* brute-force lock
* stored events
