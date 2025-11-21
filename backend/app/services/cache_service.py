"""
Redis cache service for caching ferry search results and other data.
"""
import json
import hashlib
import logging
from typing import Any, Optional, Dict
import redis
import os

logger = logging.getLogger(__name__)


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
        param_hash = hashlib.md5(sorted_params.encode()).hexdigest()
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
                logger.info(f"✅ Cache HIT for ferry search: {cache_key}")
                return json.loads(cached_data)

            logger.info(f"❌ Cache MISS for ferry search: {cache_key}")
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
                json.dumps(results)
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
                json.dumps(availability_data)
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


# Singleton instance
cache_service = CacheService()
