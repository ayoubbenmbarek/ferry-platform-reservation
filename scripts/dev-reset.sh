#!/bin/bash

# Reset development environment (WARNING: Deletes all data)

set -e

echo "========================================="
echo "Reset Development Environment"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${RED}WARNING: This will delete all database data and containers!${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Reset cancelled."
    exit 0
fi

# Determine docker compose command
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo ""
echo -e "${YELLOW}Stopping and removing containers...${NC}"
$DOCKER_COMPOSE -f docker-compose.dev.yml down -v

echo ""
echo -e "${YELLOW}Removing development images...${NC}"
docker rmi maritime-reservation-website-backend:latest 2>/dev/null || true
docker images | grep maritime | awk '{print $3}' | xargs docker rmi -f 2>/dev/null || true

echo ""
echo -e "${YELLOW}Cleaning Docker system...${NC}"
docker system prune -f

echo ""
echo -e "${GREEN}Development environment reset complete!${NC}"
echo ""
echo "To start fresh:"
echo "  ./scripts/dev-start.sh"
echo ""