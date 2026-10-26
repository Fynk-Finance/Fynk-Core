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

The aliases `@shared/*` and `@modules/*` are declared once in `tsconfig.json`. Metro reads them from there (Expo's built-in tsconfig paths support), and Jest maps them in `jest.config.js`. No Babel alias plugin is needed.

Two packages ship prebuilt native binaries and their install scripts are denied in `pnpm-workspace.yaml` (`allowBuilds`): `@parcel/watcher` and `unrs-resolver`.

## Backend (`services/api`)

| Library | Version | Why |
| --- | --- | --- |
| github.com/go-chi/chi/v5 | v5.5.0 | Small `net/http` compatible router, works with oapi-codegen's strict server |
| golangci-lint (run with `go run …@v2.15.0`) | v2.15.0 | Linters, including `depguard`, which blocks `internal/<a>` from importing `internal/<b>` except `internal/<b>/ports` |

## Added in later M0 steps

These are already decided (M0 prompt). Their exact versions are recorded here when each step adds them.

| Library | Step | Purpose |
| --- | --- | --- |
| sql.js | 2 | In-memory SQLite for the `VaultDb` test stub. WebAssembly, so there is no native build on Windows or CI |
| pgx v5, go-redis v9 | 2 | Postgres and Redis clients |
| Redocly CLI, openapi-typescript, openapi-fetch, Prism, oapi-codegen | 3 | Contract bundle, generated clients and servers, mock API |
| React Navigation v7, TanStack Query, Zustand, react-native-svg, react-native-gifted-charts, react-native-reanimated, expo-font with `@expo-google-fonts/*` | 4 | App shell and design system |
| sqlc, golang-migrate, aws-sdk-go-v2 | 2 to 5 | Queries, per-module migrations, AWS clients |
| Maestro | 4 or later | End to end flows in `apps/mobile/e2e/` |

## Consequences

* A fresh clone gives the same dependency tree on every machine (`make install` uses `--frozen-lockfile`).
* Upgrades are deliberate: one `chore/` pull request per upgrade, with this table updated.
