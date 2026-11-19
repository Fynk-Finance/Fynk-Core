# ADR 0009: A local model for the recommendations when Bedrock is blocked

* Status: proposed
* Date: 2026-11-19
* Owner: M11 AI recommendations (Julián Castiblanco / `@JulCR34l`)
* Jira: SCRUM-38 (HU-024)

---

## 1. Context (finding for the jury)

M11 writes the text of Recomendaciones with Amazon Nova Lite on Bedrock (`amazon.nova-lite-v1:0`, us-east-2). On 19 Nov 2026 the project's AWS account could not invoke any model:

* `aws bedrock-runtime converse --region us-east-2 --model-id amazon.nova-lite-v1:0 …` answers `ValidationException: Operation not allowed`. In us-east-1 it first answered `AccessDeniedException: Your account is currently being verified`, then the same `Operation not allowed`.
* Service Quotas in us-east-2 show **0** for "Model invocation max tokens per day for Amazon Nova Lite" and for the cross-region requests and tokens per minute. The account is new, on AWS's Free plan, which also excludes cross-Region features.
* IAM is not the cause: the identity is valid (`aws sts get-caller-identity`) and the error is not `AccessDenied`.

The way out on AWS is a quota increase or a support case, which can take days for a new account or be refused. The demo is the next day.

The code is not affected: when the model fails, `POST /recommendations` answers `fallback: true` and the phone shows its templates with the same numbers (architecture rule 5).

## 2. Decision

The model of M11 can be chosen by configuration:

| Setting | Bedrock (default) | Ollama (local demo) |
| --- | --- | --- |
| `RECOMMENDATIONS_PROVIDER` | `bedrock` or empty | `ollama` |
| `RECOMMENDATIONS_MODEL_ID` | `amazon.nova-lite-v1:0` | `qwen2.5:3b` (or `qwen2.5:7b` with 16 GB of RAM) |
| Where the model runs | AWS, with the task role | The same computer as the API (`RECOMMENDATIONS_OLLAMA_URL`, default `http://localhost:11434`) |
| Attempts | 2 × 12 s | 1 × 25 s, so the answer arrives before the server's 30 s write limit |

`internal/recommendations/ollama` is an `advisor.Model` adapter on Ollama's `/api/chat`, with the output forced to `advisor.OutputSchema` through Ollama's structured outputs. Nothing else changes: the same system prompt, the same snapshot validation, the same post checks (amounts, percents, forbidden products, factKeys) and the same fallback.

## 3. Consequences

* Rules kept: code calculates and the model only writes (rule 5); the model only receives the aggregate snapshot, and with Ollama it does not even leave the computer (rule 2 and "Aggregate snapshot for the AI: in transit only").
* Bedrock stays the provider of staging and production. When AWS raises the quotas, nothing has to change.
* Ollama is for a local demo: the API, Keycloak and the phone run on one computer (`make dev`). It is not deployed to AWS.
* A small local model writes worse Spanish than Nova Lite and can be slower on a laptop. The post checks still reject any invented number; the live check (`live_bedrock_test.go`, `-provider=ollama`) gives the 20 answers to review.
* CLAUDE.md names Bedrock as the AI of the backend. This ADR keeps that as the default and adds Ollama only as a configured alternative. The team decides whether to accept it.
