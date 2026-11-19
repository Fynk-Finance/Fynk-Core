---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M14
jira: [SCRUM-48]
branch: fix/deploy-pin-actions
tool: Claude Code
pr: "#404"
status: done
---

# The deploy and plan workflows use actions pinned to a commit

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Juan Pablo's module, so Juan Pablo reviews it as CODEOWNER.

## What was done

* `.github/workflows/deploy-staging.yml`, `.github/workflows/terraform-plan.yml`: six actions pinned.
* Test: `scripts/workflow-pins.test.mjs` (new), part of `make test`.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,878 tests, Go and script tests).
* Pull request: #404.
* Every `uses:` in `.github/` is a commit or a local action.
* The test was run before the change and listed the seven unpinned uses.

## Decisions and problems

* The pins keep the major version each workflow already used. Moving the deploy to the newer versions `ci.yml` uses is a separate change.
* Not verified: I cannot run the deploy workflow. The first deploy after the merge is the real check.
* Not done, the other items of BUG-32. The Caddy user data needs AWS to test. The duplicate audit imports need a Postgres to test, and CI does not run the audit integration tests.

## Next step

Juan Pablo reviews the pull request and watches the next deploy.
