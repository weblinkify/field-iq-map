# FieldIQ v2 — developer entry points.
# Everything Docker-based works from a clean clone with no secrets.

SHELL := /bin/bash
COMPOSE ?= docker compose
WEB_URL ?= http://localhost:8080

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------- docker -----
.PHONY: up-mock up-real down logs
up-mock: ## Start web + mock API (zero setup, no secrets)
	$(COMPOSE) --profile mock up --build

up-real: ## Start web + Spring Boot API + PostGIS (auto-migrated and seeded)
	$(COMPOSE) --profile real up --build

down: ## Stop all containers and remove volumes
	$(COMPOSE) --profile mock --profile real down -v --remove-orphans

logs: ## Tail container logs
	$(COMPOSE) --profile mock --profile real logs -f

# ------------------------------------------------------------- local dev -----
.PHONY: install dev dev-db dev-api dev-web dev-mock
install: ## Install all Node dependencies
	cd shared && npm ci
	cd services/mock-api && npm ci
	cd apps/web && npm ci
	cd e2e && npm ci

dev-db: ## Start only PostGIS in Docker (port 5432)
	$(COMPOSE) up -d --wait postgis

dev-api: ## Run the Spring Boot API locally (needs dev-db)
	cd services/api && ./mvnw spring-boot:run

dev-mock: ## Run the mock API locally with hot reload (port 4000)
	cd services/mock-api && npm run dev

dev-web: ## Run ng serve proxied to the API (API_TARGET=http://localhost:4000 for mock)
	cd apps/web && npm start

dev: dev-db ## Postgres in Docker + API + ng serve (Ctrl+C stops both)
	@trap 'kill 0' INT TERM; \
	  (cd services/api && ./mvnw -q spring-boot:run) & \
	  (cd apps/web && API_TARGET=http://localhost:8080 npm start) & \
	  wait

# ------------------------------------------------------------- quality -------
.PHONY: codegen lint test test-api test-web test-mock test-shared contract
codegen: ## Regenerate GraphQL + OpenAPI types (web and mock API)
	cd apps/web && npm run codegen
	cd services/mock-api && npm run codegen

lint: ## Lint everything
	cd services/api && ./mvnw -q spotless:check
	cd apps/web && npm run lint
	cd services/mock-api && npm run lint
	cd shared && npm run lint

test: test-shared test-mock test-web test-api ## Run all unit + integration tests

test-api: ## Backend tests (needs Docker for Testcontainers)
	cd services/api && ./mvnw -B verify

test-web: ## Angular unit tests with coverage
	cd apps/web && npm run test:ci

test-mock: ## Mock API tests
	cd services/mock-api && npm test

test-shared: ## Fixture generator tests
	cd shared && npm test

contract: ## Contract tests: mock vs real API (starts both in Docker)
	$(COMPOSE) up -d --build --wait postgis api mock-api
	cd services/mock-api && MOCK_URL=http://localhost:4000 REAL_URL=http://localhost:8081 npm run test:contract

contract-snapshots: ## Re-export shared/openapi/openapi.yaml + GraphQL schema snapshot from the backend
	cd services/api && ./mvnw -B test -Dtest='OpenApiSnapshotTest,GraphQlSchemaSnapshotTest' -Dcontract.update=true -Djacoco.skip=true

# ------------------------------------------------------------- data ----------
.PHONY: fixtures seed
fixtures: ## Regenerate shared/fixtures/sensors.json (deterministic)
	cd shared && npm run generate

seed: ## Re-seed the real database from shared/fixtures/sensors.json
	$(COMPOSE) --profile real up -d --wait postgis
	$(COMPOSE) --profile real run --rm -e FIELDIQ_SEED_FORCE=true -e FIELDIQ_EXIT_AFTER_SEED=true api

# ------------------------------------------------------------- e2e -----------
.PHONY: e2e-mock e2e-real
e2e-mock: ## Playwright against the mock profile
	NG_CONFIG=e2e BASEMAP=offline $(COMPOSE) --profile mock up -d --build --wait
	cd e2e && E2E_MODE=mock BASE_URL=$(WEB_URL) npx playwright test

e2e-real: ## Playwright against the real profile
	NG_CONFIG=e2e BASEMAP=offline $(COMPOSE) --profile real up -d --build --wait
	cd e2e && E2E_MODE=real BASE_URL=$(WEB_URL) npx playwright test
