---
date: 2026-10-26
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: feature/api-contract-pipeline
tool: Claude Code
pr: none
status: done
---

# M0 Step 3: API contract split by module, generation and typed client

## Instruction

After pull requests #1 and #2 were merged, Sofia said "lets start step 3". Step 3 of the M0 prompt asks for:
* `contracts/openapi.yaml` with the shared parts, "referencing one file per module in `contracts/modules/`";
* `make generate` (Redocly bundle and lint, oapi-codegen per module, openapi-typescript);
* `make mock-api` with Prism on port 4010;
* the mobile API client with auth headers, one retry after a token refresh, and a typed `ApiError`.

## What was done

* `contracts/openapi.yaml` keeps only shared parts: info, servers, default `bearerAuth` security, the `Problem` and `ModuleHealth` schemas, the `Problem` response and common headers.
* `contracts/modules/<module>.yaml` for the 8 backend modules, each starting with one tagged example path, `GET /<module>/health`, public, with an example.
* `scripts/contract-root.mjs` writes `contracts/dist/openapi.root.yaml`: the shared root plus a `$ref` to every module path. It fails on duplicate paths, operationIds or tags, on operations not tagged with their module, and on module schemas without the module prefix. It has 7 `node:test` tests.
* `redocly.yaml`: Redocly's recommended rules plus the rules generation needs, and `rule/no-sensitive-query-params`. That rule fails the build when a query parameter looks like a token, email, cédula, account, card, amount or code.
* `make generate`: contract root, `redocly lint`, `redocly bundle` to `contracts/dist/openapi.json`, then:
  * one oapi-codegen strict chi server per module (`internal/<module>/http/api.gen.go`, filtered by tag, config next to it);
  * `apps/mobile/src/shared/api/schema.gen.ts`.

  `make lint` and `make test` generate first. Everything generated is gitignored.
* `make mock-api` serves the bundle with Prism on 4010.
* Backend: each stub module mounts its generated server, so the health path answers 200 from the contract, and keeps the 501 routes. New `problem.RequestError` and `problem.ResponseErrorHandler` replace the generated defaults, which send `err.Error()` to the client.
* Mobile `@shared/api`:
  * `createApiClient` adds `Authorization`, `X-Device-Id` and a fresh `X-Request-Id`. On 401 it refreshes once (concurrent 401s share one refresh) and retries once with the body intact.
  * Failed connections become `network_error`.
  * `unwrap()` returns the data or throws an `ApiError` with the problem `code` and the request id.
  * `configureApiHooks()` is where M1 plugs in its token, refresh and device hooks.
  * The base URL comes from `EXPO_PUBLIC_API_URL`.
* `contracts/README.md` explains to module owners how to add endpoints.
* Versions recorded in `docs/adr/0001-stack.md`.

## Result

* `make lint test` passes from a clean clone: contract lint 0 errors (8 warnings for the missing 4xx on the example paths), ESLint, `tsc`, Prettier, golangci-lint 0 issues, Jest 105 of 105, Go 10 packages ok, script tests 7 of 7.
* Prism answers `GET /bank/health` with the contract example, and unknown paths with a problem-style 404.
* A test module with its own schema (`ConsentsConsent`) bundled with its name unchanged. The test module was removed afterwards.
* Pull request: opened right after this log.

## Decisions and problems

* Redocly `join` was tried first. It drops the root `servers` and `security` and adds `servers: []` to every path. So a small script generates the root instead, and Redocly bundles it, as the decided stack says. The root never lists paths, so modules never edit a shared file to add an endpoint.
* Module schemas must start with the module name in PascalCase. Otherwise the bundler could quietly rename a schema when two modules use the same name.
* The generated Go package is named `httpapi` (folder `http`), so it is not confused with `net/http`.
* `@redocly/cli` 2.71.1 came out the same day and pnpm's release-age policy blocked it, so 2.71.0 is used. `@scarf/scarf` (install-time telemetry) is denied in `allowBuilds`. openapi-typescript declares TypeScript 5 as its peer but works with TypeScript 6, so it is allowed in `peerDependencyRules`.
* On Windows, `go test` sometimes exits 1 after every test passed, because another process (probably antivirus) locks the test binary (`unlinkat`). `make test-go` retries once on Windows only. Passing packages are cached and a real failure fails again, so nothing is hidden.
* The PR is about 1.650 lines, over the ~400 guideline. Roughly 700 of them are the same scaffolding repeated for the 8 modules. Splitting off the mobile client would make it depend on this PR.
* Sofia asked what her organization blocks to Claude. Nothing in this session was blocked. The two related messages were Copilot's quota notice on PRs #1 and #2 (GitHub billing) and the Supabase connector failing to connect at the start of the session.

## Next step

Review and merge this pull request, and activate the "Main Ruleset" (it is still disabled). Then Step 4, `feature/app-shell-and-design-system`.
