# Fynk

Personal finance app for Colombia, built under the Open Finance rules. University project.

* Rules for everyone (and for Claude Code): [`CLAUDE.md`](CLAUDE.md)
* Module prompts, shared contracts, phases and gates: [`docs/modules/`](docs/modules/)
* Design source: [`docs/design/README.md`](docs/design/README.md)
* Stack and pinned versions: [`docs/adr/0001-stack.md`](docs/adr/0001-stack.md)
* Local stack (Postgres, Redis, Keycloak, API, Banco Demo, Caddy): [`docs/local-dev.md`](docs/local-dev.md)

## Layout

| Folder | What |
| --- | --- |
| `apps/mobile/` | React Native app (Expo development builds), the device hexagon |
| `services/api/` | Go backend, the backend hexagon |
| `services/bank-simulator/` | Banco Demo, the simulated bank (M16) |
| `services/keycloak/`, `services/caddy/` | Identity realms and themes, mTLS egress |
| `contracts/` | OpenAPI contract, one file per backend module |
| `infra/terraform/` | AWS infrastructure (M14) |
| `fixtures/` | Shared demo data (M16) |
| `docs/` | Modules, design, ADRs, runbooks, project history |

## First run

Requirements: Node 22.20 or newer, pnpm through corepack, Go 1.27 (the exact toolchain is downloaded automatically), GNU make and Git Bash on Windows.

```sh
corepack enable pnpm
make install
make lint test
make dev        # local stack in Docker, see docs/local-dev.md
```

`make help` lists every target.

## CI

Every pull request to `develop` or `main` runs `.github/workflows/ci.yml`:

* **Always:** Prettier, the script tests, and the session log check.
* **When the app changes:** contract generation, ESLint, tsc, Jest with coverage, and `expo prebuild`.
* **When the Go services change:** contract generation, go vet, golangci-lint, `go test -race` with coverage, the migration integration test, and the build of both services and their Docker images.
* **Contracts, the Makefile, the lockfile or the CI files** run both groups.

A pull request that changes anything outside `docs/` must add its own new file in `docs/history/sessions/`. Otherwise CI fails with "Add the session log (see CLAUDE.md, Project history log)".

The required check in branch protection is **CI passed**. It waits for every job and treats skipped jobs as passed.
