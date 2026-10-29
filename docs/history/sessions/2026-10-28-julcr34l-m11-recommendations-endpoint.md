---
date: 2026-10-28
developer: Julián Castiblanco
github: JulCR34l
tool: Claude Code
pr: none
status: done
module: M11
jira: [SCRUM-38, SCRUM-39, SCRUM-40]
branch: feature/recommendations-endpoint
---

# POST /recommendations: Bedrock with post checks and fallback

## Instruction

Julián asked Claude (claude.ai, Fynk project, session linked to the repository zip): "soy la persona 6, que hace la parte de analytics AI and investment, ayúdame a realizarlo con la información que hay en el repo y con respecto al módulo". Claude followed `docs/modules/M10-analytics.md`, `M11-recommendations.md` and `M15-investment.md`, `00-shared-contracts.md` and the design sources, and built the three modules as one stack of branches.

## What was done

* `contracts/modules/recommendations.yaml`: `POST /recommendations` with the snapshot schema (no extra fields, 12 months, enums), `400 invalid_snapshot`, `429 rate_limited`. The example health path is removed.
* `internal/recommendations/advisor`: `Decode` (16 KB limit, unknown fields rejected anywhere, ranges and enums), `Check` (known and unique factKeys, every `$` amount and percent present in or derived from the snapshot, no product, issuer, bank, ticker or promise of returns, length limits), `Service.Generate` (one call, one retry, then `fallback: true`; logs only hash, model, tokens and latency).
* `internal/recommendations/prompt/system.es.md`: versioned Spanish system prompt.
* `internal/recommendations/bedrock`: Converse adapter with a cache point after the system prompt and the answer forced through the `write_recommendations` tool. Temperature 0.2, 800 tokens.
* `ratelimit.go`: 10 requests per person per Bogotá day in Redis.
* `internal/app/app_test.go` (M0's file): no longer expects recommendations to be a stub.
* Golden tests on 5 fixture snapshots × 11 kinds of bad output, plus decode, HTTP, Bedrock adapter and settings tests.

## Result

* `go vet` and `go test -race` pass for the module and for `internal/app` (run with Go 1.25 against the generated server, see problems).
* Not tested against the real Bedrock yet (manual staging run of the module prompt: 20 runs, same numbers).

## Decisions and problems

* The response carries `modelId`, `promptVersion` and `snapshotHash` (RN-04 traceability).
* The snapshot guard runs as middleware before the generated server, because the generated types silently drop unknown fields.
* Settings come from the module's own environment variables (`RECOMMENDATIONS_MODEL_ID`, `RECOMMENDATIONS_AWS_REGION`, `RECOMMENDATIONS_DAILY_LIMIT`); M0 may prefer to move them into `platform/config` and `.env.example`.
* The build environment had only Go 1.24/1.25 and no access to proxy.golang.org. The code was compiled and tested with Go 1.25, the same oapi-codegen v2.8.1 and dependencies fetched from GitHub mirrors. CI with Go 1.27 is the real check.
* The app test change touches M0's file: needs Sofía's approval.

## Next step

* Staging: set the Bedrock model access and run the 20-run manual check of Gate E.
