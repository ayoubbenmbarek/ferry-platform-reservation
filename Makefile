# VoilaFerry Development Makefile
# Usage: make <target>

.PHONY: help dev up down logs restart build clean test test-backend test-frontend db-migrate db-upgrade shell

# Default target
help:
	@echo "VoilaFerry Development Commands"
	@echo "================================"
	@echo "  make dev          - Start all services (docker-compose up -d)"
	@echo "  make up           - Alias for 'make dev'"
	@echo "  make down         - Stop all services"
	@echo "  make restart      - Restart all services"
	@echo "  make logs         - Follow logs from all services"
	@echo "  make logs-backend - Follow backend logs only"
	@echo "  make logs-celery  - Follow celery worker logs"
	@echo "  make build        - Rebuild all containers"
	@echo "  make clean        - Stop and remove all containers, volumes"
	@echo "  make test         - Run all tests"
	@echo "  make test-backend - Run backend tests only"
	@echo "  make db-migrate   - Create new migration"
	@echo "  make db-upgrade   - Apply migrations"
	@echo "  make shell        - Open shell in backend container"

# Docker Compose variables
DC = docker-compose --env-file backend/.env.development -f docker-compose.dev.yml

# Start development environment
dev:
	$(DC) up -d
	@echo "✅ Development environment started"
	@echo "   Frontend: http://localhost:3001"
	@echo "   Backend:  http://localhost:8010"
	@echo "   PgAdmin:  http://localhost:5050"

up: dev

# Stop all services
down:
	$(DC) down

# Restart all services
restart:
	$(DC) restart

# Follow logs
logs:
	$(DC) logs -f

logs-backend:
	$(DC) logs -f backend

logs-celery:
	$(DC) logs -f celery-worker

logs-redis:
	$(DC) logs -f redis

# Rebuild containers
build:
	$(DC) build

# Full rebuild (no cache)
build-fresh:
	$(DC) build --no-cache

# Clean everything
clean:
	$(DC) down -v --remove-orphans
	@echo "✅ All containers and volumes removed"

# Run tests
test: test-backend

test-backend:
	$(DC) exec backend pytest tests/ -v

test-unit:
	$(DC) exec backend pytest tests/unit/ -v

# Database commands
db-migrate:
	$(DC) exec backend alembic revision --autogenerate -m "$(msg)"

db-upgrade:
	$(DC) exec backend alembic upgrade head

db-downgrade:
	$(DC) exec backend alembic downgrade -1

# Shell access
shell:
	$(DC) exec backend /bin/bash

shell-db:
	$(DC) exec postgres psql -U postgres -d maritime_reservations_dev

# Status
status:
	$(DC) ps
