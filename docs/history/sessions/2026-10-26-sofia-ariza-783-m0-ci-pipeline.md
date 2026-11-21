---
date: 2026-10-26
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: chore/ci-pipeline
tool: Claude Code
pr: #9
status: done
---

# M0 Step 6: pull request CI with path filters, session log check and coverage

## Instruction

Sofia asked to "proceed with step 6". The M0 prompt says:
* "`.github/workflows/ci.yml` on pull requests to `develop` and `main`: install, `make generate`, lint (ESLint, golangci-lint, redocly), unit tests (Jest, `go test ./...`), build of both Go services, `expo prebuild` sanity check, upload coverage."
* "A CI step that fails a pull request when it changes files outside `docs/` and adds no new file under `docs/history/sessions/`, with the message 'Add the session log (see CLAUDE.md, Project history log)'."
* "Path filters so a mobile only change does not run Go jobs and the other way around."

## What was done

* **`scripts/ci-changes.mjs`.** It reads the PR diff and decides two things: whether the mobile and Go jobs run, and whether a new session log is missing.
  * It is plain Node, with `node:test` tests in `scripts/ci-changes.test.mjs` (14 tests).
  * It replaces a third-party filter action.
* **`.github/workflows/ci.yml`.** Jobs:
  * changed areas, and the session log check;
  * format and scripts (Prettier, script tests);
  * mobile: generate, ESLint, tsc, Jest with coverage;
  * Expo prebuild, for Android and iOS;
  * Go: generate, vet, golangci-lint, `go test -race` with coverage, the migration integration test on a Postgres service, `make build-go`, and `docker build` of both images.
  * "CI passed" waits for every job, so it is the one required check. Skipped jobs count as passed.
* **`.github/actions/setup-pnpm`:** Node 22.20.0, pnpm through corepack, a cached store and a frozen install.
* **Action pins.** Only GitHub's own actions, each pinned by commit SHA; each version has been out at least 7 days.
* **Makefile:**
  * `format-check` (moved out of `lint-mobile`; `make lint` still runs it);
  * `build-go` (into `bin/`);
  * `test-integration`;
  * `GOTESTFLAGS` and `JESTFLAGS`.
* **Docs:**
  * README CI section;
  * a CI table in the stack ADR;
  * `make test-integration` and an antivirus troubleshooting row in `docs/local-dev.md`.

## Result

* **Locally:**
  * `make lint`, the Go tests, the script tests (21) and Jest (256 tests, 50 snapshots) pass;
  * `make build-go` and `make test-integration` pass;
  * actionlint finds no issues.
* **On GitHub, first push without this log.** "Session log" failed with "Add the session log (see CLAUDE.md, Project history log)", so "CI passed" failed. Every other job passed on the first try:
  * mobile, 73 s;
  * prebuild, 31 s;
  * Go, 5 min 12 s without cache (race tests, integration test and both Docker images included).
* **Coverage.** The `coverage-mobile` and `coverage-go` artifacts were uploaded. Jest covers about 97 % of lines.
* Pull request #9, opened as a draft until CI is green with this log.
* **Second push, with this log.** All 7 checks passed, including "CI passed". With caches warm the Go job took 2 min 9 s, and the whole run about 2.5 minutes.

## Decisions and problems

* **Coverage stays on GitHub** (Sofia's choice): artifacts plus totals in the run summary. No outside service and no secret.
* **Path filters per job, not per workflow.** Otherwise a skipped workflow would leave the required check pending forever.
* **The session log check is its own job.** A missing log does not stop the code jobs, so their feedback still arrives.
* **`go build ./...` left a binary in the source folder** for a module with only one main package. `build-go` now writes to the gitignored `bin/`.
* **Antivirus holds Go tools on this laptop.** Avast behavior checks hold freshly built, unsigned Go tools, so `go test -coverprofile` (through `covdata`) and `go run actionlint` hung.
  * actionlint ran from its Docker image instead.
  * Coverage is measured in CI.
  * A troubleshooting row explains it.

## Next step

* Merge PR #9.
* Then Sofia adds **CI passed** as a required status check on `develop` and `main`.
* The path filters get a real check on the next docs-only or mobile-only PR.
* M0 is then complete for Gate A.
