# Port Configuration

This document lists all ports used by the Maritime Reservation Platform in development mode.

## Development Ports (docker-compose.dev.yml)

All ports have been configured to avoid conflicts with other local applications.

| Service | Host Port | Container Port | Access URL | Notes |
|---------|-----------|----------------|------------|-------|
| **PostgreSQL** | 5442 | 5432 | localhost:5442 | Database server |
| **Redis** | 6399 | 6379 | localhost:6399 | Cache & message broker |
| **Backend API** | 8010 | 8000 | http://localhost:8010 | FastAPI application |
| **Frontend** | 3010 | 3010 | http://localhost:3010 | React application |

## Port Mappings Explained

The format is `host:container`:
- **Host Port**: The port on your local machine (left side)
- **Container Port**: The port inside the Docker container (right side)

### Why These Ports?

**Default Conflicts:**
- PostgreSQL default (5432) might conflict with local PostgreSQL
- Redis default (6379) might conflict with local Redis
- Backend default (8000) might conflict with other APIs

**Custom Ports:**
- **5442** for PostgreSQL - Avoids standard 5432
- **6399** for Redis - Avoids standard 6379
- **8010** for Backend - Avoids standard 8000

## Connection Details

### PostgreSQL Database

```bash
# From your host machine
Host: localhost
Port: 5442
Database: maritime_reservations_dev
User: postgres
Password: postgres
```

```bash
# Connection string
postgresql://postgres:postgres@localhost:5442/maritime_reservations_dev
```

```bash
# Using psql
psql -h localhost -p 5442 -U postgres -d maritime_reservations_dev
```

### Redis

```bash
# From your host machine
Host: localhost
Port: 6399
```

```bash
# Using redis-cli
redis-cli -p 6399
```

### Backend API

```bash
# API Base URL
http://localhost:8010

# Health Check
curl http://localhost:8010/health

# API Documentation
http://localhost:8010/docs
http://localhost:8010/redoc
```

### Frontend

```bash
# React App
http://localhost:3010

# Automatically proxies API requests to localhost:8010
```

## Internal Docker Network

Inside the Docker network, containers communicate using **standard ports**:

| Service | Internal Address | Internal Port |
|---------|-----------------|---------------|
| PostgreSQL | postgres:5432 | 5432 |
| Redis | redis:6379 | 6379 |
| Backend | backend:8000 | 8000 |

This is why the backend environment variables use:
```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/maritime_reservations_dev
REDIS_URL=redis://redis:6379/0
```

## Changing Ports

If you need to change ports, update these files:

### 1. docker-compose.dev.yml

```yaml
services:
  postgres:
    ports:
      - "YOUR_PORT:5432"  # Change YOUR_PORT

  redis:
    ports:
      - "YOUR_PORT:6379"  # Change YOUR_PORT

  backend:
    ports:
      - "YOUR_PORT:8000"  # Change YOUR_PORT
```

### 2. frontend/package.json

```json
{
  "proxy": "http://localhost:YOUR_BACKEND_PORT"
}
```

### 3. backend/.env.development (if accessing from host)

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:YOUR_POSTGRES_PORT/maritime_reservations_dev
REDIS_URL=redis://localhost:YOUR_REDIS_PORT/0
```

### 4. Documentation

Update DEVELOPMENT.md and this file with new ports.

## Troubleshooting Port Conflicts

### Check if Port is in Use

```bash
# On macOS/Linux
lsof -i :5442  # Check PostgreSQL port
lsof -i :6399  # Check Redis port
lsof -i :8010  # Check Backend port
lsof -i :3010  # Check Frontend port

# On Windows
netstat -ano | findstr :5442
netstat -ano | findstr :6399
netstat -ano | findstr :8010
netstat -ano | findstr :3010
```

### Kill Process Using Port

```bash
# On macOS/Linux
kill -9 <PID>

# On Windows
taskkill /PID <PID> /F
```

### Docker Port Issues

```bash
# Stop all containers
docker-compose -f docker-compose.dev.yml down

# Remove containers
docker-compose -f docker-compose.dev.yml rm

# Restart
docker-compose -f docker-compose.dev.yml up -d
```

## Production Ports

Production uses standard ports with Nginx reverse proxy:

| Service | Port | Access |
|---------|------|--------|
| Nginx | 80, 443 | Public HTTPS |
| Backend | 8000 | Internal only |
| PostgreSQL | 5432 | Internal only |
| Redis | 6379 | Internal only |

Public access goes through Nginx on port 443 (HTTPS).

## Quick Reference

```bash
# Development URLs
Frontend:        http://localhost:3010
Backend API:     http://localhost:8010
API Docs:        http://localhost:8010/docs
PostgreSQL:      localhost:5442
Redis:           localhost:6399

# Start services
./scripts/dev-start.sh

# View logs
./scripts/dev-logs.sh

# Stop services
./scripts/dev-stop.sh
```

## Environment Variables

The docker-compose.dev.yml uses these environment variables:

```yaml
environment:
  DATABASE_URL: postgresql://postgres:postgres@postgres:5432/maritime_reservations_dev
  REDIS_URL: redis://redis:6379/0
  ALLOWED_ORIGINS: http://localhost:3010,http://127.0.0.1:3010
```

Note: Inside Docker network, services use **container names** and **internal ports**.

## Summary

✅ **PostgreSQL**: localhost:5442 (host) → postgres:5432 (container)
✅ **Redis**: localhost:6399 (host) → redis:6379 (container)
✅ **Backend**: localhost:8010 (host) → backend:8000 (container)
✅ **Frontend**: localhost:3010 (runs outside Docker, proxies to 8010)

All ports configured to avoid conflicts with other local applications!