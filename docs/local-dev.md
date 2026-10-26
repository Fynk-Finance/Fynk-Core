# Local development

How to run the whole Fynk stack on your machine: Postgres, Redis, Keycloak, Mailpit, the API, the Banco Demo and the Caddy egress with mTLS. Owned by M0. If a step here does not work on a clean machine, that is a bug: open a `fix/` pull request.

## 1. Install the tools (once)

| Tool | Version | Windows (PowerShell) | macOS |
| --- | --- | --- | --- |
| Git (with Git Bash on Windows) | any recent | `winget install --id Git.Git --exact` | `xcode-select --install` |
| Node.js | 22.20 or newer (LTS) | `winget install --id OpenJS.NodeJS.LTS --exact` | `brew install node@22` |
| Go | 1.27 (the exact toolchain downloads itself) | `winget install --id GoLang.Go --exact` | `brew install go` |
| GNU make | 4.x | `winget install --id ezwinports.make --exact` | included with the Xcode tools |
| Docker Desktop | 4.x with Compose v2 | `winget install --id Docker.DockerDesktop --exact` | `brew install --cask docker` |

On Windows, run every command below in **Git Bash**, not PowerShell or cmd. Start Docker Desktop and wait until it says it is running.

## 2. First run

```sh
git clone https://github.com/Fynk-Finance/Fynk-Core.git
cd Fynk-Core
corepack enable pnpm
make install
make dev
```

The first `make dev` downloads the images and builds the API: about 5 minutes on a Windows laptop with Docker Desktop (measured on 26 Oct 2026). Later runs take under a minute. It does the following:

1. Checks that Docker is running.
2. Creates `.env` from `.env.example` when it is missing. Only fake local values are used.
3. Creates the local certificates in `certs/` the first time (`make certs`).
4. Generates the Go handlers from the contract (`make generate-go`).
5. Starts Postgres, Redis, Keycloak and Mailpit, and waits until they are healthy.
6. Runs the migrations of every backend module (`make migrate`).
7. Builds and starts the API, the Banco Demo and Caddy, and waits until they are healthy.

Stop the stack with `make down`. Your data stays in the `postgres-data` volume.

## 3. Ports

| Service | URL on your machine | Inside Docker | Notes |
| --- | --- | --- | --- |
| API | http://localhost:8080 | `api:8080` | `/healthz`, `/readyz`, routes under `/v1` |
| Keycloak | http://localhost:8081 | `keycloak:8080` | Admin console at `/admin`. Realms `fynk` and `banco-demo` |
| Banco Demo (public) | http://localhost:8082 | `bank-simulator:8443` | Placeholder until M16 builds it |
| Banco Demo (internal, mTLS) | not published | `bank-simulator:9443` | Only Caddy reaches it, as in AWS |
| Caddy egress | https://localhost:8443 | `caddy:8443` | `/banco-demo/*` goes to the bank with the Fynk client certificate |
| Mailpit | http://localhost:8025 | SMTP `mailpit:1025` | Every email Keycloak sends lands here |
| Postgres | `localhost:5432` (this machine only) | `postgres:5432` | Databases `fynk` and `keycloak` |
| Redis | `localhost:6379` (this machine only) | `redis:6379` | |
| Prism mock API | http://localhost:4010 | not in Docker | `make mock-api`, the contract's example responses |

## 4. Seeded users

Passwords are in your `.env`, under the variable named here. They are fake local values from `.env.example`.

| Who | Where | User | Password variable |
| --- | --- | --- | --- |
| Keycloak administrator | http://localhost:8081/admin (realm `master`) | value of `KEYCLOAK_ADMIN` | `KEYCLOAK_ADMIN_PASSWORD` |
| Fynk demo user | realm `fynk` | `demo@fynk.local` | `FYNK_DEMO_USER_PASSWORD` |
| Banco Demo customer | realm `banco-demo` | `cliente.demo@bancodemo.local` | `BANCO_DEMO_USER_PASSWORD` |
| Postgres | `localhost:5432`, database `fynk` | value of `POSTGRES_USER` | `POSTGRES_PASSWORD` |
| Postgres (Keycloak) | database `keycloak` | `keycloak` | `KEYCLOAK_DB_PASSWORD` |

