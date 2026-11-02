---
date: 2026-11-01
developer: Juan Pablo Contreras
github: juancontrerasp
module: M13
jira: [SCRUM-42, SCRUM-43]
branch: feature/privacy-policy-and-my-data
tool: Antigravity
pr: none
status: done
---

# Privacy policy and my data export (Ley 1581 de 2012)

## Instruction

Implement the Phase 4 compliance and privacy backend endpoints for Module M13 per `docs/modules/M13-compliance.md` and Jira SCRUM-42 (HU-028) & SCRUM-43 (HU-029):
1. `GET /privacy/policy`: public endpoint serving the active data treatment policy in Spanish (Markdown), detailing the data controller (Fynk Finance S.A.S.), authorized purposes (personal finance, informative recommendations, security/fraud prevention), data categories and storage locations following the Zero-Knowledge architecture in `CLAUDE.md`, data subject rights under Ley 1581 de 2012, contact channels, and response times (10 working days for queries, 15 working days for claims).
2. `GET /privacy/my-data`: authenticated endpoint exporting all cloud data stored for the authenticated user (Keycloak profile, registered devices, consents with audit evidence, bank links without token fingerprints, backup record count and size, and immutable audit events).

## What was done

* **OpenAPI Contract (`contracts/modules/privacy.yaml`):**
  * Added `GET /privacy/policy` returning `PrivacyPolicy` with version `2026-11-v1`, SHA-256 integrity hash, response time guarantees, and full Spanish Markdown body.
  * Added `GET /privacy/my-data` returning `PrivacyDataExport` with schemas prefixed by `Privacy` per contract lint rules (`PrivacyProfileData`, `PrivacyDeviceData`, `PrivacyConsentData`, `PrivacyBankLinkData`, `PrivacyBackupData`, `PrivacyAuditEventData`).
  * Executed `make generate` to regenerate oapi-codegen Go server (`services/api/internal/privacy/http/api.gen.go`) and mobile TypeScript types (`apps/mobile/src/shared/api/schema.gen.ts`).
* **Identity Ports (`services/api/internal/identity/ports/ports.go`):**
  * Exported `UserProfile`, `UserProfileReader`, `NewUserProfileReader`, and `ErrUnavailable` to allow external modules (like `privacy`) to retrieve Keycloak profiles safely through module boundaries without violating `depguard`.
* **Privacy Module Implementation (`services/api/internal/privacy/`):**
  * `policy.go`: defined `CurrentPolicy()` with complete Colombian legal text under Ley 1581 de 2012 and Decreto 1377 de 2013, calculating SHA-256 checksum dynamically.
  * `collector.go`: implemented `Collector` reading user data from PostgreSQL schemas (`identity.devices`, `consents.consents`, `bank.links`, `backup.records`, `backup.recovery_keys`, and `audit.events`) while strictly suppressing any sensitive data or credential fingerprints (`token_fingerprint` omitted).
  * `server.go`: implemented `httpapi.StrictServerInterface` for `PrivacyHealth`, `GetPrivacyPolicy`, and `GetMyData`.
  * `module.go`: wired `New` and mounted routes under `requireAuth`, allowing public access to `/privacy/health` and `/privacy/policy` while protecting `/privacy/my-data`.
* **Tests:**
  * Added comprehensive unit tests in `services/api/internal/privacy/privacy_test.go` verifying policy content, legal requirements, SHA-256 integrity, data export aggregation, unauthenticated vs authenticated access, and stub route fallthrough.
  * Updated `services/api/internal/app/app_test.go` to test that `/v1/privacy/policy` is public and returns 200, while `/v1/privacy/deletion-requests` returns 501 `not_implemented`.

## Result

* `make lint-go`: clean (0 issues).
* `make test-go test-scripts`: clean (100% passed).
* `make format-check`: all files formatted cleanly.

## Decisions and problems

* **Depguard isolation:** Direct imports of `internal/identity/kcadmin` from `internal/privacy` were rejected by `depguard`. Created `UserProfileReader` interface and `NewUserProfileReader` constructor in `internal/identity/ports` so `privacy` accesses identity only through sanctioned port boundaries.
* **Sensitive credential suppression:** Per `M13-compliance.md` specification "bank links without fingerprints", the collector SQL query for `bank.links` explicitly selects only public metadata (`id, provider, consent_id, status, created_at, last_refreshed_at, revoked_at`) and excludes `token_fingerprint`.
* **Misspell linter on Spanish legal copy:** Marked the raw policy Markdown constant with `//nolint:misspell // Spanish copy complying with Ley 1581` to avoid false positives on legitimate Spanish legal vocabulary.

## Next step

Proceed to Step 4 of Module M13: `feature/account-deletion` (implementing `POST /privacy/deletion-requests` with step-by-step cascade deletion and evidence retention).
