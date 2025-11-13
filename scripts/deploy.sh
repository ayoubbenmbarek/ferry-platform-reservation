#!/bin/bash

# Maritime Reservation Platform - Production Deployment Script
# This script deploys the application to production

set -e  # Exit on error

echo "========================================="
echo "Maritime Reservation Platform Deployment"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}Warning: Running as root is not recommended${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please copy .env.example to .env and configure it"
    exit 1
fi

# Check if backend .env.production exists
if [ ! -f "backend/.env.production" ]; then
    echo -e "${RED}Error: backend/.env.production file not found${NC}"
    echo "Please copy backend/.env.production.example to backend/.env.production and configure it"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    exit 1
fi

# Determine docker compose command
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo -e "${GREEN}Step 1: Pulling latest changes${NC}"
git pull origin main || echo -e "${YELLOW}Warning: Could not pull from git${NC}"

echo ""
echo -e "${GREEN}Step 2: Building Docker images${NC}"
$DOCKER_COMPOSE build --no-cache

echo ""
echo -e "${GREEN}Step 3: Stopping existing containers${NC}"
$DOCKER_COMPOSE down

echo ""
echo -e "${GREEN}Step 4: Starting services${NC}"
$DOCKER_COMPOSE up -d postgres redis

echo "Waiting for database to be ready..."
sleep 10

echo ""
echo -e "${GREEN}Step 5: Running database migrations${NC}"
$DOCKER_COMPOSE run --rm backend alembic upgrade head

echo ""
echo -e "${GREEN}Step 6: Starting all services${NC}"
$DOCKER_COMPOSE up -d

echo ""
echo -e "${GREEN}Step 7: Checking service health${NC}"
sleep 5

# Check if services are running
if $DOCKER_COMPOSE ps | grep -q "Up"; then
    echo -e "${GREEN}Services are running!${NC}"
else
    echo -e "${RED}Error: Some services failed to start${NC}"
    $DOCKER_COMPOSE ps
    exit 1
fi

echo ""
echo -e "${GREEN}Step 8: Cleaning up old images${NC}"
docker image prune -f

echo ""
echo "========================================="
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo "========================================="
echo ""
echo "Service URLs:"
echo "  - Frontend: http://localhost (or your domain)"
echo "  - Backend API: http://localhost/api"
echo "  - Health Check: http://localhost/health"
echo ""
echo "To view logs:"
echo "  $DOCKER_COMPOSE logs -f"
echo ""
echo "To stop services:"
echo "  $DOCKER_COMPOSE down"
echo ""
