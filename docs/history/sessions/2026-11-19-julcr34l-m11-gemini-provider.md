---
date: 2026-11-19
developer: Julián Castiblanco
github: JulCR34l
module: M11
jira: [SCRUM-38]
branch: feature/recommendations-gemini-provider
tool: Claude Code
pr: none
status: done
---

# Add Gemini and OpenAI compatible models as an alternative to Bedrock

## Instruction

With Bedrock blocked by the AWS account and the demo the next day for about 50 people, Julián chose Gemini over a local Ollama model: "descartemos entonces la opción de Ollama, por ahora, dejemos la rama y el PR, por si acaso, entonces iremos por Gemini". He created a key in Google AI Studio and asked to implement it.

## What was done

* Diagnosis of AWS: account verification in progress (up to two days), Nova Lite quotas at 0 and not adjustable from Service Quotas, CloudShell refused. Recorded in ADR 0009.
* `internal/recommendations/openaicompat`: an `advisor.Model` adapter on `POST <base>/chat/completions` (Gemini's OpenAI compatible endpoint, Groq, OpenRouter, Ollama), with `response_format` set to `advisor.OutputSchema` (or `json_object`) and an optional `reasoning_effort`. The key goes only in the `Authorization` header; errors carry the provider's message, never the key.
* `module.go`: `RECOMMENDATIONS_PROVIDER` (`bedrock` by default, `gemini` or `openai`), `RECOMMENDATIONS_API_KEY` (or `GEMINI_API_KEY`), `RECOMMENDATIONS_API_BASE_URL`, `RECOMMENDATIONS_RESPONSE_FORMAT` and `RECOMMENDATIONS_REASONING_EFFORT`. On Gemini the model is `gemini-4-hydrogen` with `low` reasoning by default. A provider without a key answers an error, so the service falls back to the templates.
* `live_bedrock_test.go`: `-provider=gemini`, through the same settings and model choice as the API.
* ADR 0009: the finding, the decision, the data that leaves AWS and the capacity for 50 people.

## Result

* Go: `go vet` (with and without the `bedrock` tag), golangci-lint with the repository config and `go test -race` pass for `internal/recommendations/...` and `internal/app`.
* Not run here against the real Gemini API: the key stays on Julián's computer and this session cannot reach Google. Julián runs the live check.
* Pull request: opened against `develop`.

## Decisions and problems

* One OpenAI compatible adapter instead of a Gemini SDK: the same code works with Gemini, Groq, OpenRouter and Ollama, so #421 (Ollama) is not needed.
* The aggregate snapshot leaves AWS with Gemini. It has no personal data, but the team has to accept it (ADR 0009).
* In staging the key goes in Secrets Manager like the other secrets of the API task (M14), and the API needs outbound access to Google.

## Next step

Julián runs the live check with `-provider=gemini` and reviews the 20 answers. Then the key is set where the demo backend runs.
