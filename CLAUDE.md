# VoilaFerry - Project Context for AI Assistants

## Project Overview

VoilaFerry is a ferry booking platform for Mediterranean routes (Tunisia, Italy, France). It aggregates multiple ferry operators and provides unified search, booking, and payment.

## Architecture

```
├── frontend/          # React 18 + TypeScript + TailwindCSS
├── backend/           # FastAPI + PostgreSQL + Redis + Celery
├── mobile/            # React Native (Expo)
├── chatbot/           # AI chatbot service (Node.js)
├── k8s/               # Kubernetes manifests (k3s)
└── .github/workflows/ # CI/CD pipelines
```

## Key Technologies

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, TailwindCSS, Redux Toolkit, React Router |
| Backend | FastAPI, SQLAlchemy, Alembic, Pydantic, Celery |
| Database | PostgreSQL 15 |
| Cache/Queue | Redis |
| Auth | JWT + OAuth2 (Google) |
| Payments | Stripe |
| Infra | Docker, Kubernetes (k3s), GitHub Actions |
| Monitoring | Sentry |

## Environment

- **Staging**: staging.voilaferry.com, api-staging.voilaferry.com
- **Production**: voilaferry.com, api.voilaferry.com

## Important Directories

- `backend/app/api/v1/` - API endpoints
- `backend/app/models/` - SQLAlchemy models
- `backend/app/services/` - Business logic
- `backend/app/tasks/` - Celery async tasks
- `frontend/src/components/` - React components
- `frontend/src/pages/` - Page components
- `frontend/src/store/` - Redux slices
- `k8s/base/` - Base Kubernetes manifests
- `k8s/overlays/staging/` - Staging-specific configs

## Running Locally

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8010

# Frontend
cd frontend && npm install && npm start

# With Docker
docker-compose up
```

## Testing

```bash
# Backend tests
cd backend && pytest

# Frontend tests
cd frontend && npm test
```

## Common Tasks

### Add new API endpoint
1. Create route in `backend/app/api/v1/`
2. Add to router in `backend/app/api/v1/__init__.py`
3. Create schemas in `backend/app/schemas/`

### Add new frontend page
1. Create component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`

### Database migration
```bash
cd backend && alembic revision --autogenerate -m "description"
alembic upgrade head
```

## Ferry Operators

- CTN (Compagnie Tunisienne de Navigation)
- GNV (Grandi Navi Veloci)
- Corsica Lines
- Danel/Casanova

## Mock Mode

Set `USE_MOCK_FERRIES=true` in environment to use mock ferry data (for development/staging without real API keys).
