# Developer shortcuts. Run `make` to list them.
.DEFAULT_GOAL := help
BACKEND := backend
FRONTEND := frontend

help: ## List the available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup: ## Install backend (uv) and frontend (npm) dependencies
	cd $(BACKEND) && uv sync --frozen
	cd $(FRONTEND) && npm ci

dev: ## Run the API on :8000 and the web app on :5173, both with hot reload
	$(MAKE) -j2 dev-api dev-web

dev-api:
	cd $(BACKEND) && uv run uvicorn gridbricks.main:create_app --factory --reload --port 8000

dev-web:
	cd $(FRONTEND) && npm run dev

ingest: ## Rebuild the data snapshot from the Elexon API
	cd $(BACKEND) && uv run python -m gridbricks.ingest

lint: ## Lint and format checks
	cd $(BACKEND) && uv run ruff check . && uv run ruff format --check .
	cd $(FRONTEND) && npm run lint && npm run format:check

typecheck: ## Static type checks (mypy strict, tsc)
	cd $(BACKEND) && uv run mypy
	cd $(FRONTEND) && npm run typecheck

test: ## Backend and frontend tests
	cd $(BACKEND) && uv run pytest --cov
	cd $(FRONTEND) && npm test

check: lint typecheck test ## Everything CI runs before the Docker stage

contracts: ## Regenerate the TypeScript API types and requirements.txt from their sources
	cd $(BACKEND) && uv run python -m gridbricks.export_openapi ../$(FRONTEND)/src/api/openapi.json
	cd $(FRONTEND) && npm run generate:api
	cd $(BACKEND) && uv export --frozen --no-dev --no-hashes --no-emit-project -o ../requirements.txt

up: ## Build and run the production container on http://localhost:8000
	docker compose up --build

down: ## Stop the container
	docker compose down

e2e: ## Browser smoke tests against http://localhost:8000
	cd $(FRONTEND) && npx playwright test e2e/smoke.spec.ts

screenshots: ## Refresh docs/images (needs the app running on :8000)
	cd $(FRONTEND) && SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts

.PHONY: help setup dev dev-api dev-web ingest lint typecheck test check contracts up down e2e screenshots
