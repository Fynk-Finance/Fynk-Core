# M0 Foundations and design system

| Item | Value |
| --- | --- |
| Phase | 0 (critical path for everyone) |
| Stories | HU-051 SCRUM-68 (5) |
| Points | 5 |
| Owner | Sofia Nicolle Ariza |
| Owns | repository root files, `apps/mobile/src/app`, `apps/mobile/src/shared`, `services/api/cmd`, `services/api/internal/app`, `services/api/internal/platform`, `contracts/openapi.yaml`, `.github/workflows/ci.yml`, `Makefile`, `docker-compose.yml` |
| Unblocks | every other module |

How to use: open Claude Code at the repository root (or an empty folder for the very first step) and paste everything below the line.

---

You are building module M0 Foundations of Fynk, a personal finance app for Colombia (React Native app, Go backend, AWS). Your job is to create the skeleton every other module builds on, so that 17 modules can be developed in parallel without merge conflicts.

## Read first

1. `CLAUDE.md` (all of it, especially Git workflow and Conflict rules).
2. `docs/modules/00-shared-contracts.md`. You turn it into code with stub implementations.
3. `docs/modules/00-phases-and-gates.md`, Phase 0 and the Gate A checklist.
4. `docs/design/README.md`, the code of every screen in `docs/design/source/` (28 files) and the PNGs in `docs/design/screens/`.

## Story HU-051 (SCRUM-68), criteria

* Monorepo con la app móvil, el backend, el Banco Demo, los contratos y la infraestructura.
* La app arranca con la navegación de 4 pestañas y el sistema de diseño del diseño "App azul y verde".
* Contrato OpenAPI dividido por módulo, con generación del cliente TypeScript y del servidor Go.
* Puertos compartidos y registro de módulos creados con implementaciones de prueba.
* CI que compila, prueba y valida el contrato en cada pull request hacia develop.
* Ramas main y develop protegidas.

## Target layout

```
fynk/
  apps/mobile/                      Expo (React Native) app, TypeScript strict
    src/app/                        App root, navigation, module registry (M0)
    src/shared/                     design system, domain types, api client, events (M0)
    src/modules/<module>/           one folder per module, created empty with index.ts
  services/api/                     Go backend (module github.com/<org>/fynk/services/api)
    cmd/api/main.go
    internal/app/                   Module interface, modules.go, server wiring (M0)
    internal/platform/              config, logging with redaction, db, redis, clock, problem errors (M0)
    internal/<module>/              one package per backend module, stubbed
  services/bank-simulator/          Banco Demo (M16), only its folder and go.mod
  services/keycloak/                realm config and theme (M1), only the folder
  services/caddy/                   Caddyfile (M14), only the folder
  contracts/openapi.yaml            root that references contracts/modules/*.yaml
  contracts/modules/<module>.yaml   one per backend module, with an example health path
  contracts/bank-simulator.yaml     owned by M16
  infra/terraform/                  owned by M14
  fixtures/                         shared test data (M16 fills demo-user.json)
  docs/                             modules, design, adr
  .github/                          ci.yml, CODEOWNERS, pull_request_template.md
  .claude/settings.json
  CLAUDE.md  Makefile  docker-compose.yml  go.work  pnpm-workspace.yaml
```

## Technical decisions (do not change without asking)

