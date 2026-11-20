---
date: 2026-11-19
developer: Juan Pablo Contreras
github: juancontrerasp
module: M14
jira: [SCRUM-46, SCRUM-48]
branch: fix/infra-deploy-staging-workflow
tool: Antigravity
pr: pending
status: done
---

# M14: Fix Deploy Staging Workflow for SCP-Restricted Account & Codegen

## Instruction

Juan Pablo Contreras requested fixing `.github/workflows/deploy-staging.yml` after the OIDC role assumption failed on merge to `develop` due to the AWS Organization SCP blocking `iam:CreateOpenIDConnectProvider`.

## What was done

* Updated `.github/workflows/deploy-staging.yml`:
  * Switched `aws-actions/configure-aws-credentials` from OIDC `role-to-assume` to `aws-access-key-id` and `aws-secret-access-key` (`secrets.AWS_ACCESS_KEY_ID` / `secrets.AWS_SECRET_ACCESS_KEY`), and removed unused `id-token: write`.
  * Added `actions/setup-go`, `./.github/actions/setup-pnpm`, and `make generate-go` before building `services/api` so `internal/*/http/api.gen.go` is present during Docker build.
  * Updated the smoke test domain from `fynk.club` to `habenly.site` (`STAGING_DOMAIN`).

## Verification

* `node --test scripts/*.test.mjs` passed (including `workflow-pins.test.mjs`).
* `pnpm exec prettier --check .github/workflows/deploy-staging.yml docs/history/sessions/2026-11-19-juancontrerasp-m14-fix-deploy-staging-workflow.md` passed.
