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
| Sessions | 30 days idle, 90 days max, **no `offline_access`** | Team decision (CLAUDE.md, Decisions taken: Offline sessions) |
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
  * **Email reset stamp.** A right code in this flow, and only here, sets the user attribute `fynkEmailResetAt` (epoch milliseconds as a string). The backend (M2) allows the backup reset "No tengo ninguno de los dos" only if the stamp is at most 10 minutes old, so someone who knows just the password cannot delete a backup. It is an unmanaged attribute: the realm's `unmanagedAttributePolicy` is `ADMIN_VIEW`, so the person cannot see or change it in the account console, the account API or the forms. The registration code and the app's "Cambiar contraseña" (`kc_action=UPDATE_PASSWORD`) never set it. It is stamped when the code is verified, not when the new password is saved: the password step is a Keycloak required action (`UPDATE_PASSWORD`) that cannot tell a reset from an app-initiated change without a second extension, and the same browser session must still finish the reset, so the code already proves the mailbox.
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

A Keycloakify 11 project for the login theme `fynk`. It is its own pnpm project with its own lockfile, not part of the root workspace. `login.ftl`, `register.ftl`, the password recovery (`login-reset-password.ftl`, the email code page `fynk-email-code.ftl`, `login-update-password.ftl`, and `info.ftl` as its success), the generic `info.ftl` and `error.ftl` use the Fynk design (blue header, lime band, white card, light and dark from the browser setting, fonts bundled from `@fontsource`). Every other page still renders as Keycloak's default. `fynk-email-code.ftl` is the page of the email-code extension: it keeps the extension's form contract (form `kc-email-code-form`, field `code`, buttons `verify` and `resend`, link `kc-email-code-change-link`). Its extra page id is declared in `src/login/KcContext.ts`. Keycloakify embeds the whole data model in the HTML, so `postBuild.ts` (Keycloakify's `postBuild` hook) removes `auth` and `user` from that page's embedded data: the recovery must look the same for an email with an account and one without. `login-update-password.ftl` has a second variant for the password change the app starts from Seguridad (`kc_action=UPDATE_PASSWORD`, `isAppInitiatedAction`): no recovery steps, a hidden `logout-sessions=on` that ends the other sessions, and a Cancelar button (`cancel-aia=true`, which Keycloak answers with a code and `kc_action_status=cancelled`); it needs design review. Versions are in `docs/adr/0001-stack.md`.

The realm also selects the email theme `fynk` (`emailTheme`), in `theme/src/email/`. It is plain FreeMarker, not React: Keycloakify copies a folder with a `theme.properties` into the same jar as the `email` theme type. It only overrides the 6-digit code email (`html/fynk-email-code.ftl`, `text/fynk-email-code.ftl`, `messages/messages_es.properties`); every other email falls back to Keycloak's `base`. The HTML is a table layout with inline CSS (one `<style>` block for dark mode) and mirrors the colors of `fynk-variables.css`. It has no links and no images (text wordmark), so the code is the only way in and nobody can be sent to a fake page. If the theme were missing, the extension's own default templates (`theme-resources/templates`) still render the email.

```sh
cd services/keycloak/theme
pnpm install --ignore-workspace   # needs Node 22.20 or newer
pnpm typecheck
pnpm build-keycloak-theme         # needs a JDK and Maven; writes dist_keycloak/fynk-keycloak-theme.jar
```

`src/kc.gen.tsx` is generated by `pnpm gen` (Keycloakify's `update-kc-gen`), which `typecheck` and `build` run first, so it is not committed. `pnpm dev` builds a mock context from the query string (`/?page=` with `login.ftl`, `register.ftl`, `login-reset-password.ftl`, `fynk-email-code.ftl`, `login-update-password.ftl`, `info.ftl` or `error.ftl`, plus `&error=...`, `&purpose=reset`, `&cooldown=42`, `&kind=generic`; see the header of `src/login/dev-preview.ts`); the mock is not part of the built theme. The JAR is not committed.

**In the image.** The `Dockerfile` has a `theme` stage that runs `pnpm install --frozen-lockfile --ignore-workspace` and `pnpm build-keycloak-theme` (Maven image `maven:3.9.11-eclipse-temurin-21` with Node copied from `node:22.21.1-bookworm-slim`; pnpm 11.28.8 comes from `packageManager` through corepack) and copies `fynk-keycloak-theme.jar` into `providers/` before `kc.sh build`. Like the extension stage it runs on the build machine (`BUILDPLATFORM`), because the jar does not depend on the CPU. The dependency install is cached until `package.json` or `pnpm-lock.yaml` change. `.dockerignore` only lets the theme's sources and config in, never `node_modules` or build output. The realm `fynk` sets `"loginTheme": "fynk"` (a test checks it); the realm `banco-demo` sets none and keeps Keycloak's own pages. `emailTheme` is not set: the emails stay the extension's own templates until the email theme is built.

**What the integration tests see.** The pages are drawn in the browser, so the HTML Keycloak sends holds the data model (`kcContext`, a JavaScript object literal) and a script, not the form. The tests read the form URLs (`url.loginAction`, `url.registrationAction`), the page (`pageId`) and the messages (`message.summary`) from that data model.

**"Ir a iniciar sesión" after a password reset.** Keycloak closes the login session at the end of the recovery and gives no link. The client `fynk-mobile` cannot have a base URL: Keycloak rejects `co.fynk.app://...` ("not a valid URL") in the admin API and in the realm import. So `src/login/appReturnUrl.ts` reads the app's `redirect_uri` and `state` from the `client_data` of the session URLs on the page and links to `co.fynk.app://oauth/callback?error=access_denied&state=...`, the answer Keycloak gives when a person cancels. The app must treat it as "back to Inicio". An integration test checks that `client_data` is still on that page.

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
