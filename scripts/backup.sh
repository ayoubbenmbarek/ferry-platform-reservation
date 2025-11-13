#!/bin/bash

# Database Backup Script
# Creates a backup of the PostgreSQL database

set -e

echo "========================================="
echo "Database Backup"
echo "========================================="
echo ""

# Load environment variables
source .env 2>/dev/null || echo "Warning: .env file not found"

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="maritime_db_backup_${TIMESTAMP}.sql"
POSTGRES_CONTAINER="maritime-postgres"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Creating backup: $BACKUP_FILE"

# Run pg_dump inside the container
docker exec -t "$POSTGRES_CONTAINER" pg_dump \
    -U "${POSTGRES_USER:-postgres}" \
    -d "${POSTGRES_DB:-maritime_reservations}" \
    > "$BACKUP_DIR/$BACKUP_FILE"

# Compress backup
echo "Compressing backup..."
gzip "$BACKUP_DIR/$BACKUP_FILE"

echo ""
echo "Backup completed: $BACKUP_DIR/$BACKUP_FILE.gz"

# Keep only last 7 days of backups
echo "Cleaning old backups (keeping last 7 days)..."
find "$BACKUP_DIR" -name "maritime_db_backup_*.sql.gz" -mtime +7 -delete

echo ""
echo "Done!"
