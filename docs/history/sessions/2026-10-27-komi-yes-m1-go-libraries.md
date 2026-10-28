---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-67, SCRUM-6]
branch: chore/add-identity-go-libraries
tool: Claude Code
pr: none
status: done
---

# Add the two Go libraries M1 needs (golang-jwt, testcontainers-go)

## Instruction

Build module M1 Identity from `docs/modules/M01-identity.md`. In this session: branches 1 (realm as code), 3 (JWT middleware) and 5 (mobile sign-in), "since they dont need any other branch to be finished". Changes to files owned by M0 go in separate chore pull requests for Sofia to review.

## What was done

* `services/api/go.mod` and `go.sum`: added `github.com/golang-jwt/jwt/v5` v5.3.1 and `github.com/testcontainers/testcontainers-go` v0.44.0. Both are marked `// indirect` until the M1 branches import them. `golang.org/x/crypto` moved from v0.53.0 to v0.54.0 as a dependency of testcontainers.
* `docs/adr/0001-stack.md`: one row per library, saying why it was added.

## Result

* Contract generation, `go vet`, golangci-lint (0 issues) and `go test ./...` pass for both Go modules.
* GNU make is not installed on this machine, so the Makefile recipes were run as the same commands by hand.

## Decisions

* golang-jwt instead of hand-written JWT parsing. `WithValidMethods(["PS256"])` rejects every other algorithm before a key is looked up. The JWKS cache is M1's own small code.
* testcontainers-go so the Keycloak integration tests start a real Keycloak 26.8.1 the same way on Windows (Docker Desktop) and in CI.
* Both libraries are in one chore PR because they serve the same module and land together. The ADR rule asks for one PR per library, so this is called out in the PR description.

## Problems

* None.

## Next step

* `feature/keycloak-realm-as-code` and `feature/api-jwt-middleware` build on this branch.
