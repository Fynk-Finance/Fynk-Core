---
date: 2026-11-07
developer: Juan Pablo Contreras
github: juancontrerasp
module: M13
jira: [SCRUM-42, SCRUM-46, SCRUM-48, SCRUM-73, SCRUM-74]
branch: feature/m13-m14-review-followups
tool: Claude Code
pr: none
status: done
---

# Follow-up review fixes for M13, M14, and M16

## Instruction

Follow up on Claude Code's M4 and M5 end-to-end review feedback:
1. Review Daniel's M16 Banco Demo PR stack (#310 → #318) and #324.
2. Note staging deploy failure cause (missing `AWS_ACCOUNT_ID` repository secret).
3. Wire staging ECS API task variables from Secrets Manager in Terraform.
4. Update Caddy egress routes for Bancolombia (`/bancolombia-auth/*` and `/bancolombia-api/*`) per ADR 0003.
5. Add `consent.failed` audit event type in `internal/audit` and record it when pending consents expire after 24h.
6. Create `compliance.Privacy` screen (`CfgPrivacidad`) embedding `<ConnectedAccountsSection />` from `@modules/consents`.

## What was done

* **M16 Review:** Reviewed and approved PR #324 (skips history timing test under race detector) and stack PRs #310, #311, #312, #313, #315, #316, #317, and #318.
* **M14 Caddy egress:** Replaced `/bancolombia/*` in `services/caddy/Caddyfile` and `services/caddy/Caddyfile.local` with `/bancolombia-auth/*` and `/bancolombia-api/*` per ADR 0003 section 5 step 4.
* **M14 Terraform:** Added secret shells and wired `BANK_SIGNER_KMS_KEY_ID`, `BANK_FINGERPRINT_KMS_KEY_ID`, `BANK_REDIRECT_URI`, `BANCO_DEMO_CLIENT_ID`, `BANCO_DEMO_ISSUER`, and `BANCO_DEMO_AUTHORIZE_URL` into the staging ECS API task definition. Formatted and validated Terraform with `terraform validate`.
* **M13 Audit:** Added `ConsentFailed = "consent.failed"` to audit ports, metadata allow-list validation, and tests. Updated M4 `FailStalePending` to emit `consent.failed` audit records.
* **M13 Privacy Screen:** Created `PrivacyScreen` (`CfgPrivacidad`) in `apps/mobile/src/modules/compliance/` embedding `<ConnectedAccountsSection />` from `@modules/consents`, with unit test suite in `PrivacyScreen.test.tsx`.

## Result

* `make lint-go`, `make test-scripts`, `make format-check`, `terraform validate`, and mobile Jest tests all pass 100%.
