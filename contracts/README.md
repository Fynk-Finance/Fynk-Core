# API contract

Contract first: change the contract, run `make generate`, then write code (CLAUDE.md, Coding conventions).

| File | Owner | What |
| --- | --- | --- |
| `openapi.yaml` | M0 | Shared parts only: info, servers, `bearerAuth`, `Problem`, `ModuleHealth`, common headers. No paths |
| `modules/<module>.yaml` | that module | Every path of one backend module |
| `bank-simulator.yaml` | M16 | Banco Demo API, separate from the Fynk API |
| `dist/` | generated | `openapi.root.yaml` and `openapi.json`, gitignored |

## What `make generate` does

1. `scripts/contract-root.mjs` writes `dist/openapi.root.yaml`: the shared root plus a `$ref` to every path of every `modules/*.yaml`. No one edits the root to add a path, so module contracts never conflict.
2. Redocly lints it with `redocly.yaml` (errors fail CI) and bundles it into `dist/openapi.json`.
3. oapi-codegen writes one strict chi server per module, `services/api/internal/<module>/http/api.gen.go`, keeping only the operations tagged with the module name (`internal/<module>/http/oapi-codegen.yaml`).
4. openapi-typescript writes `apps/mobile/src/shared/api/schema.gen.ts`, used by the typed client `api` in `@shared/api`.

`make mock-api` serves `dist/openapi.json` with Prism on port 4010, answering with the examples.

## Adding an endpoint to your module

1. Edit only `contracts/modules/<module>.yaml`. Paths are relative to `/v1`.
2. Every operation has:
   * `tags: [<module>]`;
   * a unique `operationId`;
   * a `summary`;
   * at least one 4xx response;
   * an `example` for each success response, because Prism answers with it.
3. Errors reuse the shared response: `$ref: '../openapi.yaml#/components/responses/Problem'`.
4. Security:
   * Operations need a bearer token by default.
   * A public operation says `security: []`.
   * On the Go side, wrap the routes with `auth.Require`, because the generated server does not check tokens.
5. Schemas only your module uses go in your file's `components`, named with your module prefix (`ConsentsConsent`, `BankAccount`). Schemas every module uses belong in `openapi.yaml`, through a pull request to M0.
6. Never put personal data, amounts or tokens in a path or query parameter. Redocly fails the build (`rule/no-sensitive-query-params`).
7. Every POST that creates something accepts `$ref: '../openapi.yaml#/components/parameters/IdempotencyKey'`.
8. Remove the example `/<module>/health` path, and its `server` method in `internal/<module>/module.go`, once your module has real endpoints.

Then run `make generate`, implement the generated `StrictServerInterface` in your module, and call the API from mobile with `unwrap(api.GET('/your/path'))`.
