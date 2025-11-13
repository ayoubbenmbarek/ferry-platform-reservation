#!/bin/bash

# Database Restore Script
# Restores a PostgreSQL database backup

set -e

echo "========================================="
echo "Database Restore"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load environment variables
source .env 2>/dev/null || echo "Warning: .env file not found"

BACKUP_DIR="./backups"
POSTGRES_CONTAINER="maritime-postgres"

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}Error: Backup directory not found${NC}"
    exit 1
fi

# List available backups
echo "Available backups:"
echo ""
ls -lh "$BACKUP_DIR"/maritime_db_backup_*.sql.gz 2>/dev/null || {
    echo -e "${RED}No backups found${NC}"
    exit 1
}

echo ""
read -p "Enter the backup filename to restore: " BACKUP_FILE

if [ ! -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}WARNING: This will overwrite the current database!${NC}"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

echo ""
echo "Restoring database from $BACKUP_FILE..."

# Decompress if needed
if [[ $BACKUP_FILE == *.gz ]]; then
    echo "Decompressing backup..."
    gunzip -k "$BACKUP_DIR/$BACKUP_FILE"
    SQL_FILE="${BACKUP_FILE%.gz}"
else
    SQL_FILE="$BACKUP_FILE"
fi

# Stop services that use the database
echo "Stopping services..."
docker-compose stop backend celery-worker

# Drop and recreate database
echo "Recreating database..."
docker exec -t "$POSTGRES_CONTAINER" psql \
    -U "${POSTGRES_USER:-postgres}" \
    -c "DROP DATABASE IF EXISTS ${POSTGRES_DB:-maritime_reservations};"

docker exec -t "$POSTGRES_CONTAINER" psql \
    -U "${POSTGRES_USER:-postgres}" \
    -c "CREATE DATABASE ${POSTGRES_DB:-maritime_reservations};"

# Restore backup
echo "Restoring data..."
cat "$BACKUP_DIR/$SQL_FILE" | docker exec -i "$POSTGRES_CONTAINER" psql \
    -U "${POSTGRES_USER:-postgres}" \
    -d "${POSTGRES_DB:-maritime_reservations}"

# Clean up decompressed file
if [[ $BACKUP_FILE == *.gz ]]; then
    rm "$BACKUP_DIR/$SQL_FILE"
fi

# Restart services
echo "Restarting services..."
docker-compose start backend celery-worker

echo ""
echo -e "${GREEN}Database restored successfully!${NC}"
echo ""