* **Mobile:** latest stable Expo SDK with development builds (`expo-dev-client`), no Expo Go, because native modules are needed (SQLCipher, Keychain, Argon2). TypeScript strict. React Navigation v7 (native stack plus bottom tabs). TanStack Query for async state. Zustand only for small UI state. pnpm workspace with `node-linker=hoisted` for Metro.
* **Mobile quality:** ESLint with `eslint-plugin-boundaries`: a module may import only `@shared/*` and other modules through `@modules/<name>` (their `index.ts`). Prettier. Jest plus React Native Testing Library. Maestro for end to end flows in `apps/mobile/e2e/`.
* **Backend:** Go (current stable), chi router, oapi-codegen strict server per module (`include-tags`), pgx v5, sqlc for queries, golang-migrate with one migrations table per module, go-redis v9, aws-sdk-go-v2, `log/slog` JSON logs through a redacting handler. golangci-lint with `depguard` rules so `internal/<a>` cannot import `internal/<b>` except `internal/<b>/ports`.
* **Contract:** Redocly CLI bundles `contracts/openapi.yaml` into `contracts/dist/openapi.json` (gitignored). openapi-typescript plus openapi-fetch on mobile. Prism for the mock API.
* **Pin every dependency to an exact version** and record why each one was chosen in `docs/adr/0001-stack.md`.

## Work plan

Do one step per branch, each from the latest `develop`, each merged by pull request before the next. Commit in small steps. Branch names follow CLAUDE.md.

### Step 1. `chore/monorepo-skeleton`

Only for this first step, if `develop` does not exist yet: create `main` with the skeleton, then create `develop` from it and push both. Ask the developer to protect both branches in GitHub (require pull request, 1 approval, CI green, no force push).

* Create the layout above, with an empty `index.ts` (exporting nothing yet) in each of the 14 mobile module folders: `identity`, `vault`, `onboarding`, `consents`, `bank`, `accounts`, `transactions`, `savings`, `recurring`, `analytics`, `recommendations`, `notifications`, `compliance`, `investment`.
* `.gitignore` with generated files: `contracts/dist/`, `**/*.gen.go`, `apps/mobile/src/shared/api/schema.gen.ts`, `.env`, `.env.local`, build outputs.
* `.env.example` files with fake values only.
* Copy `CLAUDE.md`, `.claude/settings.json`, `.github/CODEOWNERS`, `.github/pull_request_template.md` and `docs/` from the kit.
* `Makefile` targets: `dev`, `generate`, `lint`, `test`, `mock-api`, `migrate`, `e2e`, `history`.

### Step 2. `feature/shared-contracts`

* Mobile: `src/shared/domain/types.ts`, `categories.ts`, `normalizeMerchant.ts` with tests, `money.ts` with `formatCop`, `formatCopSigned`, `parseCopInput` and tests (`1248035000` prints `$12.480.350`, `520000000` signed prints `+$5.200.000`).
* `src/shared/events/appEvents.ts`, a typed emitter, with tests.
* Port interfaces from section 3 of the contracts, each with an in memory stub in `src/shared/testing/`: `VaultDb` (backed by an in memory SQLite for tests), `NotificationsPort`, backup registry.
* Backend: `internal/app/module.go`, `internal/app/modules.go` with all 8 modules already listed, each package returning a stub module whose routes answer `501` with problem JSON. Stubs for `audit.Recorder` (logs a redacted line), `auth.Require` (accepts `dev-token` only when `APP_ENV=local`) and `ConsentChecker` (always true in local).
* `internal/platform/log`: a slog handler that drops or masks keys named `token`, `access_token`, `refresh_token`, `password`, `code`, `email`, `cedula`, `amount`, `account_number`, `authorization`. Test it.
* `internal/platform/problem`: helper that writes RFC 9457 responses.
* `GET /healthz` and `GET /readyz` (checks DB and Redis).

### Step 3. `feature/api-contract-pipeline`

* `contracts/openapi.yaml` (info, servers, security scheme `bearerAuth` with JWT, shared `Problem` schema) referencing one file per module in `contracts/modules/`.
* Each module file starts with one tagged example path so generation works.
* `make generate` bundles, then runs oapi-codegen per module and openapi-typescript. CI fails if the bundle has lint errors (`redocly lint`).
* `make mock-api` runs Prism on port 4010.
* Mobile API client `src/shared/api/client.ts`: base URL from config, adds `Authorization`, `X-Device-Id`, `X-Request-Id`, retries once on `401` after a token refresh hook (implemented later by M1), maps problem JSON to a typed `ApiError`.

