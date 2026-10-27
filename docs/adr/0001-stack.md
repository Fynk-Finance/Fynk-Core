# ADR 0001: Stack and pinned versions

* Status: accepted
* Date: 2026-10-26
* Owner: M0 Foundations (Sofia Nicolle Ariza)
* Jira: SCRUM-68 (HU-051)

## Context

17 modules are built in parallel by 6 people on Windows and macOS. Builds must give the same result on every machine and in CI. The library choices come from `docs/modules/M00-foundations.md`, "Technical decisions". Changing one needs a team decision.

## Rules

* Every dependency is pinned to an exact version: no `^` or `~` in `package.json`, exact versions in `go.mod`. `pnpm-workspace.yaml` sets `saveExact: true`.
* Expo-managed libraries are added with `npx expo install` so the version matches the Expo SDK.
* Command-line tools (golangci-lint, oapi-codegen, sqlc, Redocly, Prism) are pinned in the repository, never installed globally.
* Adding a library is its own small pull request (`chore/add-<library>`) that updates this file.
* This file is updated in every M0 step that adds a dependency.

## Toolchain

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | 22.20.0 or newer (LTS) | Required by Expo SDK 58 and the JavaScript tooling |
| pnpm | 11.28.8 (`packageManager` field, through corepack) | Workspace support and a strict lockfile. pnpm 12 is a native rewrite that the corepack bundled with Node 22 cannot start yet, so the team stays on 11 |
| Go | 1.27.3 (`toolchain` line in `go.mod` and `go.work`) | Current stable. Go downloads this exact toolchain automatically from go.dev and verifies its checksum |
| GNU make | 4.4 | One entry point (`make lint test`) for Windows (Git Bash), macOS and Linux CI |

## Mobile (`apps/mobile`)

| Library | Version | Why |
| --- | --- | --- |
| expo | 58.0.19 | Latest stable SDK. Development builds give access to native modules (SQLCipher, Keychain, Argon2) that Expo Go cannot load |
| expo-dev-client | 58.0.15 | Development builds instead of Expo Go |
| expo-status-bar | 58.0.4 | Status bar control, part of the Expo template |
| react | 19.3.0 | Version required by React Native 0.88 |
| react-native | 0.88.0 | Version shipped with Expo SDK 58 |
| typescript | 6.0.3 | Version of the Expo SDK 58 template. Strict mode plus `noUncheckedIndexedAccess`. TypeScript 7 is not used until Expo supports it |
| @types/react | 19.3.0 | React types matching React 19.3 |
| babel-preset-expo | 58.0.20 | Babel preset used by Metro and Jest |
| eslint | 9.39.5 | ESLint 10 is out, but `eslint-plugin-react` and `eslint-plugin-import` (used by `eslint-config-expo`) do not support it yet |
| eslint-config-expo | 58.0.4 | Expo's recommended rules (flat config) |
| eslint-plugin-boundaries | 7.3.0 | Enforces module isolation: a module imports only `@shared/*` and other modules through their `index.ts` |
| eslint-import-resolver-typescript | 4.4.5 | Lets ESLint resolve the `@shared/*` and `@modules/*` aliases from `tsconfig.json` |
| jest | 30.5.2 | Unit tests |
| jest-expo | 58.0.12 | Jest preset for Expo SDK 58 |
| @types/jest | 30.0.0 | Jest types (TypeScript 6 no longer loads them automatically, so `tsconfig.json` lists them) |
| @testing-library/react-native | 14.1.0 | Component tests. v14 makes `render` async: tests use `await render(...)` |
| prettier (workspace root) | 3.9.10 | Code formatting |
| sql.js | 1.15.1 | In-memory SQLite (WebAssembly) behind the `VaultDb` test stub in `src/shared/testing`, so module SQL runs in Jest without native code. 1.15.2 was published the same day and is held back by pnpm's minimum release age policy |
| @types/sql.js | 1.4.11 | Types for sql.js |
| @react-navigation/native | 7.5.1 | Navigation (decided: React Navigation v7). Root stack, tabs and `fynk://` deep links |
| @react-navigation/native-stack | 7.21.0 | Native stack for pushed screens and full-screen flows |
| @react-navigation/bottom-tabs | 7.21.0 | The four main tabs, drawn by the custom `TabBar` of the design |
| react-native-screens | 4.30.0 | Native screen containers required by React Navigation |
| react-native-safe-area-context | 5.10.1 | Safe area insets for headers and the tab bar |
| react-native-svg | 15.16.0 | Icons, logo, illustrations and charts copied from the design SVG |
| react-native-reanimated | 4.7.1 | Design animations (shine, step fill, skeleton pulse) on the UI thread, turned off with reduced motion |
| react-native-worklets | 0.13.0 | Required by Reanimated 4. Jest uses Reanimated's own resolver (`jest.config.js`) |
| react-native-gifted-charts | 1.4.81 | Line chart (decided library). The donut is drawn with react-native-svg because gifted-charts cannot draw the design's rounded, separated arcs |
| expo-linear-gradient | 58.0.3 | Gradient peer that react-native-gifted-charts needs |
| expo-font | 58.0.10 | Loads the design fonts before the first screen |
| @expo-google-fonts/plus-jakarta-sans | 0.4.2 | Body font, weights 400 to 700, imported per weight so only those files are bundled |
| @expo-google-fonts/space-grotesk | 0.4.1 | Heading font, weights 500 and 700 |
| @expo-google-fonts/ibm-plex-mono | 0.4.1 | Money font, weights 500 and 600 |
| expo-system-ui | 58.0.6 | Applies `userInterfaceStyle: light` on Android (the design is light only) |
| @tanstack/react-query | 5.104.5 | Async server state (decided). No background refetch, see `src/app/queryClient.ts`. 5.105.0 was a few hours old and is held back by the release age policy |
| openapi-fetch | 0.17.0 | Typed fetch client built on the generated `paths` types. Small, no runtime codegen, lets the client add headers and retry once after a token refresh |
| openapi-typescript | 7.13.0 | Generates `src/shared/api/schema.gen.ts` from the bundled contract. It declares TypeScript 5 as its peer. It generates correctly with TypeScript 6, so `pnpm-workspace.yaml` allows it (`peerDependencyRules`) |

