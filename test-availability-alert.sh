#!/bin/bash

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:8010/api/v1"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Availability Alert Testing Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Create Alert
echo -e "${YELLOW}Step 1: Creating availability alert...${NC}"
ALERT_RESPONSE=$(curl -s -X POST ${API_URL}/availability-alerts/ \
  -H "Content-Type: application/json" \
  -d '{
    "alert_type": "vehicle",
    "email": "ayoubenmbarek@gmail.com",
    "departure_port": "tangier",
    "arrival_port": "algeciras",
    "departure_date": "2025-12-15",
    "is_round_trip": false,
    "num_adults": 2,
    "num_children": 0,
    "vehicle_type": "car",
    "vehicle_length_cm": 450,
    "alert_duration_days": 30
  }')

ALERT_ID=$(echo $ALERT_RESPONSE | jq -r '.id')

if [ "$ALERT_ID" = "null" ] || [ -z "$ALERT_ID" ]; then
  echo -e "${YELLOW}Failed to create alert. Response:${NC}"
  echo $ALERT_RESPONSE | jq
  exit 1
fi

echo -e "${GREEN}✓ Alert created with ID: $ALERT_ID${NC}"
echo ""

# Step 2: Show Alert Details
echo -e "${YELLOW}Step 2: Alert Details${NC}"
curl -s ${API_URL}/availability-alerts/${ALERT_ID}/ | jq
echo ""

# Step 3: Wait for Background Task
echo -e "${YELLOW}Step 3: Waiting 70 seconds for background task to check availability...${NC}"
echo "The Celery Beat task runs every 1 minute."
echo ""

for i in {70..1}; do
  printf "\rTime remaining: %02d seconds" $i
  sleep 1
done
echo ""
echo ""

# Step 4: Check Alert Status After Task Run
echo -e "${YELLOW}Step 4: Checking alert status after task execution...${NC}"
UPDATED_ALERT=$(curl -s ${API_URL}/availability-alerts/${ALERT_ID}/)
echo $UPDATED_ALERT | jq

STATUS=$(echo $UPDATED_ALERT | jq -r '.status')
LAST_CHECKED=$(echo $UPDATED_ALERT | jq -r '.last_checked_at')

echo ""
if [ "$LAST_CHECKED" != "null" ]; then
  echo -e "${GREEN}✓ Alert was checked by background task${NC}"
  echo -e "  Last checked: $LAST_CHECKED"
  echo -e "  Status: $STATUS"
else
  echo -e "${YELLOW}⚠ Alert hasn't been checked yet. Task may not be running.${NC}"
fi

echo ""

# Step 5: Check Celery Logs
echo -e "${YELLOW}Step 5: Recent Celery Worker Logs${NC}"
echo "Looking for availability check logs..."
echo ""
docker logs maritime-celery-dev --tail 50 2>&1 | grep -E "(availability|Alert #${ALERT_ID})" | tail -10

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Testing Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo "Next Steps:"
echo "1. Add ferry sailing data for the route (tangier → algeciras on 2025-12-15)"
echo "2. Wait for next task run (1 minute)"
echo "3. Check your email: ayoubenmbarek@gmail.com"
echo ""
echo "To check alert again:"
echo "  curl ${API_URL}/availability-alerts/${ALERT_ID} | jq"
echo ""
echo "To delete alert:"
echo "  curl -X DELETE ${API_URL}/availability-alerts/${ALERT_ID}"
echo ""
