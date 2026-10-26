# Fynk

Personal finance app for Colombia, built under the Open Finance rules. University project.

* Rules for everyone (and for Claude Code): [`CLAUDE.md`](CLAUDE.md)
* Module prompts, shared contracts, phases and gates: [`docs/modules/`](docs/modules/)
* Design source: [`docs/design/README.md`](docs/design/README.md)
* Stack and pinned versions: [`docs/adr/0001-stack.md`](docs/adr/0001-stack.md)
* Local stack (Postgres, Redis, Keycloak, API, Banco Demo, Caddy): `docs/local-dev.md`, added in M0 Step 5

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
```

`make help` lists every target.
