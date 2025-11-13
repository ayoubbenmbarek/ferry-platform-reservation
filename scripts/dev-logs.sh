#!/bin/bash

# View development logs

# Determine docker compose command
if docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

if [ -z "$1" ]; then
    echo "Viewing all service logs (Ctrl+C to exit)..."
    echo ""
    $DOCKER_COMPOSE -f docker-compose.dev.yml logs -f
else
    echo "Viewing logs for: $1"
    echo ""
    $DOCKER_COMPOSE -f docker-compose.dev.yml logs -f "$1"
fi