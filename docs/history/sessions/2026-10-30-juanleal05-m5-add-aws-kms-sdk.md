---
date: 2026-10-30
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-44]
branch: chore/add-aws-kms-sdk
tool: Claude Code
pr: none
status: done
---

# Add the AWS KMS SDK for the bank keys

## Instruction

The developer approved the M0 changes of step D: "Yes, do it and create the stack with the PRs, Sofia and Juan Pablo must be called to review either way". This layer adds only the dependency, as CLAUDE.md asks (a library is its own small pull request, reviewed by M0).

## What was done

* `services/api/go.mod` and `go.sum`: `github.com/aws/aws-sdk-go-v2/service/kms v1.62.1`, in the direct `require` block next to M11's AWS modules. Nothing else in `go.mod` changes.

## Result

* `go mod verify` and `go build ./...` pass.
* Pull request: not opened yet. 3 lines.
* No code uses it yet; the next layer does.

## Decisions and problems

* **Version v1.62.1:** the newest KMS module, and it needs no change to the AWS core (`v1.47.5`) or smithy already pinned by M11. The two previous versions weren't needed. It was published on 27 Oct 2026; for Go modules ADR 0001 only asks for exact versions.
* **Direct `require`, no code yet,** as M11 did in #109. CI doesn't run `go mod tidy`, so it stays until the next layer imports it.

## Next step

`feature/bank-kms-wiring`.
