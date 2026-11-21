---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62]
branch: chore/run-backup-integration-tests
tool: Claude Code
pr: none
status: done
---

# Run the backup module's integration tests in CI

## Instruction

After the M2 plan was approved, Daniel said "continue". This is the first step of the backend stack in that plan.

## What was done

* **`Makefile` › `test-integration`:** now runs `./internal/backup/...` with the other integration packages. Before, it listed only `platform/migrate` and `identity/postgres`, so M2's Postgres tests would never run in CI.

## Result

* `go list -tags integration ./internal/backup/...` resolves. The packages hold no integration tests yet; they come with the backup store.

## Decisions and problems

* **The whole `internal/backup/...` tree, not only `backup/postgres`.** That way the HTTP integration tests are included too.
* **`-p 1`:** backup's integration tests migrate the `identity` schema too, because they activate a real device. If the packages ran in parallel, each would drop the schema under the other. Running them one at a time costs a few seconds.
* **`Makefile` belongs to M0,** so this is its own small pull request for Sofia.

## Next step

The backup store and endpoints add their integration tests, and this target picks them up.
