#!/bin/bash

# Stop development environment

set -e

echo "Stopping development services..."

# Determine docker compose command
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

$DOCKER_COMPOSE -f docker-compose.dev.yml down

echo ""
echo "Development services stopped."
echo ""
echo "To remove volumes (WARNING: deletes database data):"
echo "  $DOCKER_COMPOSE -f docker-compose.dev.yml down -v"
echo ""