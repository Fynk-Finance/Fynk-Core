---
date: 2026-10-28
developer: Julián Castiblanco
github: JulCR34l
tool: Claude Code
pr: none
status: done
module: M11
jira: [SCRUM-38]
branch: chore/add-aws-sdk-bedrock
---

# Add the AWS SDK for the Bedrock adapter

## Instruction

Julián asked Claude (claude.ai, Fynk project, session linked to the repository zip): "soy la persona 6, que hace la parte de analytics AI and investment, ayúdame a realizarlo con la información que hay en el repo y con respecto al módulo". Claude followed `docs/modules/M10-analytics.md`, `M11-recommendations.md` and `M15-investment.md`, `00-shared-contracts.md` and the design sources, and built the three modules as one stack of branches. This branch is the dependency step that the conflict rules ask to keep in its own pull request.

## What was done

* `services/api/go.mod` and `go.sum`: `github.com/aws/aws-sdk-go-v2` v1.47.5, `config` v1.33.12 and `service/bedrockruntime` v1.63.8, plus their indirect modules (smithy-go, credentials, sts, sso…).

## Result

* No code uses it yet; the next branch does.

## Decisions and problems

* The build environment could not reach proxy.golang.org, so the versions and the 32 `go.sum` lines were resolved from the upstream module sources on GitHub with Go 1.25. The hashes do not depend on the Go version, but `go mod tidy` with Go 1.27 should be run once locally to confirm nothing else changes. Needs M0's review (dependencies).

## Next step

* `feature/recommendations-endpoint`.
