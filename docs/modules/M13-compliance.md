# M13 Compliance, privacy and audit

| Item | Value |
| --- | --- |
| Phase | 1 (audit store, HU-027) and 4 (privacy, HU-028 and HU-029) |
| Stories | HU-027 SCRUM-41 (5), HU-028 SCRUM-42 (5), HU-029 SCRUM-43 (2) |
| Points | 12 |
| Owner | Juan Pablo Contreras (`@juancontrerasp`) |
| Owns | `services/api/internal/privacy/`, `services/api/internal/audit/`, `contracts/modules/privacy.yaml`, `apps/mobile/src/modules/compliance/` |
| Depends on | M0, M1 (Keycloak admin client), M2 (`wipe`, `exportAll`), M4 (revoke all), M5 (links) |
| Used by | every backend module (audit recorder) |

How to use: open Claude Code at the repository root on a fresh branch from `develop` and paste everything below the line.

---

You are building module M13 of Fynk: the append only audit trail, the data treatment information, the export of the user's data and account deletion under Ley 1581 de 2012. Start with the audit store, because other modules need it in Phase 1.

## Read first

1. `CLAUDE.md` (Regulatory guardrails, Security rules), `docs/modules/00-shared-contracts.md` sections 4.3 and 5.
2. Design screens `Registro` (terms checkbox), `CfgPrivacidad`, `CfgAyuda` and `CfgEliminar`. Fynk Plus mentions stay hidden, and "Mejorar Fynk" (anonymous statistics) and WhatsApp support wait for the team (CLAUDE.md, open items). Read the code of these screens in `docs/design/sources/light/` and `docs/design/sources/dark/` first (inventory, gestures and transitions in `docs/design/README.md`) and take exact values, SVGs and animations from it. The PNGs in `docs/design/screens/light/` and `docs/design/screens/dark/` are for checking the result. Every screen works in light and dark (colors only from `useTheme()`), and uses the default transition and back gesture of its kind unless the inventory says otherwise.
3. Jira SCRUM-41, SCRUM-42, SCRUM-43.

## Stories and criteria

* **HU-027 Auditoría (SCRUM-41)** Accesos, consentimientos y sincronizaciones registrados. Registros inmutables.
* **HU-028 Eliminación de datos (SCRUM-42)** Mecanismo de solicitud. Evidencia del proceso. Requisitos legales. Resultado informado al usuario.
* **HU-029 Tratamiento de datos (SCRUM-43)** Política vigente. Finalidades. Derechos del titular. Información actualizada.

## Audit store (Phase 1)

* Schema `audit`:

```sql
create table audit.events (
  id bigint generated always as identity primary key,
  type text not null,
  user_id text,
  device_id uuid,
  at timestamptz not null,
  meta jsonb not null,
  prev_hash bytea not null,
  hash bytea not null            -- sha256(prev_hash || canonical json of the row)
)
```

* Immutability: the application database role only has `INSERT` and `SELECT` on `audit.events` (no `UPDATE`, `DELETE`, `TRUNCATE`). Migrations run with a separate migrator role. A trigger rejects updates and deletes as a second barrier. The hash chain lets anyone verify that no row was removed: add `GET /internal/audit/verify` (admin only, not in the public contract) and a CLI command `fynk-api audit verify`.
* `Recorder.Record` replaces M0's stub. It validates `meta` against an allow list of keys per event type and refuses amounts, emails, tokens and account numbers.
* Keycloak events: a job every 5 minutes reads new user events from the Keycloak admin API (`fynk-admin` client) and records `auth.login`, `auth.login_failed`, `auth.password_reset`.
* Retention: 5 years for consent events, 1 year for the rest (document the choice in `docs/adr/0004-audit-retention.md` and ask the team to confirm).

## Privacy (Phase 4)

* `GET /privacy/policy`: the current policy version in Spanish (markdown), with data controller, purposes (finanzas personales, recomendaciones informativas, seguridad), data categories and where each one lives (link to the "Where data lives" table of CLAUDE.md written in plain words), rights of the owner (conocer, actualizar, rectificar, solicitar prueba de la autorización, revocar, suprimir, presentar quejas ante la SIC), contact channel and response times (10 working days for queries, 15 for claims under Ley 1581, write them in the policy for the team to confirm).
* `GET /privacy/my-data`: everything Fynk stores in the cloud for that user (profile from Keycloak, devices, consents with evidence, bank links without fingerprints, backup record count and size, audit events of that user). The phone adds its own vault export from M2 `exportAll()` and offers one JSON file to save or share.
* Account deletion: `POST /privacy/deletion-requests` (requires a fresh login in the last 5 minutes) runs in this order and records each step:
  1. revoke every consent through M4 (which revokes at the bank)
  2. mark every bank link revoked
  3. delete all backup records, recovery key and device approvals
  4. delete devices
  5. delete the Keycloak user
  6. keep only the deletion evidence (request id, user id hash, timestamps, steps done) and the audit chain, which never stores personal content
  7. the phone wipes the vault with M2 `wipe()` and returns to Inicio
* `GET /privacy/deletion-requests/{id}` returns the status. Show the result: "Tu cuenta y tus datos fueron eliminados el <fecha>."

## Screens

* **Privacidad y datos** (new, from Mi cuenta): rows "Cómo usamos tus datos" (policy), "Consentimientos" (M4 screen), "Descargar mis datos", "Eliminar cuenta".
* **Eliminar cuenta**: what will be deleted and what is kept as legal evidence, the consequence that bank data and goals cannot be recovered, a typed confirmation "ELIMINAR", then fresh login.
* **Centro de ayuda**: static FAQ in Spanish plus the contact email.
* Terms and privacy links shown at registration point to the same policy endpoint (M1 links them in the Keycloak theme).

## Work plan (one branch each, from `develop`)

1. `feature/audit-store-append-only` (Phase 1): table, roles, trigger, hash chain, recorder, verify command.
2. `feature/keycloak-events-import` (Phase 1).
3. `feature/privacy-policy-and-my-data` (Phase 4).
4. `feature/account-deletion` (Phase 4).
5. `feature/privacy-screens` (Phase 4).

## Tests

* As the app role, `UPDATE` and `DELETE` on `audit.events` fail. Removing a row breaks `audit verify`.
* The recorder rejects a meta map containing `email` or `amount`.
* End to end deletion on a seeded user leaves zero rows for that user in `identity`, `backup`, `bank`, and consents only as revoked evidence, and the Keycloak user no longer exists.

## Done when

* HU-027 passes at Gate B. HU-028 and HU-029 pass at Gate E.

## Ask before

* Changing retention periods, the policy text, or what is kept after deletion.
