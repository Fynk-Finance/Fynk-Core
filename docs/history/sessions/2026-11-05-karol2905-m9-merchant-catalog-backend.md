---
date: 2026-11-05
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-58]
branch: feature/merchant-catalog-backend
tool: Claude Code (cloud session) and Karol's Windows computer for Go
pr: none
status: done
---

# Merchant catalog backend: GET /catalog/merchants with an ETag (SCRUM-58)

## Instruction

"mientras me aprueban esos pr, puedes ir adelantando el scrum 58 si te doy acceso a mi computador y descargas lo necesario para esa tarea?"

## What was done

* **Go 1.27 setup.**
  * The cloud session cannot download Go 1.27 (`proxy.golang.org` does not resolve), and the link to Karol's computer did not connect.
  * Karol installed Go with `winget install GoLang.Go`, and the toolchain 1.27.3 came by itself.
  * Her repo has no Node packages (no `pnpm`), so the session bundled `contracts/dist/openapi.json` and sent it to her. She ran `oapi-codegen`, `go vet` and `go test` and pasted the output.
* **Contract `contracts/modules/catalog.yaml`:**
  * `GET /catalog/merchants` with `If-None-Match`, `200` with `ETag` and `304` without a body.
  * Schemas `CatalogMerchantList` and `CatalogMerchant` (key, displayName, category, isSubscription, matchPatterns, cancelUrl, cancelSteps).
  * The example health path is removed.
* **Migrations of the `catalog` schema:**
  * `1_create_merchants` with `cancel_url` restricted to `https://`.
  * `2_seed_merchants` with 47 merchants: streaming, music, cloud, AI, games, gyms, telecom and utilities common in Colombia, plus Banco Demo's fictional ones.
  * `cancel_url` is set only for the 12 whose official page was checked on 5 Nov 2026: Netflix, Spotify, Disney+, HBO Max, YouTube, Apple, Google One, Crunchyroll, Deezer, ChatGPT, Microsoft and PlayStation. The others get general steps.
* **Go:**
  * `merchants.go`: `Load` with an ETag from the hash of the content, and `Matches` (list, weak form and `*`, RFC 9110).
  * `store.go`: pgx.
  * `http.go`: the strict server.
  * `module.go`: behind `auth.Require`, with `Migrations()`.
* **Tests:** `merchants_test.go` (ETag follows the content, If-None-Match) and `http_test.go` (200 with ETag, empty fields as `null` and `[]`, 304 with no body, store error gives 500).
* **`internal/app/app_test.go` (M0, with Karol's approval):** catalog joins the modules with real endpoints in the two tests that expected the stub. This follows what identity, backup, recommendations and market already did.

## Result

* On Karol's computer: `go vet ./...` is clean and `go test ./internal/catalog/...` passes.
* `internal/identity/keycloak` and `internal/recommendations` could not run there, because Windows Application Control blocked their test executables. That is local only; CI runs on Linux.
* First compile error found this way: the optional `ETag` header is generated as `*string`. Fixed.

## Decisions and problems

* **Steps as a list, not markdown.** `cancelSteps` is `string[]` instead of the prompt's `cancel_steps_md`, so the app shows numbered steps without a markdown renderer.
* **No URL without checking it.** A wrong cancellation link would send people to the wrong page.
* **The seed migration was not run against Postgres here.** CI's integration tests only migrate `identity` and `backup`; the catalog seed is checked when the API starts with `make dev`.

## Next step

Open the pull request. Then `feature/subscription-cancellation-guide`, the app side already written: vault cache with the ETag, detection names and "Cómo cancelarla" with the steps and "Abrir página de cancelación".