### Step 4. `feature/app-shell-and-design-system`

* Read the code in `docs/design/source/` and the PNGs in `docs/design/screens/` before writing UI.
* `src/shared/ui/tokens.ts` with the exact values in the tokens table of `docs/design/README.md` (taken from the design code).
* Load the three design fonts with `expo-font`: Plus Jakarta Sans (400, 500, 600, 700), Space Grotesk (500, 700), IBM Plex Mono (500, 600).
* Icons and the Fynk logo: copy the SVG paths from the design code into `src/shared/ui/icons/` as `react-native-svg` components (the logo is in `VerdeLogin.dc.html`). Follow the conversion table in `docs/design/README.md` for animations.
* Components (each with a story file in `src/shared/ui/__catalog__/` and a snapshot test): `Screen`, `HeaderBlue` (rounded bottom header with avatar initials, "Hola," greeting and bell with lime unread dot), `Card`, `AmountText` (monospace, signed colors), `PrimaryButton` (blue), `AccentButton` (lime), `GhostButton`, `TextField` (icon left, light blue background, eye toggle for passwords), `Chip` (filters like "Todas", "Gastos"), `Badge` ("Mensual", "Poco uso", "Hoy", "En 2 días", "Pagado", "Simulado"), `ProgressBar` (lime on light grey), `StepProgress` (5 segments, "Paso 1 de 5", "Omitir"), `ListRow` (icon tile, title, subtitle, trailing amount or chevron), `IconTile`, `SectionHeader` (title plus "Ver todos" link), `Donut`, `LineChart`, `EmptyState`, `ErrorState`, `Skeleton`.
* Charts with `react-native-gifted-charts` (needs `react-native-svg`).
* Navigation: `RootNavigator` with an auth stack, an onboarding stack and the main tabs: Dashboard, Billetera, Recomendaciones, Inversión, styled like the design's bottom bar (light blue bar, white active icon with a dot above).
* `src/app/registry.ts` declares every module's screens once, importing `@modules/<name>` route definitions. Create it with all 14 modules already listed, each exporting a placeholder screen, so no module edits this file later.
* Deep link scheme `fynk://`, with paths reserved per module (`fynk://billetera/...` for M9, `fynk://metas/...` for M8, and so on) listed in `src/app/linking.ts`.

### Step 5. `feature/local-dev-stack`

* `docker-compose.yml`: Postgres 16 (one database `fynk` plus `keycloak`), Redis 7, Keycloak (dev mode, realm import from `services/keycloak/realms/`), the API, the bank simulator, Caddy with a local CA for mTLS (certificates generated by `make certs` with `mkcert` or `step`).
* `make dev` brings it up and runs migrations. Document ports and seeded users in `docs/local-dev.md`.

### Step 6. `chore/ci-pipeline`

* `.github/workflows/ci.yml` on pull requests to `develop` and `main`: install, `make generate`, lint (ESLint, golangci-lint, redocly), unit tests (Jest, `go test ./...`), build of both Go services, `expo prebuild` sanity check, upload coverage.
* A CI step that fails a pull request when it changes files outside `docs/` and adds no new file under `docs/history/sessions/`, with the message "Add the session log (see CLAUDE.md, Project history log)".
* `scripts/build-history.mjs` is already in the kit. Add `make history` to run it.
* Path filters so a mobile only change does not run Go jobs and the other way around.
* M14 adds the deploy workflow later. Do not create it here.

## Done when

* Every item of the Gate A checklist that belongs to M0 passes.
* A new developer can follow `docs/local-dev.md` from a clean machine.
* `docs/adr/0001-stack.md` lists every library with its pinned version.

## Ask before

* Changing any library choice above.
* Adding anything to the shared contracts that is not in `00-shared-contracts.md`.