Try a user in the Keycloak account console:
* Fynk: http://localhost:8081/realms/fynk/account
* Banco Demo: http://localhost:8081/realms/banco-demo/account

The realm files in `services/keycloak/realms/` are **placeholders added by M0**. M1 replaces `fynk-realm.json` and M16 replaces `banco-demo-realm.json` with the full realms. Keycloak imports them only when the realm does not exist yet. After a change, reset the stack (section 7).

## 5. Try it

```sh
# Liveness, and readiness (checks Postgres and Redis)
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz

# A module's public health route, and a protected stub route (501 until the module exists)
curl http://localhost:8080/v1/consents/health
curl -H "Authorization: Bearer dev-token" http://localhost:8080/v1/consents
```

`dev-token` works only with `APP_ENV=local`, which the compose file sets. M1 replaces it with real Keycloak tokens.

**mTLS through Caddy to the Banco Demo:**

```sh
# Through Caddy: Caddy presents the Fynk client certificate, the bank accepts it
docker compose exec caddy wget -qO- --no-check-certificate https://localhost:8443/banco-demo/healthz

# Straight to the bank without a client certificate: refused
docker compose exec caddy wget -qO- --no-check-certificate https://bank-simulator:9443/healthz

# The bank logs the serial of every client certificate it accepted
docker compose logs bank-simulator | grep mtls
```

**Migrations.** Each backend module embeds its SQL and returns it from `Migrations()`. `make migrate` runs every module in its own schema (`identity`, `backup`, `consents`, `bank`, `catalog`, `privacy`, `audit`, `market`), with its own `<schema>_migrations` table, so two modules never share a version number.
* Files follow golang-migrate naming: `1_create_devices.up.sql` and `1_create_devices.down.sql`.
* Modules without SQL are skipped.
* `docker compose run --rm migrate status` prints each schema's version.

**Integration test of the migration runner** (needs the stack running):

```sh
cd services/api
DATABASE_URL=postgres://fynk:fynk-local-only@localhost:5432/fynk?sslmode=disable \
  go test -tags integration ./internal/platform/migrate/
```

## 6. Certificates

`make certs` creates a local CA and the certificates of the stack in `certs/`. It runs the pinned `smallstep/step-cli` image, so nothing is installed on your machine. `certs/` is gitignored and **never committed**.
* Leaf certificates last 90 days. When they expire, run `make certs FORCE=1` and then `make dev`.
* The CA key (`ca.key`) never enters a container.
* These files are for your machine only. Staging uses certificates kept in Secrets Manager (M14).

## 7. Reset

```sh
docker compose down -v      # stops everything and deletes the Postgres data
make dev                    # recreates the databases, the realms and the schemas
```

## 8. Troubleshooting

| Problem | Fix |
| --- | --- |
| `Docker is not running` | Start Docker Desktop and wait until it is running, then `make dev` again |
| `port is already allocated` | Another program uses that port (often a local Postgres on 5432). Stop it, or change the left side of the port in `docker-compose.yml` on your machine only |
| A shell script fails inside a container with `\r` errors | Line endings became CRLF. The repository forces LF (`.gitattributes`). Run `git config core.autocrlf false`, then `git checkout -- scripts/` |
| Keycloak takes long the first time | It builds its database on the first start (about 1 minute). `make dev` waits for it |
| HTTPS on localhost shows another issuer (for example "Avast Web/Mail Shield") | Antivirus HTTPS scanning intercepts TLS on your machine. Use the `docker compose exec` commands above, which stay inside Docker, or turn off HTTPS scanning for localhost |
| `The generated handlers are missing` while building the API | Run `make generate-go`. `make dev` does it for you |
| A realm change does not show | Keycloak imports a realm only once. Reset (section 7) |
