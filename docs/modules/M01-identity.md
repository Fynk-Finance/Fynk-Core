# M1 Identity and access (Keycloak)

| Item | Value |
| --- | --- |
| Phase | 1 |
| Stories | HU-001 SCRUM-5 (2), HU-002 SCRUM-6 (3), HU-005 SCRUM-9 (5), HU-050 SCRUM-67 (5) |
| Points | 15 |
| Owner | Daniel Palacios (`@Komi-yes`) |
| Owns | `services/keycloak/`, `services/api/internal/identity/`, `contracts/modules/identity.yaml`, `apps/mobile/src/modules/identity/` |
| Depends on | M0 (Gate A), M14 (Keycloak running on staging) |
| Used by | every module through the auth middleware and the session hook |

How to use: open Claude Code at the repository root on a fresh branch from `develop` and paste everything below the line.

---

You are building module M1 Identity and access of Fynk. Keycloak is the identity provider. Fynk never stores passwords and never builds its own login.

## Read first

1. `CLAUDE.md`, then `docs/modules/00-shared-contracts.md` sections 1, 4.2 and 5.
2. Design screens `Inicio`, `Login`, `Registro`, `Recuperar`, `DetalleCuentas` (Mi cuenta), `CfgSeguridad` ("Cambiar contraseña", "Dispositivos activos") and `OnbCorreo`, and the change notes in `docs/design/README.md`. Read the code of these screens in `docs/design/sources/light/` and `docs/design/sources/dark/` first (inventory, gestures and transitions in `docs/design/README.md`) and take exact values, SVGs and animations from it. The PNGs in `docs/design/screens/light/` and `docs/design/screens/dark/` are for checking the result. Every screen works in light and dark (colors only from `useTheme()`), and uses the default transition and back gesture of its kind unless the inventory says otherwise.
3. If the Atlassian connector is available, read SCRUM-5, SCRUM-6, SCRUM-9 and SCRUM-67. Otherwise use the criteria below.

## Stories and criteria

**HU-050 Configurar Keycloak (SCRUM-67)**
* El realm "fynk" se define como código versionado y se importa automáticamente.
* La aplicación móvil es un cliente público con Authorization Code y PKCE S256, abierto en el navegador del sistema.
* Los tokens se firman con PS256. Access token de 5 minutos y refresh token con rotación.
* Política de contraseña: mínimo 8 caracteres, al menos una letra y un número.
* Protección contra fuerza bruta activada.
* Verificación de correo y recuperación de contraseña por correo con vencimiento de 10 minutos.
* Las pantallas de Keycloak usan el tema visual del diseño de Fynk.
* Los eventos de inicio de sesión, error y recuperación quedan disponibles para la auditoría.

**HU-001 Registro de usuario (SCRUM-5)**
* El correo debe validarse antes de crear la cuenta. No deben existir cuentas duplicadas para el mismo correo.
* Contraseña de al menos 8 caracteres, una letra y un número. Debe registrarse la fecha de creación. Mensaje de éxito o error.
* El registro se hace en Keycloak. No se solicita ni se almacena la cédula.
* Deben aceptarse los Términos y condiciones y la Política de privacidad.
* Al terminar el registro se genera el código de recuperación del respaldo (HU-045, built by M2).

**HU-002 Inicio de sesión seguro (SCRUM-6)**
* Solo usuarios válidos. Credenciales nunca en texto plano. Tokens seguros. Manejo de sesiones expiradas. Eventos de autenticación registrados.
* Keycloak con Authorization Code y PKCE en el navegador del sistema. El backend valida los tokens PS256 con su JWKS. Tokens en Keychain o Keystore.

**HU-005 Recuperación segura de acceso (SCRUM-9)**
* Valida identidad, no compromete claves cifradas, envía notificación, registra auditoría.
* Flujo de Keycloak por correo con vencimiento de 10 minutos. Cambiar la contraseña no cambia ni expone la llave de la bóveda.

## Design notes

