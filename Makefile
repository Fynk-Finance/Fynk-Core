# Fynk monorepo tasks (owned by M0).
# On Windows run make from Git Bash. Recipes use POSIX sh.

GO_MODULES    := services/api services/bank-simulator
GOLANGCI_LINT := go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.15.0

.DEFAULT_GOAL := help

.PHONY: help install lint lint-mobile lint-go test test-mobile test-go \
        generate mock-api dev migrate e2e history

help: ## List the available targets
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'

install: ## Install JavaScript dependencies with the pinned pnpm
	pnpm install --frozen-lockfile

lint: lint-mobile lint-go ## Lint everything (ESLint, tsc, Prettier, go vet, golangci-lint)

lint-mobile: ## Lint and typecheck the mobile app
	pnpm --filter @fynk/mobile lint
	pnpm --filter @fynk/mobile typecheck
	pnpm exec prettier --check .

lint-go: ## go vet and golangci-lint on every Go module that has code
	@set -e; for m in $(GO_MODULES); do \
	  if [ -z "$$(find $$m -name '*.go' -print -quit)" ]; then echo "skip $$m (no Go files yet)"; continue; fi; \
	  echo "lint $$m"; \
	  (cd $$m && go vet ./... && $(GOLANGCI_LINT) run ./...); \
	done

test: test-mobile test-go ## Run every unit test

test-mobile: ## Jest for the mobile app
	pnpm --filter @fynk/mobile test

test-go: ## go test on every Go module that has code
	@set -e; for m in $(GO_MODULES); do \
	  if [ -z "$$(find $$m -name '*.go' -print -quit)" ]; then echo "skip $$m (no Go files yet)"; continue; fi; \
	  echo "test $$m"; \
	  (cd $$m && go test ./...); \
	done

generate: ## Bundle the contract and generate the Go servers and the TypeScript client
	@echo "make generate is added in M0 Step 3 (feature/api-contract-pipeline)."; exit 1

mock-api: ## Serve the contract with Prism on port 4010
	@echo "make mock-api is added in M0 Step 3 (feature/api-contract-pipeline)."; exit 1

dev: ## Start the local stack with docker compose and run migrations
	@echo "make dev is added in M0 Step 5 (feature/local-dev-stack)."; exit 1

migrate: ## Run the Postgres migrations of every backend module
	@echo "make migrate is added in M0 Step 5 (feature/local-dev-stack)."; exit 1

e2e: ## Run the Maestro end to end flows in apps/mobile/e2e
	@echo "make e2e is added once the first Maestro flow exists (M0 Step 4 or later)."; exit 1

history: ## Join the session logs into docs/history/PROJECT_HISTORY.md
	node scripts/build-history.mjs
