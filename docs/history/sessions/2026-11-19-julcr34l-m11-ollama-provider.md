---
date: 2026-11-19
developer: Julián Castiblanco
github: JulCR34l
module: M11
jira: [SCRUM-38]
branch: feature/recommendations-ollama-provider
tool: Claude Code
pr: none
status: done
---

# Add a local Ollama model as an alternative to Bedrock

## Instruction

Julián ran the live Bedrock check on his computer and the AWS account could not invoke the model. With one day left before the demo he asked for a solution: "necesito esa ia", "esperar 2 días no me sirve en estos momentos, qué me recomiendas hacer".

## What was done

* Helped run the live check on Windows: installed Go, Node, pnpm and the AWS CLI with winget, generated the API code by hand (no `make` in Git Bash), and built the test in a folder of the project (`GOTMPDIR`) because Smart App Control blocks unsigned programs in the Windows temporary folder.
* Diagnosis of the AWS account (nothing in the code): `ValidationException: Operation not allowed` in us-east-2, `Your account is currently being verified` and then the same error in us-east-1, and Service Quotas at 0 for Nova Lite (tokens per day and cross-region requests and tokens per minute). New account on the Free plan.
* `internal/recommendations/ollama`: an `advisor.Model` adapter on a local Ollama server (`POST /api/chat`, no streaming, `format` set to `advisor.OutputSchema`).
* `module.go`: `RECOMMENDATIONS_PROVIDER` (`bedrock` by default, or `ollama`), `RECOMMENDATIONS_OLLAMA_URL` (default `http://localhost:11434`) and `qwen2.5:3b` as the default model on Ollama. Ollama uses one attempt of 25 s so the answer arrives before the server's 30 s write limit. An unknown provider stays on Bedrock.
* `live_bedrock_test.go`: `-provider=ollama`, `-model` and `-ollama-url`, through the same settings and model choice as the API.
* ADR 0009 records the Bedrock finding and the decision.

## Result

* Go: `go vet` (with and without the `bedrock` tag), golangci-lint with the repository config and `go test -race` pass for `internal/recommendations/...` and `internal/app`.
* Not run here against a real Ollama: this session cannot download Ollama models. Julián runs it on his computer.
* Pull request: opened against `develop`.

## Decisions and problems

* The prompt, the snapshot validation, the post checks and the fallback are the same for both providers, so rule 5 holds. With Ollama the aggregate snapshot does not leave the computer.
* `docker-compose.yml` and `services/api/.env.example` belong to M0 and are not touched: the local demo uses a `docker-compose.override.yml` that is not committed.
* The AWS keys shared in the team chat are a single IAM user for everyone; rotating them after the demo is advised.

## Next step

Julián installs Ollama, pulls `qwen2.5:3b`, runs the live check with `-provider=ollama`, and starts the local stack with the override file. In parallel, M14 asks AWS to raise the Nova Lite quotas.
