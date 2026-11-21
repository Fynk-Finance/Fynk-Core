---
date: 2026-11-15
developer: Daniel Palacios
github: Komi-yes
module: M11
jira: [SCRUM-38]
branch: fix/recommendations-bedrock-attempt-timeout
tool: Claude Code
pr: "#387"
status: done
---

# Each model call ends before the server cuts the answer

## Instruction

After the code analysis of the whole repository, Daniel asked to "fix the bugs with the simple fixes" in the other modules too, and to "push that fixes with their PRs" so each owner reviews them. This is BUG-22 of that analysis, in Julián's module.

## What was done

* `internal/recommendations/advisor/service.go`: `Config` gets `AttemptTimeout` (12 s in `DefaultConfig`). `Generate` gives each model call its own context with that limit.
* Tests: `TestASlowModelFallsBackBeforeTheRequestEnds` (a model that never answers gives the fallback after two attempts, long before the request ends) and `TestDefaultAttemptsEndBeforeTheServerWriteLimit` (attempts times limit is under 30 s).

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,878 tests, Go and script tests).
* golangci-lint with `--build-tags integration` reports 6 issues in files this branch does not touch. They are on `develop` too.
* Pull request: #387.
* A slow Bedrock now ends in `fallback: true` after 24 s at most. Before, the server's 30 s write limit cut the connection first.

## Decisions and problems

* 12 s per attempt is my choice: two attempts must end under the 30 s `WriteTimeout` of `cmd/api/main.go`. Julián should confirm it against real answer times.
* Before the change the new tests do not build, because the field does not exist. I did not write a test that hangs for 30 s against the old code.
* The daily slot is still spent when the answer is a fallback. That is a product decision, so it is not changed here.
* The change is in another person's module. Julián reviews it as CODEOWNER.

## Next step

Julián reviews the pull request and confirms the 12 s.
