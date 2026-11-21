---
date: 2026-10-26
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: feature/shared-contracts-api
tool: Claude Code
pr: none
status: done
---

# M0 Step 2 (API half): platform packages, module registry and stubs

## Instruction

Same session as the monorepo skeleton. Step 2 of the M0 prompt for the backend: "`internal/app/modules.go` with all 8 modules already listed, each package returning a stub module whose routes answer `501` with problem JSON. Stubs for `audit.Recorder` (logs a redacted line), `auth.Require` (accepts `dev-token` only when `APP_ENV=local`) and `ConsentChecker` (always true in local)", plus the redacting logger, RFC 9457 problems, `/healthz` and `/readyz`. Step 2 was split into this pull request and `feature/shared-contracts-mobile`.

## What was done

* `internal/platform/`:
  * `config` (APP_ENV is required, so a missing value never turns on local shortcuts);
  * `log` (slog JSON handler that masks the 10 sensitive keys, ignoring case and dashes, inside groups and LogValuers);
  * `problem` (RFC 9457 with a stable `code`);
  * `clock`;
  * `requestid` (reuses a safe `X-Request-Id` or generates one);
  * `db` and `redis` (lazy, errors never echo the URL);
  * `auth`;
  * `module`.
* `platform/auth`: `Require`, `UserFrom` and `User` as in the contract. Token checking goes through a `Verifier` installed at startup, and fails closed until one is installed. `DevVerifier` accepts `dev-token` only in local. M1 adds the Keycloak verifier without editing platform.
* `platform/module`: `Module`, `Deps` and the `Stub` every module uses for now (auth required, then 501 problem JSON). `internal/app/module.go` re-exports them as type aliases.
* `internal/audit/ports`: `Recorder`, `Event`, the 20 required event types and `LogRecorder`.
* `internal/consents/ports`: `ConsentChecker` and `LocalChecker` (active in local, fails closed elsewhere).
* One `module.go` per backend module, claiming the path prefixes of the shared contracts, section 5.
* `internal/app`: `All()` with the 8 modules in the contract's order, and `NewRouter` (request id, access log without query strings, recoverer, problem JSON 404 and 405, `/healthz`, `/readyz`, `/v1`).
* `cmd/api/main.go`: wiring and graceful shutdown.
* pgx v5.11.0 and go-redis v9.23.0 recorded in `docs/adr/0001-stack.md`.

## Result

* `go test ./...` passes: redaction (every key, case, groups, `With`, LogValuer), problem writer, auth (local only, fails closed), config, request id, audit stub, consent stub, 8 modules listed once, 501 on every endpoint group, 401 without a token, `healthz`, and `readyz` 200 and 503.
* golangci-lint 0 issues, with depguard active.
* Manual run with `APP_ENV=local`:
  * `/healthz` 200;
  * `/v1/consents/x` 501 with `dev-token` and 401 without it;
  * `/readyz` 503 "Unavailable: postgres, redis";
  * the access log line has no query string.
* Not checked: `/readyz` 200 against a real Postgres and Redis, because Docker Desktop was not running. The unit tests cover it with fakes.
* Pull request: opened right after this log.

## Decisions and problems

* Import cycle: `internal/app` imports every module, so `Module` and `Deps` live in `internal/platform/module` and `internal/app` re-exports them.
* The stub routes require a token, so a module that lands later keeps the same auth behavior.
* `/readyz` reports only the names of the failing dependencies, because driver errors can include hosts and user names.
* On Windows `go test` sometimes prints "unlinkat … being used by another process" after the tests pass. It is the antivirus holding the test binary, not a failure.

## Next step

Review and merge this pull request and `feature/shared-contracts-mobile` (they are independent). Then Step 3, `feature/api-contract-pipeline`.
