# M4 Open Finance consents

| Item | Value |
| --- | --- |
| Phase | 2 (the backend part is needed by M5 in Phase 1, start with it) |
| Stories | HU-006 SCRUM-20 (5), HU-007 SCRUM-21 (2), HU-008 SCRUM-22 (5) |
| Points | 12 |
| Owner | Juan Carlos Leal (`@JuanLeal05`) |
| Owns | `services/api/internal/consents/`, `contracts/modules/consents.yaml`, `apps/mobile/src/modules/consents/` |
| Depends on | M0, M1, M13 audit |
| Used by | M5 (consent check before every bank call), M13 (deletion revokes all) |

How to use: open Claude Code at the repository root on a fresh branch from `develop` and paste everything below the line.

---

You are building module M4 Open Finance consents of Fynk. A consent is the user's explicit, specific and revocable authorization for Fynk to receive data from one entity. Its metadata is stored in clear on purpose, because it must be auditable. It never contains financial data or tokens.

## Read first

1. `CLAUDE.md` (Regulatory guardrails), `docs/modules/00-shared-contracts.md` sections 4.3, 4.5 and 5.
2. Design PNGs `20-conectar-banco.png` and `07-mi-cuenta.png` and `07-mi-cuenta-2.png`. Read the code of the same screens in `docs/design/source/` first (file map in `docs/design/README.md`) and take exact values, SVGs and animations from it. The PNGs are for checking the result.
3. Jira SCRUM-20, SCRUM-21, SCRUM-22.

## Stories and criteria

**HU-006 Otorgar consentimiento (SCRUM-20)**
* Debe mostrarse alcance y duración del consentimiento. Debe registrarse explícitamente. Debe cumplir normativa Open Finance Colombia. Debe almacenarse evidencia de aceptación.

**HU-007 Consultar consentimientos activos (SCRUM-21)**
* Estado, fecha de otorgamiento, fecha de expiración, información actualizada.

**HU-008 Revocar consentimiento (SCRUM-22)**
* Revocación inmediata. Notificar al proveedor. Sin nuevas sincronizaciones. Evidencia auditable.

## Design

**Conectar banco** (shared with M5, you own the consent part):
* Header "Conecta tu banco", subtitle "Elige tu entidad y autoriza la conexión en su portal."
* Entity selector "Banco o billetera digital" (data from M5 `GET /providers`). Banco Demo and Billetera Demo show a "Simulado" badge.
* Card "<Entidad> compartirá con Fynk": Saldos ("Saldo disponible de tus cuentas y tarjetas"), Movimientos ("Ingresos y gastos de los últimos 12 meses"), Datos de la cuenta ("Tipo de cuenta, nombre del titular y últimos 4 dígitos").
* Card "Fynk nunca podrá": "Ver ni guardar tu clave del banco", "Mover tu dinero, hacer pagos o transferencias". Footer: "Puedes revocar el acceso cuando quieras desde Mi cuenta. Se actualizan cada vez que abres Fynk o deslizas para actualizar."
* Add the purpose and the term in plain words: "Finalidad: mostrarte tus finanzas y recomendaciones dentro de Fynk. Vigencia: 12 meses."
* Checkbox "Autorizo a Fynk a consultar y tratar estos datos según la Política de privacidad." (unchecked by default, the button stays disabled until checked) and button "Ir al portal de <Entidad>" which hands over to M5.

**Consentimientos** (new screens, from Mi cuenta, Privacidad y datos):
* List: one card per consent with entity, status chip (Activo, Revocado, Vencido, Pendiente), "Otorgado el", "Vence el".
* Detail: the same scope list, purpose, term, the consent text version, and the red action "Revocar acceso". Revoking asks for biometrics or password, then shows "Fynk ya no recibirá datos de <Entidad>."

## Technical design

Schema `consents`:

```sql
create table consents.consent_texts (
  version text primary key, body_md text not null, sha256 bytea not null, published_at timestamptz not null
)
create table consents.consents (
  id uuid primary key,
  user_id text not null,
  device_id uuid not null,
  provider text not null,
  scopes text[] not null,               -- {'balances','transactions','account_details'}
  purpose text not null,
  term_days int not null,               -- 365
  status text not null,                 -- pending, active, revoked, expired, failed
  text_version text not null references consents.consent_texts(version),
  evidence jsonb not null,              -- text sha256, accepted_at, device_id, app_version, locale
  provider_consent_id text,
  created_at timestamptz not null,
  granted_at timestamptz, expires_at timestamptz, revoked_at timestamptz,
  revoked_reason text
)
```

* `POST /consents` creates a `pending` consent with the exact scopes, purpose and term shown, plus evidence. The scopes must be a subset of what the provider supports. No open or general consents.
* `ConsentChecker.MarkGranted` (called by M5 after the bank returns tokens) sets `active`, `granted_at`, `expires_at = granted_at + term_days`.
* `ConsentChecker.Active` returns false for anything not `active` or past `expires_at`. A daily job marks expired ones and records `consent.expired`.
* `POST /consents/{id}/revoke`: marks `revoked` in one transaction, then calls the M5 port `bank.ports.Revoker.RevokeConsent(provider, providerConsentID)`. If the bank call fails, the consent stays revoked in Fynk and a retry job keeps trying every 10 minutes up to 24 hours. The device deletes the token for that link when the response arrives.
* `GET /consent-texts/current` returns the Spanish text shown in the app. Seed version `2026-10-v1`.
* Audit every change: `consent.created`, `consent.granted`, `consent.revoked`, `consent.expired`, with provider and consent id only.
* Mobile exports from `index.ts`: `ConsentScopeCard`, `ConsentCheckbox`, `createConsent(provider)`, `ConsentsListScreen`, `ConsentDetailScreen`, `revokeConsent(id)`, `useConsents()`.

## Work plan (one branch each, from `develop`)

1. `feature/consents-backend`: schema, endpoints, `ConsentChecker` real implementation replacing M0's stub, expiry job, audit.
2. `feature/consent-revocation-with-provider`: revoke flow, retry job, contract examples.
3. `feature/connect-bank-consent-ui`: the consent part of Conectar banco.
4. `feature/consents-list-and-detail`: list, detail, revoke from the app.

## Tests

* A consent cannot become active without evidence and a known text version.
* After revoke, `Active` returns false immediately and M5's next query returns `409 consent_revoked` (integration test with M5's port stubbed).
* Expiry after `term_days` with an injected clock.
* The audit table gets one row per state change and none contains amounts or emails.

## Done when

* All criteria pass and the Gate C revocation item passes on staging.

## Ask before

* Changing the term (12 months), the scopes or the consent text. Legal wording changes need the team.
