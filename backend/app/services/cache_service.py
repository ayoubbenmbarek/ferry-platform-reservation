"""
Redis cache service for caching ferry search results and other data.
"""
import json
import hashlib
import logging
from typing import Any, Optional, Dict
from datetime import datetime, date
import redis
import os

logger = logging.getLogger(__name__)


class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles datetime objects."""
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)


class CacheService:
    """Service for caching data in Redis."""

    def __init__(self):
        """Initialize Redis connection."""
        # Use REDIS_URL from environment (handles both Docker and local)
        # Docker: redis://redis:6379/0
        # Local: redis://localhost:6399/0
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6399/0")

        # Parse URL to get host, port, db
        import re
        match = re.match(r'redis://([^:]+):(\d+)/(\d+)', redis_url)
        if match:
            self.redis_host = match.group(1)
            self.redis_port = int(match.group(2))
            self.redis_db = int(match.group(3))
        else:
            # Fallback to defaults
            self.redis_host = "localhost"
            self.redis_port = 6399  # Changed from 6379 to match docker-compose port mapping
            self.redis_db = 0

        try:
            self.redis_client = redis.Redis(
                host=self.redis_host,
                port=self.redis_port,
                db=self.redis_db,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
            )
            # Test connection
            self.redis_client.ping()
            logger.info(f"✅ Connected to Redis at {self.redis_host}:{self.redis_port}")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Redis: {str(e)}")
            self.redis_client = None

    def is_available(self) -> bool:
        """Check if Redis is available."""
        if not self.redis_client:
            return False
        try:
            return self.redis_client.ping()
        except:
            return False

    # =========================================================================
    # Generic Cache Methods (for arbitrary key-value storage)
    # =========================================================================

    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """
        Set a value in cache with optional TTL.

        Args:
            key: Cache key
            value: Value to cache (will be JSON serialized)
            ttl: Time to live in seconds (default 5 minutes)

        Returns:
            True if cached successfully
        """
        if not self.is_available():
            logger.warning(f"Redis not available, skipping cache set for key: {key}")
            return False

        try:
            self.redis_client.setex(
                key,
                ttl,
                json.dumps(value, cls=DateTimeEncoder)
            )
            logger.debug(f"✅ Cached key: {key} (TTL: {ttl}s)")
            return True

        except Exception as e:
            logger.error(f"Error setting cache key {key}: {str(e)}")
            return False

    def get(self, key: str) -> Optional[Any]:
        """
        Get a value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found
        """
        if not self.is_available():
            logger.warning(f"Redis not available, skipping cache get for key: {key}")
            return None

        try:
            cached_data = self.redis_client.get(key)

            if cached_data:
                logger.debug(f"✅ Cache HIT for key: {key}")
                return json.loads(cached_data)

            logger.debug(f"❌ Cache MISS for key: {key}")
            return None

        except Exception as e:
            logger.error(f"Error getting cache key {key}: {str(e)}")
            return None

    def delete(self, key: str) -> bool:
        """
        Delete a key from cache.

        Args:
            key: Cache key to delete

        Returns:
            True if deleted successfully
        """
        if not self.is_available():
            return False

        try:
            self.redis_client.delete(key)
            logger.debug(f"🗑️ Deleted cache key: {key}")
            return True

        except Exception as e:
            logger.error(f"Error deleting cache key {key}: {str(e)}")
            return False

    def _generate_cache_key(self, prefix: str, params: Dict[str, Any]) -> str:
        """
        Generate a cache key from parameters.

        Args:
            prefix: Key prefix (e.g., 'ferry_search')
            params: Parameters to hash

        Returns:
            Cache key string
        """
        # Sort params for consistent hashing
        sorted_params = json.dumps(params, sort_keys=True)
        # MD5 is used for cache key generation, not security
        param_hash = hashlib.md5(sorted_params.encode(), usedforsecurity=False).hexdigest()
        return f"{prefix}:{param_hash}"

    def get_ferry_search(self, search_params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Get cached ferry search results.

        Args:
            search_params: Search parameters (departure_port, arrival_port, date, etc.)

        Returns:
            Cached search results or None if not found
        """
        if not self.is_available():
            logger.warning("Redis not available, skipping cache lookup")
            return None

        try:
            cache_key = self._generate_cache_key("ferry_search", search_params)
            cached_data = self.redis_client.get(cache_key)

            if cached_data:
                logger.debug(f"✅ Cache HIT for ferry search: {cache_key}")
                return json.loads(cached_data)

            logger.debug(f"❌ Cache MISS for ferry search: {cache_key}")
            return None

        except Exception as e:
            logger.error(f"Error getting from cache: {str(e)}")
            return None

    def set_ferry_search(
        self,
        search_params: Dict[str, Any],
        results: Dict[str, Any],
        ttl: int = 300  # 5 minutes default
    ) -> bool:
        """
        Cache ferry search results.

        Args:
            search_params: Search parameters
            results: Search results to cache
            ttl: Time to live in seconds (default 5 minutes)

        Returns:
            True if cached successfully
        """
        if not self.is_available():
            logger.warning("Redis not available, skipping cache set")
            return False

        try:
            cache_key = self._generate_cache_key("ferry_search", search_params)
            self.redis_client.setex(
                cache_key,
                ttl,
                json.dumps(results, cls=DateTimeEncoder)
            )
            logger.info(f"✅ Cached ferry search results: {cache_key} (TTL: {ttl}s)")
            return True

        except Exception as e:
            logger.error(f"Error setting cache: {str(e)}")
            return False

    def invalidate_ferry_search(self, search_params: Dict[str, Any]) -> bool:
        """
        Invalidate cached ferry search results.

        Args:
            search_params: Search parameters to invalidate

        Returns:
            True if invalidated successfully
        """
        if not self.is_available():
            return False

        try:
            cache_key = self._generate_cache_key("ferry_search", search_params)
            self.redis_client.delete(cache_key)
            logger.info(f"🗑️ Invalidated cache: {cache_key}")
            return True

        except Exception as e:
            logger.error(f"Error invalidating cache: {str(e)}")
            return False

    def get_date_prices(self, search_params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Get cached date prices.

        Args:
            search_params: Search parameters (departure_port, arrival_port, center_date, etc.)

        Returns:
            Cached date prices or None if not found
        """
        if not self.is_available():
            logger.warning("Redis not available, skipping cache lookup")
            return None

        try:
            cache_key = self._generate_cache_key("date_prices", search_params)
            cached_data = self.redis_client.get(cache_key)

            if cached_data:
                logger.debug(f"✅ Cache HIT for date prices: {cache_key}")
                return json.loads(cached_data)

            logger.debug(f"❌ Cache MISS for date prices: {cache_key}")
            return None

        except Exception as e:
            logger.error(f"Error getting date prices from cache: {str(e)}")
            return None

    def set_date_prices(
        self,
        search_params: Dict[str, Any],
        results: Dict[str, Any],
        ttl: int = 900  # 15 minutes default (prices change less frequently)
    ) -> bool:
        """
        Cache date prices results.

        Args:
            search_params: Search parameters
            results: Date prices results to cache
            ttl: Time to live in seconds (default 15 minutes)

        Returns:
            True if cached successfully
        """
        if not self.is_available():
            logger.warning("Redis not available, skipping cache set")
            return False

        try:
            cache_key = self._generate_cache_key("date_prices", search_params)
            self.redis_client.setex(
                cache_key,
                ttl,
                json.dumps(results, cls=DateTimeEncoder)
            )
            logger.info(f"✅ Cached date prices: {cache_key} (TTL: {ttl}s)")
            return True

        except Exception as e:
            logger.error(f"Error setting date prices cache: {str(e)}")
            return False

    def get_availability(self, sailing_id: str) -> Optional[Dict[str, Any]]:
        """
        Get cached availability information for a specific sailing.

        Args:
            sailing_id: Sailing ID

        Returns:
            Cached availability data or None
        """
        if not self.is_available():
            return None

        try:
            cache_key = f"availability:{sailing_id}"
            cached_data = self.redis_client.get(cache_key)

            if cached_data:
                logger.info(f"✅ Cache HIT for availability: {sailing_id}")
                return json.loads(cached_data)

            return None

        except Exception as e:
            logger.error(f"Error getting availability from cache: {str(e)}")
            return None

    def set_availability(
        self,
        sailing_id: str,
        availability_data: Dict[str, Any],
        ttl: int = 60  # 1 minute for real-time data
    ) -> bool:
        """
        Cache availability information.

        Args:
            sailing_id: Sailing ID
            availability_data: Availability data
            ttl: Time to live in seconds (default 1 minute for real-time data)

        Returns:
            True if cached successfully
        """
        if not self.is_available():
            return False

        try:
            cache_key = f"availability:{sailing_id}"
            self.redis_client.setex(
                cache_key,
                ttl,
                json.dumps(availability_data, cls=DateTimeEncoder)
            )
            logger.info(f"✅ Cached availability: {sailing_id} (TTL: {ttl}s)")
            return True

        except Exception as e:
            logger.error(f"Error caching availability: {str(e)}")
            return False

    def invalidate_sailing_availability(self, sailing_id: str) -> bool:
        """
        Invalidate cached availability for a specific sailing.
        Called after booking confirmed or cancelled.

        Args:
            sailing_id: Sailing ID to invalidate

        Returns:
            True if invalidated successfully
        """
        if not self.is_available():
            return False

        try:
            cache_key = f"availability:{sailing_id}"
            self.redis_client.delete(cache_key)
            logger.info(f"🗑️ Invalidated availability cache for sailing: {sailing_id}")
            return True

        except Exception as e:
            logger.error(f"Error invalidating availability cache: {str(e)}")
            return False

    # Aliases for better API consistency
    def get_sailing_availability(self, sailing_id: str) -> Optional[Dict[str, Any]]:
        """Alias for get_availability()."""
        return self.get_availability(sailing_id)

    def set_sailing_availability(
        self,
        sailing_id: str,
        availability_data: Dict[str, Any],
        ttl: int = 60
    ) -> bool:
        """Alias for set_availability()."""
        return self.set_availability(sailing_id, availability_data, ttl)

    def invalidate_route_searches(self, departure_port: str, arrival_port: str) -> int:
        """
        Invalidate all cached searches for a specific route.
        Useful when prices or schedules change.

        Args:
            departure_port: Departure port code
            arrival_port: Arrival port code

        Returns:
            Number of cache entries invalidated
        """
        if not self.is_available():
            return 0

        try:
            # Find all cache keys for this route
            pattern = f"ferry_search:*{departure_port}*{arrival_port}*"
            keys = list(self.redis_client.scan_iter(match=pattern))

            if keys:
                deleted = self.redis_client.delete(*keys)
                logger.info(f"🗑️ Invalidated {deleted} searches for route {departure_port}→{arrival_port}")
                return deleted

            return 0

        except Exception as e:
            logger.error(f"Error invalidating route searches: {str(e)}")
            return 0

    def clear_all_ferry_searches(self) -> int:
        """
        Clear all cached ferry searches (useful for maintenance/debugging).

        Returns:
            Number of keys deleted
        """
        if not self.is_available():
            return 0

        try:
            keys = list(self.redis_client.scan_iter(match="ferry_search:*"))
            if keys:
                deleted = self.redis_client.delete(*keys)
                logger.info(f"🗑️ Cleared {deleted} ferry search cache entries")
                return deleted
            return 0

        except Exception as e:
            logger.error(f"Error clearing ferry search cache: {str(e)}")
            return 0


    # =========================================================================
    # FerryHopper API Caching (Best Practices Implementation)
    # =========================================================================

    def get_ferryhopper_ports(self, language: str = "en") -> Optional[Dict[str, Any]]:
        """
        Get cached FerryHopper ports list.

        Per FerryHopper best practices: Cache the Get Ports utility endpoint.
        TTL: 24 hours (ports rarely change)

        Args:
            language: Language code

        Returns:
            Cached ports data or None
        """
        if not self.is_available():
            return None

        try:
            cache_key = f"ferryhopper:ports:{language}"
            cached_data = self.redis_client.get(cache_key)

            if cached_data:
                logger.debug(f"✅ Cache HIT for FerryHopper ports: {language}")
                return json.loads(cached_data)

            return None

        except Exception as e:
            logger.error(f"Error getting FerryHopper ports from cache: {str(e)}")
            return None

    def set_ferryhopper_ports(
        self,
        ports_data: Dict[str, Any],
        language: str = "en",
        ttl: int = 86400  # 24 hours
    ) -> bool:
        """
        Cache FerryHopper ports list.

        Args:
            ports_data: Ports data from API
            language: Language code
            ttl: Time to live (default 24 hours)

        Returns:
            True if cached successfully
        """
        if not self.is_available():
            return False

        try:
            cache_key = f"ferryhopper:ports:{language}"
            self.redis_client.setex(
                cache_key,
                ttl,
                json.dumps(ports_data, cls=DateTimeEncoder)
            )
            logger.info(f"✅ Cached FerryHopper ports (TTL: {ttl}s)")
            return True

        except Exception as e:
            logger.error(f"Error caching FerryHopper ports: {str(e)}")
            return False

    def get_ferryhopper_vehicles(self, language: str = "en") -> Optional[Dict[str, Any]]:
        """
        Get cached FerryHopper vehicle types.

        TTL: 24 hours (vehicle types rarely change)

        Args:
            language: Language code

        Returns:
            Cached vehicles data or None
        """
        if not self.is_available():
            return None

        try:
            cache_key = f"ferryhopper:vehicles:{language}"
            cached_data = self.redis_client.get(cache_key)

            if cached_data:
                logger.debug(f"✅ Cache HIT for FerryHopper vehicles")
                return json.loads(cached_data)

            return None

        except Exception as e:
            logger.error(f"Error getting FerryHopper vehicles from cache: {str(e)}")
            return None

    def set_ferryhopper_vehicles(
        self,
        vehicles_data: Dict[str, Any],
        language: str = "en",
        ttl: int = 86400  # 24 hours
    ) -> bool:
        """
        Cache FerryHopper vehicle types.

        Args:
            vehicles_data: Vehicles data from API
            language: Language code
            ttl: Time to live (default 24 hours)

        Returns:
            True if cached successfully
        """
        if not self.is_available():
            return False

        try:
            cache_key = f"ferryhopper:vehicles:{language}"
            self.redis_client.setex(
                cache_key,
                ttl,
                json.dumps(vehicles_data, cls=DateTimeEncoder)
            )
            logger.info(f"✅ Cached FerryHopper vehicles (TTL: {ttl}s)")
            return True

        except Exception as e:
            logger.error(f"Error caching FerryHopper vehicles: {str(e)}")
            return False

    def get_ferryhopper_accommodations(self) -> Optional[Dict[str, Any]]:
        """
        Get cached FerryHopper accommodation types.

        TTL: 24 hours

        Returns:
            Cached accommodations data or None
        """
        if not self.is_available():
            return None

        try:
            cache_key = "ferryhopper:accommodations"
            cached_data = self.redis_client.get(cache_key)

            if cached_data:
                logger.debug(f"✅ Cache HIT for FerryHopper accommodations")
                return json.loads(cached_data)

            return None

        except Exception as e:
            logger.error(f"Error getting FerryHopper accommodations from cache: {str(e)}")
            return None

    def set_ferryhopper_accommodations(
        self,
        accommodations_data: Dict[str, Any],
        ttl: int = 86400  # 24 hours
    ) -> bool:
        """
        Cache FerryHopper accommodation types.

        Args:
            accommodations_data: Accommodations data from API
            ttl: Time to live (default 24 hours)

        Returns:
            True if cached successfully
        """
        if not self.is_available():
            return False

        try:
            cache_key = "ferryhopper:accommodations"
            self.redis_client.setex(
                cache_key,
                ttl,
                json.dumps(accommodations_data, cls=DateTimeEncoder)
            )
            logger.info(f"✅ Cached FerryHopper accommodations (TTL: {ttl}s)")
            return True

        except Exception as e:
            logger.error(f"Error caching FerryHopper accommodations: {str(e)}")
            return False

    def get_ferryhopper_search(
        self,
        departure_port: str,
        arrival_port: str,
        departure_date: str,
        passengers: int,
        vehicles: int = 0,
        pets: int = 0
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached FerryHopper search results.

        Per FerryHopper best practices: Cache results from Search Booking Solutions.
        Note: Short TTL as availability changes frequently.

        Args:
            departure_port: Departure port code
            arrival_port: Arrival port code
            departure_date: Date string (YYYY-MM-DD)
            passengers: Number of passengers
            vehicles: Number of vehicles (affects pricing)
            pets: Number of pets (affects pricing)

        Returns:
            Cached search results or None
        """
        if not self.is_available():
            return None

        try:
            cache_key = f"ferryhopper:search:{departure_port}:{arrival_port}:{departure_date}:{passengers}:v{vehicles}:p{pets}"
            cached_data = self.redis_client.get(cache_key)

            if cached_data:
                logger.debug(f"✅ Cache HIT for FerryHopper search: {departure_port}->{arrival_port}")
                return json.loads(cached_data)

            return None

        except Exception as e:
            logger.error(f"Error getting FerryHopper search from cache: {str(e)}")
            return None

    def set_ferryhopper_search(
        self,
        departure_port: str,
        arrival_port: str,
        departure_date: str,
        passengers: int,
        results: Dict[str, Any],
        ttl: int = 300,  # 5 minutes - short due to availability changes
        vehicles: int = 0,
        pets: int = 0
    ) -> bool:
        """
        Cache FerryHopper search results.

        Per FerryHopper best practices: Be aware that caching for longer periods
        increases chance of availability errors.

        Args:
            departure_port: Departure port code
            arrival_port: Arrival port code
            departure_date: Date string
            passengers: Number of passengers
            results: Search results
            ttl: Time to live (default 5 minutes)
            vehicles: Number of vehicles (affects pricing)
            pets: Number of pets (affects pricing)

        Returns:
            True if cached successfully
        """
        if not self.is_available():
            return False

        try:
            cache_key = f"ferryhopper:search:{departure_port}:{arrival_port}:{departure_date}:{passengers}:v{vehicles}:p{pets}"
            self.redis_client.setex(
                cache_key,
                ttl,
                json.dumps(results, cls=DateTimeEncoder)
            )
            logger.info(f"✅ Cached FerryHopper search: {departure_port}->{arrival_port} (TTL: {ttl}s)")
            return True

        except Exception as e:
            logger.error(f"Error caching FerryHopper search: {str(e)}")
            return False

    def clear_ferryhopper_cache(self) -> int:
        """
        Clear all FerryHopper cached data.

        Returns:
            Number of keys deleted
        """
        if not self.is_available():
            return 0

        try:
            keys = list(self.redis_client.scan_iter(match="ferryhopper:*"))
            if keys:
                deleted = self.redis_client.delete(*keys)
                logger.info(f"🗑️ Cleared {deleted} FerryHopper cache entries")
                return deleted
            return 0

        except Exception as e:
            logger.error(f"Error clearing FerryHopper cache: {str(e)}")
            return 0

    # =========================================================================
    # Distributed Locking (for preventing concurrent task execution)
    # =========================================================================

    def acquire_lock(self, lock_key: str, timeout: int = 3600) -> bool:
        """
        Acquire a distributed lock using Redis SETNX.

        Args:
            lock_key: Unique key for the lock
            timeout: Lock timeout in seconds (auto-release after this time)

        Returns:
            True if lock acquired, False if already locked
        """
        if not self.is_available():
            # If Redis is down, allow the operation (fail-open)
            logger.warning(f"Redis unavailable, allowing operation without lock: {lock_key}")
            return True

        try:
            full_key = f"lock:{lock_key}"
            # SETNX + EXPIRE atomically using SET with NX and EX options
            acquired = self.redis_client.set(
                full_key,
                "1",
                nx=True,  # Only set if not exists
                ex=timeout  # Expire after timeout seconds
            )

            if acquired:
                logger.debug(f"🔒 Lock acquired: {lock_key} (timeout: {timeout}s)")
                return True
            else:
                logger.debug(f"🔒 Lock already held: {lock_key}")
                return False

        except Exception as e:
            logger.error(f"Error acquiring lock {lock_key}: {str(e)}")
            # Fail-open: allow operation if Redis fails
            return True

    def release_lock(self, lock_key: str) -> bool:
        """
        Release a distributed lock.

        Args:
            lock_key: Lock key to release

        Returns:
            True if lock released successfully
        """
        if not self.is_available():
            return True

        try:
            full_key = f"lock:{lock_key}"
            self.redis_client.delete(full_key)
            logger.debug(f"🔓 Lock released: {lock_key}")
            return True

        except Exception as e:
            logger.error(f"Error releasing lock {lock_key}: {str(e)}")
            return False

    def is_locked(self, lock_key: str) -> bool:
        """
        Check if a lock is currently held.

        Args:
            lock_key: Lock key to check

        Returns:
            True if locked, False otherwise
        """
        if not self.is_available():
            return False

        try:
            full_key = f"lock:{lock_key}"
            return self.redis_client.exists(full_key) > 0

        except Exception as e:
            logger.error(f"Error checking lock {lock_key}: {str(e)}")
            return False


# Singleton instance
cache_service = CacheService()
