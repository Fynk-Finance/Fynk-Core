# ADR 0009: Gemini as the model of the recommendations while Bedrock is blocked

* Status: proposed
* Date: 2026-11-19
* Owner: M11 AI recommendations (Julián Castiblanco / `@JulCR34l`)
* Jira: SCRUM-38 (HU-024)

---

## 1. Context (finding for the jury)

M11 writes the text of Recomendaciones with Amazon Nova Lite on Bedrock (`amazon.nova-lite-v1:0`, us-east-2). On 19 Nov 2026 the project's AWS account could not invoke any model:

* `aws bedrock-runtime converse --region us-east-2 --model-id amazon.nova-lite-v1:0 …` answers `ValidationException: Operation not allowed`. In us-east-1 it first answered `AccessDeniedException: Your account is currently being verified`, then the same `Operation not allowed`.
* Service Quotas in us-east-2 show **0** for "Model invocation max tokens per day for Amazon Nova Lite" and for the cross-region requests and tokens per minute. The quota is not adjustable from Service Quotas ("Adjustable: false"), so it needs a support case.
* CloudShell answers "Unable to create the environment. Your account verification is in progress. This may take up to two days for new accounts".
* IAM is not the cause: the identity is valid (`aws sts get-caller-identity`) and the error is not `AccessDenied`.

The account is new and on AWS's Free plan. The demo, for about 50 people, is the next day.

The code is not affected: when the model fails, `POST /recommendations` answers `fallback: true` and the phone shows its templates with the same numbers (architecture rule 5).

## 2. Decision

The model of M11 is chosen by configuration. Bedrock stays the default:

| Setting | Bedrock (default) | Gemini (demo) | Any OpenAI compatible API |
| --- | --- | --- | --- |
| `RECOMMENDATIONS_PROVIDER` | `bedrock` or empty | `gemini` | `openai` |
| `RECOMMENDATIONS_MODEL_ID` | `amazon.nova-lite-v1:0` | `gemini-4-hydrogen` | required |
| `RECOMMENDATIONS_API_BASE_URL` | — | Gemini's OpenAI compatible endpoint | required (Groq, OpenRouter, Ollama…) |
| `RECOMMENDATIONS_API_KEY` | — (task role) | key of Google AI Studio, or `GEMINI_API_KEY` | required |
| `RECOMMENDATIONS_REASONING_EFFORT` | — | `low` (`off` leaves it out) | optional |
| `RECOMMENDATIONS_RESPONSE_FORMAT` | — | `json_schema` (`json_object` if the provider rejects the schema) | same |

`internal/recommendations/openaicompat` is an `advisor.Model` adapter on `POST <base>/chat/completions`, with the output forced to `advisor.OutputSchema`. Nothing else changes: the same system prompt, the same snapshot validation, the same post checks (amounts, percents, forbidden products, factKeys), the same fallback and the same daily limit per user.

## 3. Consequences

* Rule 5 holds: the code calculates and the model only writes. The model receives only the aggregate snapshot, as with Bedrock: no movements, names, emails or account numbers.
* **Data leaves AWS.** With Gemini the aggregate snapshot goes to Google. On the free tier Google may use what it receives to improve its products; with billing turned on it does not. The snapshot holds no personal data, but the team accepts this explicitly. The table "Where data lives" in CLAUDE.md keeps "Aggregate snapshot for the AI: in transit only, never stored" on our side.
* **Capacity for the demo.** Each person asks the model at most once per hour (the phone caches the answer and regenerates hourly) and at most 10 times a day (`RECOMMENDATIONS_DAILY_LIMIT`). The free tier of Gemini covers about 50 people unless they all ask in the same minute; then some get the templates for a while. Turning on billing removes that risk for cents.
* **The API key is a secret.** It lives only in the server's environment (Secrets Manager in AWS, an uncommitted `.env` or environment variable locally), never in the repository and never in the phone app. It is never logged.
* When AWS raises the quotas, `RECOMMENDATIONS_PROVIDER` goes back to `bedrock` and nothing else changes.
* The local Ollama alternative of #421 is covered by this adapter with `openai` and Ollama's `/v1` endpoint, so #421 is not needed.
* CLAUDE.md names Bedrock as the AI of the backend. This ADR keeps it as the default and adds the alternative by configuration. The team decides whether to accept it.
