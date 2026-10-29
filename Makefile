# Fynk monorepo tasks (owned by M0).
# On Windows run make from Git Bash. Recipes use POSIX sh.

GO_MODULES    := services/api services/bank-simulator
GOLANGCI_LINT := go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.15.0

# API contract: shared root plus one file per backend module (see contracts/openapi.yaml).
CONTRACT_ROOT := contracts/dist/openapi.root.yaml
CONTRACT      := contracts/dist/openapi.json
API_MODULES   := $(basename $(notdir $(wildcard contracts/modules/*.yaml)))
REDOCLY       := REDOCLY_TELEMETRY=off REDOCLY_SUPPRESS_UPDATE_NOTICE=true pnpm exec redocly

# Local stack (docker-compose.yml, docs/local-dev.md).
COMPOSE       := docker compose

# Extra flags for the test runners, empty locally. CI adds coverage (.github/workflows/ci.yml).
GOTESTFLAGS   ?=
JESTFLAGS     ?=

.DEFAULT_GOAL := help

.PHONY: help install lint lint-mobile lint-go format-check test test-mobile test-go test-scripts \
        test-integration test-keycloak build-go generate generate-contract generate-go generate-ts mock-api dev down migrate certs e2e history

help: ## List the available targets
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-18s %s\n", $$1, $$2}'

install: ## Install JavaScript dependencies with the pinned pnpm
	pnpm install --frozen-lockfile

lint: lint-mobile lint-go format-check ## Lint everything (ESLint, tsc, go vet, golangci-lint, Prettier)

lint-mobile: generate-ts ## Lint and typecheck the mobile app
	pnpm --filter @fynk/mobile lint
	pnpm --filter @fynk/mobile typecheck

format-check: ## Check the formatting of the whole repository with Prettier
	pnpm exec prettier --check .

lint-go: generate-go ## go vet and golangci-lint on every Go module that has code
	@set -e; for m in $(GO_MODULES); do \
	  if [ -z "$$(find $$m -name '*.go' -print -quit)" ]; then echo "skip $$m (no Go files yet)"; continue; fi; \
	  echo "lint $$m"; \
	  (cd $$m && go vet ./... && $(GOLANGCI_LINT) run ./...); \
	done

test: test-mobile test-go test-scripts ## Run every unit test

test-mobile: ## Jest for the mobile app (JESTFLAGS="--coverage" adds coverage)
	pnpm --filter @fynk/mobile test $(JESTFLAGS)

test-scripts: ## node:test for the repository scripts
	node --test scripts/*.test.mjs

test-go: generate-go ## go test on every Go module that has code (GOTESTFLAGS adds flags)
	@set -e; for m in $(GO_MODULES); do \
	  if [ -z "$$(find $$m -name '*.go' -print -quit)" ]; then echo "skip $$m (no Go files yet)"; continue; fi; \
	  echo "test $$m"; \
	  if [ "$$OS" = "Windows_NT" ]; then \
	    (cd $$m && { go test $(GOTESTFLAGS) ./... || { echo "retrying once (Windows can lock the test binary: unlinkat)"; go test $(GOTESTFLAGS) ./...; }; }); \
	  else \
	    (cd $$m && go test $(GOTESTFLAGS) ./...); \
	  fi; \
	done

test-integration: generate-go ## Migration tests against a real Postgres (needs DATABASE_URL, see docs/local-dev.md)
	@[ -n "$$DATABASE_URL" ] || { echo "DATABASE_URL is not set. Start the stack with make dev, then see docs/local-dev.md."; exit 1; }
	cd services/api && go test -tags integration -count=1 -p 1 ./internal/platform/migrate/... ./internal/identity/postgres/... ./internal/backup/...

test-keycloak: ## Realm tests on a real Keycloak and Mailpit started with testcontainers (needs Docker)
	cd services/api && go test -tags integration -count=1 ./internal/identity/keycloak/...

build-go: generate-go ## Build every Go module that has code into bin/ (static binaries, as in the Dockerfiles)
	@set -e; for m in $(GO_MODULES); do \
	  if [ -z "$$(find $$m -name '*.go' -print -quit)" ]; then echo "skip $$m (no Go files yet)"; continue; fi; \
	  echo "build $$m"; \
	  (cd $$m && CGO_ENABLED=0 go build -trimpath -o ../../bin/$$(basename $$m)/ ./...); \
	done

generate: generate-contract generate-go generate-ts ## Lint and bundle the contract, generate the Go servers and the TypeScript types

generate-contract: ## Join contracts/modules/*.yaml with the root, lint it and bundle contracts/dist/openapi.json
	node scripts/contract-root.mjs
	$(REDOCLY) lint $(CONTRACT_ROOT)
	$(REDOCLY) bundle $(CONTRACT_ROOT) -o $(CONTRACT)

generate-go: generate-contract ## One oapi-codegen strict server per module (internal/<module>/http/api.gen.go)
	@set -e; for m in $(API_MODULES); do \
	  dir=services/api/internal/$$m/http; \
	  if [ ! -f $$dir/oapi-codegen.yaml ]; then echo "missing $$dir/oapi-codegen.yaml for contracts/modules/$$m.yaml"; exit 1; fi; \
	  echo "oapi-codegen $$m"; \
	  (cd $$dir && go tool oapi-codegen -config oapi-codegen.yaml ../../../../../$(CONTRACT)); \
	done

generate-ts: generate-contract ## TypeScript types for openapi-fetch (apps/mobile/src/shared/api/schema.gen.ts)
	cd apps/mobile && pnpm exec openapi-typescript ../../$(CONTRACT) -o src/shared/api/schema.gen.ts

mock-api: generate-contract ## Serve the contract with Prism on port 4010 (example responses)
	pnpm exec prism mock $(CONTRACT) --port 4010 --host 0.0.0.0

dev: generate-go ## Start the local stack with docker compose and run migrations (docs/local-dev.md)
	@docker info >/dev/null 2>&1 || { echo "Docker is not running. Start Docker Desktop and run make dev again."; exit 1; }
	@[ -f .env ] || { cp .env.example .env; echo "Created .env from .env.example (fake local values)."; }
	@[ -f certs/ca.crt ] || $(MAKE) --no-print-directory certs
	$(COMPOSE) up -d --wait postgres redis keycloak mailpit
	@$(MAKE) --no-print-directory migrate
	$(COMPOSE) up -d --build --wait api bank-simulator caddy
	@echo ""
	@echo "Fynk local stack is up:"
	@echo "  API            http://localhost:8080/healthz"
	@echo "  Keycloak       http://localhost:8081  (admin console: /admin)"
	@echo "  Mailpit        http://localhost:8025"
	@echo "  Banco Demo     http://localhost:8082/healthz  (placeholder)"
	@echo "  Caddy egress   https://localhost:8443  (mTLS towards the bank)"
	@echo "Stop it with make down. Ports and seeded users: docs/local-dev.md"

down: ## Stop the local stack (keeps the data; docker compose down -v also deletes it)
	$(COMPOSE) down

migrate: generate-go ## Run the Postgres migrations of every backend module (one schema and table each)
	$(COMPOSE) build api
	$(COMPOSE) run --rm migrate

certs: ## Create the local CA and the mTLS certificates in certs/ (FORCE=1 recreates them)
	@mkdir -p certs
	HOST_UID=$$(id -u) HOST_GID=$$(id -g) FORCE=$(FORCE) $(COMPOSE) run --rm certs

e2e: ## Run the Maestro flows in apps/mobile/e2e on the connected device or emulator
	@command -v maestro >/dev/null 2>&1 || { echo "Maestro is not installed: https://maestro.mobile.dev (needs Java 17+)"; exit 1; }
	maestro test apps/mobile/e2e

smoke: ## Run staging smoke tests against api, keycloak and bank-simulator (HU-033)
	./scripts/smoke.sh $${DOMAIN:-fynk.club}

tls-check: ## Verify TLS 1.2+ and reject TLS 1.0/1.1 and weak ciphers against staging (HU-032)
	@echo "Checking TLS configurations for Fynk staging endpoints..."
	@command -v sslyze >/dev/null 2>&1 || { echo "sslyze not found; installing or run: pip install sslyze"; exit 0; }
	sslyze api.$${DOMAIN:-fynk.club}:443 auth.$${DOMAIN:-fynk.club}:443 bancodemo.$${DOMAIN:-fynk.club}:443

history: ## Join the session logs into docs/history/PROJECT_HISTORY.md
	node scripts/build-history.mjs
