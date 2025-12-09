# Local Development Guide

This guide will help you run the Maritime Reservation Platform locally for development and testing.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Setup Instructions](#setup-instructions)
4. [Development Workflow](#development-workflow)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)
7. [Development Tools](#development-tools)

---

## Quick Start

**TL;DR - Get running in 5 minutes:**

```bash
# 1. Install Docker Desktop (if not installed)
# Download from: https://www.docker.com/products/docker-desktop

# 2. Start backend services
./scripts/dev-start.sh

# 3. Start frontend (in a new terminal)
cd frontend
npm install
npm start

# 4. Open browser
# Frontend: http://localhost:3010
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

---

## Prerequisites

### Required Software

1. **Docker Desktop** (includes Docker & Docker Compose)
   - Mac: https://docs.docker.com/desktop/install/mac-install/
   - Windows: https://docs.docker.com/desktop/install/windows-install/
   - Linux: https://docs.docker.com/desktop/install/linux-install/

2. **Node.js 18+** (for frontend development)
   ```bash
   # Check version
   node --version

   # Install from: https://nodejs.org/
   ```

3. **Git**
   ```bash
   git --version
   ```

### Recommended Tools

- **VS Code** with extensions:
  - Python
  - ESLint
  - Prettier
  - Docker
  - Thunder Client (API testing)

- **Postman** or **Insomnia** (API testing)

---

## Setup Instructions

### 1. Clone Repository

```bash
git clone <your-repo-url> maritime-reservation-website
cd maritime-reservation-website
```

### 2. Start Backend with Docker

The easiest way to run the backend is using Docker:

```bash
# Start all backend services (PostgreSQL, Redis, FastAPI, Celery)
./scripts/dev-start.sh
```

This script will:
- Build Docker images for development
- Start PostgreSQL and Redis
- Run database migrations
- Start the FastAPI backend with hot reload
- Start Celery worker for background tasks

**Backend will be available at:**
- API: http://localhost:8010
- API Docs (Swagger): http://localhost:8010/docs
- API Docs (ReDoc): http://localhost:8010/redoc
- Health Check: http://localhost:8010/health

### 3. Start Frontend

In a **new terminal window**:

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start development server with hot reload
npm start
```

**Frontend will be available at:** http://localhost:3010

The frontend will automatically proxy API requests to http://localhost:8010

### 4. Verify Everything Works

1. **Check backend health:**
   ```bash
   curl http://localhost:8010/health
   ```

2. **Check API docs:**
   Open http://localhost:8010/docs in browser

3. **Check frontend:**
   Open http://localhost:3010 in browser

---

## Development Workflow

### Backend Development (Docker)

#### View Logs

```bash
# All services
./scripts/dev-logs.sh

# Specific service
./scripts/dev-logs.sh backend
./scripts/dev-logs.sh postgres
./scripts/dev-logs.sh celery-worker
```

#### Restart Services

```bash
# Restart backend only
docker-compose -f docker-compose.dev.yml restart backend

# Restart all services
docker-compose -f docker-compose.dev.yml restart
```

#### Access Backend Shell

```bash
docker-compose -f docker-compose.dev.yml exec backend bash
```

#### Run Database Migrations

```bash
# Create new migration
docker-compose -f docker-compose.dev.yml exec backend alembic revision --autogenerate -m "description"

# Apply migrations
docker-compose -f docker-compose.dev.yml exec backend alembic upgrade head

# Rollback migration
docker-compose -f docker-compose.dev.yml exec backend alembic downgrade -1
```

#### Access Database

```bash
# Using psql
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d maritime_reservations_dev

# Common queries:
# \dt - list tables
# \d table_name - describe table
# SELECT * FROM users;
```

#### Stop Services

```bash
# Stop all services
./scripts/dev-stop.sh

# Or manually
docker-compose -f docker-compose.dev.yml down
```

#### Reset Everything (Fresh Start)

```bash
# WARNING: Deletes all data
./scripts/dev-reset.sh
```

### Frontend Development

#### Available Scripts

```bash
# Start dev server
npm start

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Build for production
npm run build

# Lint code
npm run lint
```

#### Hot Reload

Both backend and frontend support hot reload:
- **Backend**: Changes to Python files automatically restart the server
- **Frontend**: Changes to React files automatically refresh the browser

### Making Code Changes

1. **Backend changes** (`/backend`):
   - Edit Python files
   - Server automatically reloads
   - Changes appear immediately

2. **Frontend changes** (`/frontend`):
   - Edit React/TypeScript files
   - Browser automatically refreshes
   - Changes appear immediately

3. **Database changes**:
   - Modify models in `/backend/app/models/`
   - Create migration:
     ```bash
     docker-compose -f docker-compose.dev.yml exec backend alembic revision --autogenerate -m "add new field"
     ```
   - Apply migration:
     ```bash
     docker-compose -f docker-compose.dev.yml exec backend alembic upgrade head
     ```

---

## Testing

### Backend Tests

```bash
# Run all tests
docker-compose -f docker-compose.dev.yml exec backend pytest

# Run with coverage
docker-compose -f docker-compose.dev.yml exec backend pytest --cov=app

# Run specific test file
docker-compose -f docker-compose.dev.yml exec backend pytest tests/test_auth.py

# Run specific test
docker-compose -f docker-compose.dev.yml exec backend pytest tests/test_auth.py::test_register
```

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- UserProfile.test.tsx
```

### Manual API Testing

**Using Swagger UI:**
1. Go to http://localhost:8010/docs
2. Try out endpoints interactively

**Using curl:**
```bash
# Health check
curl http://localhost:8010/health

# Register user
curl -X POST http://localhost:8010/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123",
    "first_name": "Test",
    "last_name": "User"
  }'

# Login
curl -X POST http://localhost:8010/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123"
  }'
```

---

## Troubleshooting

### Backend Issues

#### Services won't start

```bash
# Check Docker is running
docker ps

# Check logs
./scripts/dev-logs.sh

# Try rebuilding
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up -d
```

#### Database connection errors

```bash
# Check PostgreSQL is running
docker-compose -f docker-compose.dev.yml ps postgres

# Check database logs
docker-compose -f docker-compose.dev.yml logs postgres

# Restart database
docker-compose -f docker-compose.dev.yml restart postgres
```

#### Port already in use

```bash
# Find what's using port 8010
lsof -i :8010

# Kill the process
kill -9 <PID>

# Or change port in docker-compose.dev.yml
```

#### Python module not found

```bash
# Rebuild backend image
docker-compose -f docker-compose.dev.yml build backend
docker-compose -f docker-compose.dev.yml up -d backend
```

### Frontend Issues

#### Dependencies won't install

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

#### Port 3010 already in use

```bash
# Find what's using port 3010
lsof -i :3010

# Kill the process
kill -9 <PID>

# Or set a different port
PORT=3001 npm start
```

#### Proxy errors (API calls failing)

Check `frontend/package.json` has:
```json
"proxy": "http://localhost:8010"
```

Make sure backend is running on port 8010.

### Docker Issues

#### Docker daemon not running

- **Mac/Windows**: Open Docker Desktop
- **Linux**: `sudo systemctl start docker`

#### Out of disk space

```bash
# Clean up Docker
docker system prune -a
docker volume prune
```

#### Permission errors

```bash
# Add user to docker group (Linux)
sudo usermod -aG docker $USER
# Log out and back in
```

---

## Development Tools

### Database Management

**Using psql (command line):**
```bash
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d maritime_reservations_dev
```

**Using GUI tools:**
- **pgAdmin**: https://www.pgadmin.org/
- **DBeaver**: https://dbeaver.io/
- **TablePlus**: https://tableplus.com/

Connection details:
- Host: localhost
- Port: 5442
- Database: maritime_reservations_dev
- User: postgres
- Password: postgres

### Redis Management

**Using redis-cli:**
```bash
docker-compose -f docker-compose.dev.yml exec redis redis-cli

# Common commands:
PING
KEYS *
GET key_name
FLUSHDB  # Clear database
```

**Using GUI tools:**
- **RedisInsight**: https://redis.com/redis-enterprise/redis-insight/

Connection:
- Host: localhost
- Port: 6399

### API Testing

**Swagger UI (built-in):**
- http://localhost:8010/docs

**Postman:**
1. Import API endpoints from Swagger
2. Create environment with baseUrl: http://localhost:8010

**Thunder Client (VS Code):**
- Install extension
- Create new request
- Set base URL to http://localhost:8010

### Code Quality

**Backend:**
```bash
# Lint with flake8
docker-compose -f docker-compose.dev.yml exec backend flake8 app

# Format with black
docker-compose -f docker-compose.dev.yml exec backend black app

# Type check with mypy
docker-compose -f docker-compose.dev.yml exec backend mypy app
```

**Frontend:**
```bash
cd frontend

# Lint
npm run lint

# Format with Prettier
npm run format
```

---

## Environment Variables

Development environment variables are in:
- **Backend**: `backend/.env.development` (safe to commit)
- **Frontend**: Uses backend proxy, no .env needed

**Important:**
- Development uses test API keys
- Database password is "postgres" (not secure, dev only)
- DEBUG mode is enabled

---

## Common Development Tasks

### Create a new database model

1. Create model in `backend/app/models/`
2. Import in `backend/alembic/env.py`
3. Generate migration:
   ```bash
   docker-compose -f docker-compose.dev.yml exec backend alembic revision --autogenerate -m "add new model"
   ```
4. Review migration in `backend/alembic/versions/`
5. Apply migration:
   ```bash
   docker-compose -f docker-compose.dev.yml exec backend alembic upgrade head
   ```

### Add a new API endpoint

1. Create router in `backend/app/api/v1/`
2. Add schemas in `backend/app/schemas/`
3. Register router in `backend/app/main.py`
4. Test in Swagger UI: http://localhost:8000/docs

### Add a new React page

1. Create component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Add navigation link in layout component

### Mock ferry operator APIs

For development, you can mock external APIs:

1. Create mock responses in `backend/app/services/ferry_integrations/`
2. Use environment variable to enable mock mode
3. Test without real API credentials

---

## Development Best Practices

1. **Always start with `dev-start.sh`** - Ensures clean state
2. **Use hot reload** - No need to restart for code changes
3. **Check logs** - Use `dev-logs.sh` to debug issues
4. **Write tests** - Test new features as you develop
5. **Use Swagger** - Test APIs interactively
6. **Commit often** - Small, focused commits
7. **Keep backend updated** - Pull latest changes regularly

---

## Next Steps

Once you're comfortable with local development:

1. Review [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
2. Set up CI/CD with GitHub Actions
3. Configure real API keys for ferry operators
4. Set up staging environment
5. Deploy to production

---

## Getting Help

- **Documentation**: Check `/docs` directory
- **API Docs**: http://localhost:8000/docs
- **Logs**: `./scripts/dev-logs.sh`
- **Issues**: Create GitHub issue

---

## Quick Reference

```bash
# Start everything
./scripts/dev-start.sh

# Stop everything
./scripts/dev-stop.sh

# Reset everything (WARNING: deletes data)
./scripts/dev-reset.sh

# View logs
./scripts/dev-logs.sh [service-name]

# Frontend
cd frontend && npm start

# Access backend shell
docker-compose -f docker-compose.dev.yml exec backend bash

# Access database
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d maritime_reservations_dev

# Run migrations
docker-compose -f docker-compose.dev.yml exec backend alembic upgrade head

# Run tests
docker-compose -f docker-compose.dev.yml exec backend pytest
cd frontend && npm test
```

Happy coding! 🚀