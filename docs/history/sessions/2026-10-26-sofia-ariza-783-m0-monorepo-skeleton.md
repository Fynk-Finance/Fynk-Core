---
date: 2026-10-26
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: chore/monorepo-skeleton
tool: Claude Code
pr: none
status: done
---

# M0 Step 1: monorepo skeleton on main and develop

## Instruction

Sofia pasted the M0 Foundations prompt (`docs/modules/M00-foundations.md`): "Your job is to create the skeleton every other module builds on, so that 17 modules can be developed in parallel without merge conflicts." In planning she chose to do Step 1 and Step 2 (up to its pull request) in this session, and to let Claude Code install the missing tools.

## What was done

* Machine setup: pnpm 11.28.8 through corepack, Go (winget, the 1.27.3 toolchain is fetched by `go.mod`), GitHub CLI and GNU make (winget, ezwinports).
* Workspace root: `package.json` (pnpm pinned), `pnpm-workspace.yaml` (hoisted linker for Metro, exact versions, install scripts denied by default), `go.work`, `Makefile` (`lint` and `test` work now; `generate`, `mock-api`, `dev`, `migrate`, `e2e` say which step adds them; `history`), `.gitignore`, `.gitattributes` (LF), `.editorconfig`, Prettier, `.env.example` files with fake values, `README.md`.
* `apps/mobile`: Expo SDK 58 blank TypeScript app with `expo-dev-client`, TypeScript strict plus `noUncheckedIndexedAccess`, aliases `@shared/*` and `@modules/*`, ESLint flat config with `eslint-plugin-boundaries`, Jest with `jest-expo`, a smoke test, and the 14 module folders with an empty `index.ts`.
* `services/api`: Go module `github.com/Fynk-Finance/Fynk-Core/services/api`, chi server with `/healthz`, one package per backend module, `.golangci.yml` with a `depguard` rule per module.
* `services/bank-simulator`: only `go.mod` and a README (M16 owns it).
* Owner folders with a README: `services/keycloak/realms`, `services/caddy`, `infra/terraform`, `fixtures`, `docs/runbooks`. Contract stubs `contracts/openapi.yaml` and `contracts/bank-simulator.yaml`.
* `docs/adr/0001-stack.md` with every library, its exact version and why.
* `.github/CODEOWNERS`: `@owner-sofia` replaced by `@sofia-ariza-783`.

## Result

* `make lint test` passes, also from a clean clone with `pnpm install --frozen-lockfile`: ESLint, `tsc`, Prettier, `go vet`, golangci-lint (0 issues), Jest 1 of 1, `go test`.
* Boundary rules were checked with deliberate violations, then deleted: a deep import into another module, a relative import into another module, `shared` importing a module and the app importing a module's internals all fail ESLint. Importing `@modules/<name>` passes. `internal/bank` importing `internal/consents/adapters` fails depguard, and importing `internal/consents/ports` passes.
* Pull request: none. The prompt asks for this first step to go straight to `main` and `develop`. Sofia pushes both branches herself, because `.claude/settings.json` blocks Claude Code from pushing to `main`.

## Decisions and problems

* pnpm 12 could not start: it is a native rewrite and the corepack bundled with Node 22 cannot launch it. The team uses pnpm 11.28.8.
* ESLint 10 is too new for the React and import plugins inside `eslint-config-expo`, so ESLint is pinned to 9.39.5.
* TypeScript is 6.0.3, the version of the Expo SDK 58 template, not TypeScript 7.
* Testing Library v14 makes `render` async, so tests use `await render(...)`.
* No Babel alias plugin: Expo's Metro reads the aliases from `tsconfig.json`.
* The Expo template added `AGENTS.md` (it tells agents to use Expo Router, but the team decided on React Navigation v7), a `.claude/` folder enabling a plugin, and Expo's template `LICENSE`. All three were removed.
* The plan said to stop tracking `.idea/`, but it was never tracked, so nothing changed.
* The other 5 CODEOWNERS placeholders still need real GitHub usernames.

## Next step

Sofia pushes `main` and `develop` and protects both branches in GitHub. Then Step 2, `feature/shared-contracts`, starts from `develop`.
