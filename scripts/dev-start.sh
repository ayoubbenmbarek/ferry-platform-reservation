#!/bin/bash

# Maritime Reservation Platform - Local Development Startup Script
# This script starts the application in development mode

set -e

echo "========================================="
echo "Maritime Reservation Platform - Dev Mode"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    exit 1
fi

# Determine docker compose command
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo -e "${GREEN}Step 1: Checking development environment${NC}"

# Create .env.development if it doesn't exist
if [ ! -f "backend/.env.development" ]; then
    echo -e "${YELLOW}Creating backend/.env.development from template${NC}"
    # File already created
fi

echo ""
echo -e "${GREEN}Step 2: Building development images${NC}"
$DOCKER_COMPOSE -f docker-compose.dev.yml build

echo ""
echo -e "${GREEN}Step 3: Starting services${NC}"
$DOCKER_COMPOSE -f docker-compose.dev.yml up -d postgres redis

echo "Waiting for database to be ready..."
sleep 5

echo ""
echo -e "${GREEN}Step 4: Running database migrations${NC}"
$DOCKER_COMPOSE -f docker-compose.dev.yml run --rm backend alembic upgrade head || {
    echo -e "${YELLOW}No migrations found or error occurred - continuing${NC}"
}

echo ""
echo -e "${GREEN}Step 5: Starting all services${NC}"
$DOCKER_COMPOSE -f docker-compose.dev.yml up -d

echo ""
echo -e "${GREEN}Step 6: Checking service health${NC}"
sleep 3

if $DOCKER_COMPOSE -f docker-compose.dev.yml ps | grep -q "Up"; then
    echo -e "${GREEN}Services are running!${NC}"
else
    echo "Warning: Some services may not be running"
    $DOCKER_COMPOSE -f docker-compose.dev.yml ps
fi

echo ""
echo "========================================="
echo -e "${GREEN}Development environment is ready!${NC}"
echo "========================================="
echo ""
echo "Service URLs:"
echo "  - Backend API: http://localhost:8010"
echo "  - API Docs: http://localhost:8010/docs"
echo "  - Health Check: http://localhost:8010/health"
echo "  - Frontend: Start with: cd frontend && npm start"
echo "  - PostgreSQL: localhost:5442 (user: postgres, pass: postgres)"
echo "  - Redis: localhost:6399"
echo ""
echo "Useful commands:"
echo "  View logs: $DOCKER_COMPOSE -f docker-compose.dev.yml logs -f"
echo "  Stop services: $DOCKER_COMPOSE -f docker-compose.dev.yml down"
echo "  Restart backend: $DOCKER_COMPOSE -f docker-compose.dev.yml restart backend"
echo "  Shell access: $DOCKER_COMPOSE -f docker-compose.dev.yml exec backend bash"
echo ""
echo "Next steps:"
echo "  1. Start the frontend: cd frontend && npm install && npm start"
echo "  2. Open http://localhost:3010 in your browser"
echo "  3. Backend API docs available at http://localhost:8010/docs"
echo ""