# Redis CLI Commands for Checking Cached Data

## Connect to Redis CLI
```bash
docker exec -it maritime-redis-dev redis-cli
```

## Basic Commands (Inside Redis CLI)

### 1. List All Keys
```bash
KEYS *
```

### 2. List Keys with Pattern
```bash
KEYS ferry:*
KEYS celery:*
```

### 3. Get a Specific Key's Value
```bash
GET ferry:search:abc123...
```

### 4. Check Key Type
```bash
TYPE ferry:search:abc123...
```

### 5. Check Time to Live (TTL)
```bash
TTL ferry:search:abc123...
# Returns seconds until expiration
# -1 = no expiration
# -2 = key doesn't exist
```

### 6. Get All Information About a Key
```bash
DUMP ferry:search:abc123...
```

### 7. Count Total Keys
```bash
DBSIZE
```

### 8. Get Redis Info
```bash
INFO
INFO stats
INFO memory
```

### 9. Monitor Real-time Commands
```bash
MONITOR
# Shows all commands being executed in real-time
```

### 10. Clear All Data (BE CAREFUL!)
```bash
FLUSHALL
```

## One-Line Commands (From Host)

### List all keys
```bash
docker exec -it maritime-redis-dev redis-cli KEYS "*"
```

### Get specific key
```bash
docker exec -it maritime-redis-dev redis-cli GET "ferry:search:abc123..."
```

### Get key TTL
```bash
docker exec -it maritime-redis-dev redis-cli TTL "ferry:search:abc123..."
```

### Count all keys
```bash
docker exec -it maritime-redis-dev redis-cli DBSIZE
```

### Monitor in real-time
```bash
docker exec -it maritime-redis-dev redis-cli MONITOR
```

## How to Find Ferry Search Cache Keys

1. **Perform a search in the browser** (e.g., Genoa → Tunis on 2024-12-06)

2. **Immediately check Redis:**
```bash
docker exec -it maritime-redis-dev redis-cli KEYS "ferry:*"
```

3. **Get the cached data:**
```bash
# Copy the key from step 2, then:
docker exec -it maritime-redis-dev redis-cli GET "ferry:search:YOUR_KEY_HERE"
```

4. **Check how long until expiration:**
```bash
docker exec -it maritime-redis-dev redis-cli TTL "ferry:search:YOUR_KEY_HERE"
# Should show ~300 seconds (5 minutes) initially
```

## Understanding Cache Keys

The cache key format is: `ferry_search:{MD5_HASH}`

The MD5 hash is generated from search parameters:
- departure_port
- arrival_port
- departure_date
- return_date
- adults, children, infants
- vehicles count
- operators

Example:
```
ferry_search:32071747400182ac3d80fcf83b4cc99f
```

## Debugging Cache Issues

### Check if cache is working:
1. Clear Redis: `docker exec -it maritime-redis-dev redis-cli FLUSHALL`
2. Do a search (should be slow, ~9000ms)
3. Check keys: `docker exec -it maritime-redis-dev redis-cli KEYS "*"`
4. Do same search again (should be fast, ~7ms, cached=true)

### Monitor cache operations in real-time:
```bash
docker exec -it maritime-redis-dev redis-cli MONITOR
```
Then perform searches and watch Redis commands execute.