* **Inicio** (native): illustration of two cards and coins, title "Toma el control de **tu dinero**" (second line in primary blue), subtitle "Conecta tus bancos y organiza tu presupuesto en un solo lugar", lime button "Empezar" with arrow. "Empezar" opens Keycloak registration. Add a text link "Ya tengo cuenta" that opens Keycloak login.
* **Iniciar sesión, Crear cuenta, Recuperar contraseña** are Keycloak pages. Reproduce them as a Keycloak theme built with Keycloakify: blue header with the Fynk logo, white title "Hola de nuevo" / "Crea tu cuenta" / "¿Olvidaste tu clave?", subtitle in white, lime band above a white rounded card, fields with left icon and light blue background, blue primary button with arrow, green links "Regístrate", "Inicia sesión", "¿Olvidaste tu contraseña?". Registration shows only "Correo electrónico", "Contraseña" with the hint "Mínimo 8 caracteres, con una letra y un número." and the terms checkbox. No cédula field. Recovery copy: "Escribe el correo de tu cuenta y te enviaremos un código para crear una nueva contraseña." and "Por seguridad, el código vence en 10 minutos.". Sign up and recovery use 6 digit email codes, as in the design (team decision, `docs/adr/0007-email-codes.md`): after "Crear cuenta" the code page (`OnbCorreo` content, "Reenviar" with a 60 second countdown); recovery goes email, code, new password, then the success page "¡Contraseña actualizada!" ("Cerramos las sesiones abiertas en otros dispositivos…") with "Ir a iniciar sesión".
* The "Huella o Face ID" button does not appear on the Keycloak page. It belongs to the native lock screen built by M2.
* **Mi cuenta**: you build the header (avatar initials, full name, "Perfil verificado" badge when `email_verified`), "Correo de recuperación" (masked, for example `la•••@correo.com`), "Miembro desde" (Keycloak `createdTimestamp`), and the rows "Seguridad", "Apariencia" (opens M0's `APPEARANCE_ROUTE`) and "Cerrar sesión". **Seguridad** (`CfgSeguridad`): "Cambiar contraseña" with "Actualizada hace …" (`passwordUpdatedAt`) opens Keycloak's themed password page with `kc_action=UPDATE_PASSWORD` in the system browser (the account console has no Fynk theme); "Dispositivos activos" lists the linked devices: device name and last seen, "Este dispositivo" badge, "Cerrar" per device and "Cerrar todas las demás sesiones". The place ("Bogotá" in the design) is not shown: a location derived from the IP is not in "Where data lives". The unlock switch and the recovery code row there are M2's. Other rows on that screen belong to other modules and come from their `index.ts`.
* **Configuración · Correo** is not an onboarding step: the email is verified with the code in Keycloak right after "Crear cuenta", before the app gets a session. There is no `EmailVerificationStep` component.

## Technical design

### Keycloak (`services/keycloak/`)

* `realms/fynk-realm.json` exported from a configured realm and imported at start (`--import-realm`). Keep secrets out of it with environment placeholders.
* Realm settings: login with email, registration allowed, verify email required, duplicate emails not allowed, brute force detection on (lock after 5 failures for 15 minutes), password policy `length(8) and regexPattern(.*[A-Za-z].*) and digits(1) and notEmail`, default signature algorithm `PS256`, access token lifespan 5 minutes, SSO session idle 30 days for the mobile client, refresh token rotation (`Revoke Refresh Token` on, max reuse 0), action token lifespan for reset credentials and verify email 10 minutes, required action "Terms and Conditions".
* Client `fynk-mobile`: public, standard flow only, PKCE `S256` required, redirect URI `co.fynk.app://oauth/callback`, web origins none, consent off, scopes `openid profile email`, normal refresh tokens (the team decided against offline sessions).
* Client `fynk-api`: bearer only, used as the access token audience (add an audience mapper to `fynk-mobile`).
* Client `fynk-admin`: confidential, service account with `view-users` and `manage-users`, used by the backend to read and update the profile and to end a removed device's session.
* Events: enable user events (`LOGIN`, `LOGIN_ERROR`, `REGISTER`, `RESET_PASSWORD`, `UPDATE_PASSWORD`, `VERIFY_EMAIL`, `LOGOUT`) and admin events, stored 90 days. M13 pulls them into the audit store.
* Email through Amazon SES SMTP with the address from config. Email templates themed in Spanish.
* Email codes: the extension `services/keycloak/extensions/email-code/` (required action `fynk-verify-email-code`, authenticator `fynk-reset-credential-code` in the flow `fynk reset credentials`). Its rules are in `services/keycloak/README.md` and `docs/adr/0007-email-codes.md`.
* Theme project `services/keycloak/theme/` with Keycloakify, theme name `fynk` (login, email). M16 adds a second theme `banco-demo` in the same project. Build a JAR in CI and mount it in the image `services/keycloak/Dockerfile` (pin the Keycloak version).

### Backend (`services/api/internal/identity/`)

* JWKS validation middleware: cache keys 10 minutes, accept only PS256, check `iss`, `aud=fynk-api`, `exp`, `nbf`, clock skew 30 s. Replace the M0 stub.
* Schema `identity`:

```sql
create table identity.devices (
  id uuid primary key,
  user_id text not null,
  name text not null,
  platform text not null check (platform in ('ios','android')),
  public_key bytea not null,           -- X25519 public key used by M2 device approval
  status text not null check (status in ('pending','active','removed')),
  session_id text,                     -- Keycloak sid, ended when the device is removed
  created_at timestamptz not null,
  last_seen_at timestamptz not null,
  unique (user_id, public_key)
)
create index on identity.devices (user_id)
```

* Endpoints in `contracts/modules/identity.yaml`: `GET /me` (sub, email masked, name, emailVerified, createdAt and passwordUpdatedAt from Keycloak admin API, cached 5 minutes), `PATCH /me` (first and last name, written to Keycloak), `POST /devices`, `GET /devices`, `GET /devices/current` (lets the app detect it was removed), `DELETE /devices/{id}` (also revokes that device's Keycloak session), `POST /devices/sign-out-others` ("Cerrar todas las demás sesiones").
* There is no `POST /me/verification-email`: with the code inside Keycloak, a signed-in user always has a verified email, and changing the email is not in the design (`UPDATE_EMAIL` is off). If it is added one day, it uses the same Keycloak code page.
* The first device of a user becomes `active` at registration. Any later device stays `pending` until M2 approves it or the recovery code is used. Expose `ActivateDevice(ctx, deviceID)` in `internal/identity/ports` for M2.
* Audit through `audit.Recorder`: `device.registered`, `device.removed`.

### Mobile (`apps/mobile/src/modules/identity/`)

* OIDC with `react-native-app-auth`: authorize with PKCE in the system browser (ASWebAuthenticationSession, Custom Tabs). Registration uses the same flow with `kc_action=register` hint or the registration endpoint.
* Tokens stored with `react-native-keychain` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Refresh 60 s before expiry. On refresh failure go to Inicio.
* Expose in `index.ts`: `useSession()`, `getAccessToken()`, `signIn()`, `signUp()`, `signOut()`, `deviceId()`, the token refresh hook for the M0 API client, and the screens `LinkedDevicesScreen` and `MiCuentaHeader`. Inicio is shown by the module's own flow, so it is not exported.
* On first launch generate the device X25519 key pair (with `@noble/curves`), keep the private key in Keychain, register the device with `POST /devices`.
* On every app start call `GET /devices/current`. If the device was removed, sign out and ask M2 to wipe the vault (`vault.wipe()` from `@modules/vault`).
* After a new registration, navigate to M2's recovery code screen, then to onboarding (M3).

## Work plan (one branch each, from `develop`)

1. `feature/keycloak-realm-as-code`: realm JSON, Dockerfile, local import, README with how to export changes.
2. `feature/keycloak-fynk-theme`: Keycloakify theme for login, register, reset password, verify email, emails. Compare each page against the PNGs.
3. `feature/api-jwt-middleware`: JWKS middleware, tests with a locally signed PS256 token, remove the stub.
4. `feature/devices-and-profile-endpoints`: schema, endpoints, contract file with examples, tests with testcontainers.
5. `feature/mobile-sign-in-with-pkce`: session handling, Inicio screen, token refresh hook.
6. `feature/linked-devices-screen`: Mi cuenta header and the devices screen.

## Tests

* One test per criterion above. Examples: password `abcdefgh` is rejected, `abcdefg1` is accepted. A token signed with RS256 or HS256 is rejected. An expired access token triggers one refresh and one retry. Asking for a new email code within 60 s sends nothing. Five wrong codes kill the code. An unknown email gets the same reset pages and no email.
* Maestro flow `e2e/identity-signup.yaml`: Empezar, register in Keycloak, verify email from the local mail catcher (Mailpit in docker compose), land on the recovery code screen.

## Done when

* All criteria pass, the Gate B items about registration and login pass on staging, and nothing in logs contains an email or a token.

## Ask before

* Social login, or any other Keycloak extension written in Java. Offline sessions (decided: none) and the 6 digit email codes (decided: the extension in `services/keycloak/extensions/email-code/`) are no longer open.
