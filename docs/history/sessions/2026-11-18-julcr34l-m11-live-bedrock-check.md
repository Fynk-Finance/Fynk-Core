---
date: 2026-11-18
developer: Julián Castiblanco
github: JulCR34l
module: M11
jira: [SCRUM-38]
branch: test/recommendations-live-bedrock
tool: Claude Code
pr: none
status: done
---

# Add a live Bedrock check for the manual review of 20 answers

## Instruction

Julián asked what he has to do to try the AI now that the code is merged: "que debo de hacer ahora para probar la ia, o dime que falta". Juan Pablo shared AWS access for the team.

## What was done

* Review of staging: every Deploy Staging run fails before deploying, at "Could not assume role with OIDC: The web identity token provided could not be validated" (M14), and the API task has no settings of M11 and M15 yet. Amazon Nova Lite is available in-region in us-east-2, the project's region, and the Bedrock permission of the task uses that region.
* Checked that #409 reached `develop`: it was merged into the branch of #387 before #387 was squashed, so both changes are in `develop`.
* `internal/recommendations/live_bedrock_test.go`, behind the `bedrock` build tag (not in `make test`): calls the real model with the five advisor fixtures, four times each, runs every answer through the post checks of `POST /recommendations`, and writes a Markdown report with the raw text of each attempt, its latency and tokens, the verdict and what the phone would show. It uses us-east-2 when no region is configured and fails with a clear message when every call fails.

## Result

* Go: `go vet -tags bedrock` and golangci-lint with `--build-tags bedrock` report no issues; `go test` without the tag is unchanged.
* The check was not run here: this session cannot reach AWS (the egress proxy refuses bedrock-runtime.us-east-2.amazonaws.com). Julián runs it on his computer.
* Pull request: opened against `develop`.

## Decisions and problems

* The AWS access keys were shared in plain text in the team chat. They were not used in this session and are not written anywhere in the repository. Rotating them after the tests and giving each person their own IAM user with only the permissions they need is safer.

## Next step

Julián runs the check with `aws configure`, reviews the 20 answers in the report and marks them, then the same review in staging when M14 fixes the deploy.
