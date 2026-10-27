# M11 AI recommendations

| Item | Value |
| --- | --- |
| Phase | 4 |
| Stories | HU-024 SCRUM-38 (8), HU-025 SCRUM-39 (5), HU-026 SCRUM-40 (1) |
| Points | 14 |
| Owner | Julián Castiblanco (`@JulCR34l`) |
| Owns | `services/api/internal/recommendations/`, `contracts/modules/recommendations.yaml`, `apps/mobile/src/modules/recommendations/` |
| Depends on | M10 (`buildSnapshot`, `getOpportunities`), M8, M9, M10 actions, M12, M14 (Bedrock access) |
| Used by | Recomendaciones tab |

How to use: open Claude Code at the repository root on a fresh branch from `develop` and paste everything below the line.

---

You are building module M11 of Fynk: a one shot financial summary and recommendations written by an LLM from numbers that the app already calculated. The model never calculates and never sees raw movements. It never recommends a specific investment product (Decreto 2555).

## Read first

1. `CLAUDE.md` (Architecture rule 5, Regulatory guardrails), `docs/modules/00-shared-contracts.md` section 3.5.
2. `docs/modules/M10-analytics.md` (where every number comes from).
3. Design screens `Recomendaciones` (lower part) and `CfgPrivacidad` (the "Recomendaciones con IA" switch stops sending the snapshot), and the change notes. Read the code of these screens in `docs/design/sources/light/` and `docs/design/sources/dark/` first (inventory, gestures and transitions in `docs/design/README.md`) and take exact values, SVGs and animations from it. The PNGs in `docs/design/screens/light/` and `docs/design/screens/dark/` are for checking the result. Every screen works in light and dark (colors only from `useTheme()`), and uses the default transition and back gesture of its kind unless the inventory says otherwise.
4. Jira SCRUM-38, SCRUM-39, SCRUM-40.

## Stories and criteria

* **HU-024 Resumen automático (SCRUM-38)** Analiza información consolidada. Una única ejecución. Lenguaje claro. Trazabilidad de los datos analizados.
* **HU-025 Recomendaciones (SCRUM-39)** Solo datos observados. Información contextual. Sin inversiones específicas. Explicación de soporte. "Fijar tope" abre la creación de topes (HU-043). No existe "Ver plan". Las acciones de ahorro y suscripciones abren metas y suscripciones.
* **HU-026 Descargo (SCRUM-40)** Junto al resultado. Indica que no es asesoría financiera. Visible y comprensible. Cumple lineamientos.

## Screen

* Header "Recomendaciones para ti". Card "MAYOR IMPACTO" with the top opportunity (for example "Cancela 2 suscripciones que casi no usas · $56.800 al mes") and chevron.
* Card "Podrías ahorrar en N frentes": donut and legend from `getOpportunities()` (numbers from M10, never from the model).
* Filter chips Todas, Gastos, Ahorro, Suscripciones.
* "Tus próximos pasos · N sugerencias": numbered steps, each with icon, title, tag (Gastos, Ahorro, Suscripciones), the text written by the model, the saving line ("Ahorra $45.000 al mes", "Meta 2 meses antes", "Hasta $56.800 al mes") taken from the opportunity, and an action button:
  * category increase: "Fijar tope" opens M10 `openCapForm(categoryId, suggested)`
  * payday contribution: "Programar" opens M8 `openPaydayReminder(goalId, amount)`
  * subscriptions: "Revisar" opens M9 subscriptions filtered by low use
* No transport plan step and no "Ver plan" button.
* Disclaimer box under the steps, always visible: "Estas sugerencias se basan en tus movimientos y son informativas. No constituyen asesoría financiera ni recomendaciones de inversión."
* A short summary paragraph at the top of the steps (HU-024), plus "Basado en tus movimientos del <fecha> al <fecha>" (traceability).
* Pull to refresh regenerates at most once per hour. The last result is cached in the vault and shown immediately.

## Technical design

### Phone

* `buildSnapshot()` from M10, then `POST /recommendations` with the snapshot and the list of opportunity `factKey`s. Cache the response in the vault table `recommendations_cache (snapshot_hash, response_json, created_at)`.
* Render steps from the opportunities list (order, numbers, actions) and only take the text from the response, matched by `factKey`. An opportunity without text from the model shows a fixed template sentence instead.

### Backend (`internal/recommendations/`)

* Validate the snapshot against the JSON schema. Reject anything over 16 KB or with unknown fields (`400 invalid_snapshot`). This is also the guard against raw movements.
* AWS Bedrock Converse API, model from config (`amazon.nova-lite` or Claude Haiku 4.5), temperature 0.2, max 800 output tokens, one call per request, prompt caching on the system prompt. Region from config.
* System prompt in Spanish (stored in `internal/recommendations/prompt/system.es.md`, versioned): role, tone (cercano, claro, sin tecnicismos), forbidden content (no specific products, issuers, tickers, funds, CDTs from a named bank, no promises of returns, no calculations), output only the JSON schema below, mention only numbers that exist in the snapshot.
* Output schema enforced with tool use or JSON mode:

```json
{
  "summary": "string, max 400 characters",
  "steps": [{ "factKey": "string", "title": "string, max 40", "text": "string, max 160" }]
}
```

* Post checks before returning: valid JSON, every `factKey` exists in the request, every number in the text (regex for `$` amounts and percentages) matches a value in the snapshot, no word from the forbidden list (`invertir en`, `compra acciones`, `CDT de`, ticker pattern, bank names). On failure, retry once, then return `fallback: true` so the phone uses the templates.
* Store nothing. Log only the snapshot hash, model id, token counts and latency. Rate limit 10 requests per user per day.
* Cost note for the jury: at about 3 KB input and 600 output tokens per call, record the real token counts in staging and report the monthly cost per 1.000 users.

## Work plan (one branch each, from `develop`)

1. `feature/recommendations-endpoint`: schema validation, Bedrock client behind an interface with a fake for tests, post checks, fallback.
2. `feature/recommendations-prompt`: system prompt, golden tests with 5 fixture snapshots.
3. `feature/recommendations-screen`: UI, cache, actions wired to M8, M9 and M10, disclaimer.

## Tests

* Golden tests: for each fixture snapshot, the fake model's bad outputs (invented number, product name, missing factKey) are caught by the post checks.
* With the real model in staging (manual run, not CI): 20 runs on the same snapshot never change any number on screen.
* The disclaimer is present in every render path, including fallback and offline cache.

## Done when

* All criteria pass and the Gate E recommendation items pass on staging.

## Ask before

* Changing the model, adding conversation, or letting the model see anything not in the snapshot.
