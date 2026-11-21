---
date: 2026-10-28
developer: Juan Carlos Leal
github: JuanLeal05
module: M4
jira: [SCRUM-22, SCRUM-20]
branch: feature/consent-revocation-with-provider
tool: Claude Code
pr: none
status: done
---

# Revoke a consent and notify the entity (M4 step 2)

## Instruction

After M5 step 1, the developer asked to continue with M4 step 2 and whether M4 would be complete after it. Key sentence: "Continue with M4 Step 2. Before doing so, after that is done, is M4 complete or is there anything missing from it?" The answer, given before starting: the backend is complete except for the bank wiring, which comes with M5 step 2's signer. Steps 3 and 4 (mobile) and the Gate C check on staging remain.

## What was done

* Branch stacked on #46 (M4's endpoints) and #52 (the bank port). Their edits to M0's `app_test.go` conflicted as expected; the merge removes both modules' paths.
* Contract: `POST /consents/{id}/revoke` (`200` revoked, `404`, `409 consent_not_revocable`) and `providerNotifiedAt` on every consent.
* Domain:
  * `Revoke` ends an active or pending consent at once; revoking twice returns it unchanged;
  * an expired or failed consent cannot be revoked;
  * `NoticeFailed` schedules the next try in 10 minutes, and none after 24 hours;
  * `NewPending` now receives the provider's scopes, which the service reads from `bank/ports`.
* Service:
  * `Revoke` stores the revocation, audits `consent.revoked`, then tells the entity right away (5 s limit);
  * `NotifyDue` and `RunNotify` are the retry job, checking every minute;
  * `BankRevoker` reaches M5's installed revoker at call time.
* Store: migration 3 adds `provider_notified_at`, `next_notify_at` and `notify_attempts` to the consent row, plus a check that a revoked consent has its date. `ClaimNotices` uses `FOR UPDATE SKIP LOCKED`.
* `bank/ports` (M5, same developer): `InstallRevoker` and `InstalledRevoker`, the same pattern as `auth.Install`. Until M5 step 2 installs the real revoker, every notice fails with `provider_unavailable` and is retried.
* Tests:
  * the HU-008 criteria;
  * the module test: after revoke, `Active` is false at once and a stubbed M5 query answers `409 consent_revoked`;
  * retries every 10 minutes and stopping after 24 hours;
  * revoking twice notifies once, and a pending consent is revoked without calling the entity;
  * only the owner can revoke;
  * scopes come from `bank/ports`;
  * Postgres tests for revoke, claim and confirm.

## Result

* Tests: `make lint` and `make test` pass. The 8 store integration tests pass on Postgres 16 in Docker.
* By hand against the real API and Postgres: `cmd/migrate` reaches version 3. Revoking gives `revoked` at once; revoking again gives the same consent; the notice fails (no revoker installed yet) and is scheduled to retry.
* Pull request: opened right after this log.
* Size: about 880 lines, about 430 of them tests.

## Decisions and problems

* The notice state lives on the consent row, not in a new table. It is consent metadata, which "Where data lives" already keeps in the cloud.
* The first manual run showed the error code as `[REDACTED]`, because M0's logger masks any key named `code` (it treats it as an authorization code). The key is now `error_code`.
* The real notice reaches Banco Demo only after M5 step 2 installs the revoker with the `private_key_jwt` signer.
* Bancolombia consents are refused now, because it is not in M5's provider list until its spike.

## Next step

M5 step 2: `feature/bank-link-with-par-and-pkce`, which installs the real revoker.