The aliases `@shared/*` and `@modules/*` are declared once in `tsconfig.json`. Metro reads them from there (Expo's built-in tsconfig paths support), and Jest maps them in `jest.config.js`. No Babel alias plugin is needed.

Install scripts denied in `pnpm-workspace.yaml` (`allowBuilds`): `@parcel/watcher` and `unrs-resolver` (they ship prebuilt binaries), and `@scarf/scarf` (an install-time telemetry ping pulled in by a tooling dependency).

## Contract tooling (workspace root)

| Library | Version | Why |
| --- | --- | --- |
| @redocly/cli | 2.71.0 | Lints (`redocly.yaml`) and bundles the contract into `contracts/dist/openapi.json`. 2.71.1 was published the same day and is held back by the minimum release age policy. Its `join` command was tried and not used: it drops the root `servers` and `security` |
| @stoplight/prism-cli | 5.16.0 | `make mock-api`: serves the contract on port 4010 with its examples, so mobile modules work before the backend exists |
| yaml | 2.9.1 | Parser used by `scripts/contract-root.mjs`, which builds the root that references every module file |

## Backend (`services/api`)

| Library | Version | Why |
| --- | --- | --- |
| github.com/go-chi/chi/v5 | v5.5.0 | Small `net/http` compatible router, works with oapi-codegen's strict server |
| github.com/jackc/pgx/v5 | v5.11.0 | Postgres driver and pool (`pgxpool`), the most used native Go driver, supported by sqlc |
| github.com/redis/go-redis/v9 | v9.23.0 | Official Redis client: nonces, rate limits, caches |
| github.com/oapi-codegen/oapi-codegen/v2 (Go `tool` directive) | v2.8.1 | Strict chi server per module, filtered by tag (`internal/<module>/http/oapi-codegen.yaml`). Run with `go tool oapi-codegen` |
| github.com/oapi-codegen/runtime | v1.8.0 | Runtime helpers the generated servers import |
| golangci-lint (run with `go run …@v2.15.0`) | v2.15.0 | Linters, including `depguard`, which blocks `internal/<a>` from importing `internal/<b>` except `internal/<b>/ports` |
| github.com/golang-migrate/migrate/v4 | v4.20.1 | Per-module Postgres migrations (decided). `internal/platform/migrate` runs each module in its own schema with its own `<schema>_migrations` table, through the `pgx/v5` driver and the `iofs` source, so modules embed their SQL |
| github.com/jackc/pgx/v5/stdlib | v5.11.0 (part of pgx) | `database/sql` adapter that golang-migrate needs. The API itself keeps using `pgxpool` |
| github.com/golang-jwt/jwt/v5 | v5.3.1 | Added for M1. Parses and checks Keycloak access tokens: `WithValidMethods(["PS256"])` rejects every other algorithm before a key is looked up, plus issuer, audience, expiry and leeway checks. The JWKS cache is M1's own code. Marked `// indirect` until M1's verifier imports it |
| github.com/testcontainers/testcontainers-go | v0.44.0 | Added for M1. Starts real containers (Keycloak, later Postgres and Redis) from Go integration tests (`-tags integration`), the same way on Windows with Docker Desktop and in CI. Test-only. Marked `// indirect` until M1's tests import it |

The bank simulator placeholder (`services/bank-simulator`, M16) uses only the Go standard library.

## Local stack (`docker-compose.yml`)

Images are pinned to exact versions. A version is taken only once it has been out for a few days, like the pnpm release age rule.

| Image | Version | Why |
| --- | --- | --- |
| postgres | 16.15-alpine | Postgres 16, as in the M0 prompt and RDS. One database `fynk` (one schema per module) plus `keycloak` |
| redis | 7.4.11-alpine | Redis 7 (nonces, rate limits, caches). 7.4.12 was released the same day and is held back |
| quay.io/keycloak/keycloak | 26.8.1 | Login (decided). `start-dev --import-realm` imports `services/keycloak/realms/*.json`. Compose builds M1's image `services/keycloak/Dockerfile` from this same version |
| axllent/mailpit | v1.31.6 | Catches the emails Keycloak sends locally (named in the M1 prompt). v1.32.0 was 4 days old |
| caddy | 2.11.7-alpine | mTLS egress towards the banks (decided, M14). Uses `tls_trust_pool`, the current syntax |
| smallstep/step-cli | 0.31.0 | `make certs`: creates the local CA and certificates inside Docker, so nobody installs mkcert or step |
| golang | 1.27.3-bookworm | Build stage of the API and bank simulator images, same Go as `go.mod` |
| gcr.io/distroless/static-debian12 | nonroot, pinned by digest | Runtime image: no shell, no package manager, non-root user. The tag moves, so the digest is pinned |

## CI (`.github/workflows/ci.yml`)

Actions are pinned by full commit SHA, because a tag can be moved to other code. Only GitHub's own actions are used. A version is taken once it has been out for at least 7 days. Path filters come from `scripts/ci-changes.mjs` (plain Node, tested), not from a third-party action.

| Action or runner | Version | SHA or note |
| --- | --- | --- |
| Runner | `ubuntu-24.04` | Fixed image, not `ubuntu-latest`, so an image change is a deliberate edit |
| Node.js | 22.20.0 | Same as the minimum in `package.json`. pnpm comes from corepack, as on the developer machines |
| actions/checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| actions/setup-node | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| actions/setup-go | v7.0.0 | `b7ad1dad31e06c5925ef5d2fc7ad053ef454303e` (Go from `services/api/go.mod`) |
| actions/cache | v6.1.0 | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` |
| actions/upload-artifact | v7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |

Coverage reports stay on GitHub: they are saved as run artifacts and the totals go in the job summary. No outside coverage service and no secret.

## Added in later M0 steps

These are already decided (M0 prompt). Their exact versions are recorded here when each step adds them.

| Library | Step | Purpose |
| --- | --- | --- |
| Zustand | when a module first needs small UI state | Decided for small UI state. Not added yet because nothing in the shell needs it |
| sqlc, aws-sdk-go-v2 | the module that first needs them | Queries, AWS clients |
| Maestro | installed on the developer machine | `make e2e` runs `apps/mobile/e2e/*.yaml`. It is a CLI, not a package dependency |

## Consequences

* A fresh clone gives the same dependency tree on every machine (`make install` uses `--frozen-lockfile`).
* Upgrades are deliberate: one `chore/` pull request per upgrade, with this table updated.
