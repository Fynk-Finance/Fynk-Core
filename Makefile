# Fynk monorepo tasks (owned by M0).
# On Windows run make from Git Bash. Recipes use POSIX sh.

GO_MODULES    := services/api services/bank-simulator
GOLANGCI_LINT := go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.15.0

# API contract: shared root plus one file per backend module (see contracts/openapi.yaml).
CONTRACT_ROOT := contracts/dist/openapi.root.yaml
CONTRACT      := contracts/dist/openapi.json
API_MODULES   := $(basename $(notdir $(wildcard contracts/modules/*.yaml)))
REDOCLY       := REDOCLY_TELEMETRY=off REDOCLY_SUPPRESS_UPDATE_NOTICE=true pnpm exec redocly

.DEFAULT_GOAL := help

.PHONY: help install lint lint-mobile lint-go test test-mobile test-go test-scripts \
        generate generate-contract generate-go generate-ts mock-api dev migrate e2e history

help: ## List the available targets
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-18s %s\n", $$1, $$2}'

install: ## Install JavaScript dependencies with the pinned pnpm
	pnpm install --frozen-lockfile

lint: lint-mobile lint-go ## Lint everything (ESLint, tsc, Prettier, go vet, golangci-lint)

lint-mobile: generate-ts ## Lint and typecheck the mobile app
	pnpm --filter @fynk/mobile lint
	pnpm --filter @fynk/mobile typecheck
	pnpm exec prettier --check .

lint-go: generate-go ## go vet and golangci-lint on every Go module that has code
	@set -e; for m in $(GO_MODULES); do \
	  if [ -z "$$(find $$m -name '*.go' -print -quit)" ]; then echo "skip $$m (no Go files yet)"; continue; fi; \
	  echo "lint $$m"; \
	  (cd $$m && go vet ./... && $(GOLANGCI_LINT) run ./...); \
	done

test: test-mobile test-go test-scripts ## Run every unit test

test-mobile: ## Jest for the mobile app
	pnpm --filter @fynk/mobile test

test-scripts: ## node:test for the repository scripts
	node --test scripts/*.test.mjs

test-go: generate-go ## go test on every Go module that has code
	@set -e; for m in $(GO_MODULES); do \
	  if [ -z "$$(find $$m -name '*.go' -print -quit)" ]; then echo "skip $$m (no Go files yet)"; continue; fi; \
	  echo "test $$m"; \
	  (cd $$m && go test ./...); \
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

dev: ## Start the local stack with docker compose and run migrations
	@echo "make dev is added in M0 Step 5 (feature/local-dev-stack)."; exit 1

migrate: ## Run the Postgres migrations of every backend module
	@echo "make migrate is added in M0 Step 5 (feature/local-dev-stack)."; exit 1

e2e: ## Run the Maestro end to end flows in apps/mobile/e2e
	@echo "make e2e is added once the first Maestro flow exists (M0 Step 4 or later)."; exit 1

history: ## Join the session logs into docs/history/PROJECT_HISTORY.md
	node scripts/build-history.mjs
