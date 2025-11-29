"""
Circuit breaker implementation for external service calls.
Prevents cascading failures when external services are unavailable.
"""

import time
import logging
from enum import Enum
from typing import Callable, Any, Optional, TypeVar, Generic
from functools import wraps
from dataclasses import dataclass, field
from threading import Lock

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Service is unavailable
    HALF_OPEN = "half_open"  # Testing if service recovered


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker."""
    failure_threshold: int = 5  # Failures before opening circuit
    success_threshold: int = 2  # Successes needed to close circuit
    timeout: float = 30.0  # Seconds before trying again
    excluded_exceptions: tuple = ()  # Exceptions that don't count as failures


@dataclass
class CircuitBreakerStats:
    """Statistics for circuit breaker monitoring."""
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: Optional[float] = None
    last_success_time: Optional[float] = None
    total_failures: int = 0
    total_successes: int = 0
    total_rejected: int = 0


class CircuitBreakerError(Exception):
    """Raised when circuit breaker is open."""
    def __init__(self, message: str, service_name: str):
        self.service_name = service_name
        super().__init__(message)


class CircuitBreaker:
    """
    Circuit breaker pattern implementation.

    Usage:
        cb = CircuitBreaker("stripe_api")

        @cb.call
        def make_stripe_call():
            return stripe.PaymentIntent.create(...)
    """

    def __init__(
        self,
        name: str,
        config: Optional[CircuitBreakerConfig] = None
    ):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self.stats = CircuitBreakerStats()
        self._lock = Lock()

    @property
    def state(self) -> CircuitState:
        """Get current circuit state."""
        with self._lock:
            if self.stats.state == CircuitState.OPEN:
                if self._should_attempt_reset():
                    self.stats.state = CircuitState.HALF_OPEN
                    logger.info(
                        f"Circuit breaker '{self.name}' transitioning to HALF_OPEN"
                    )
            return self.stats.state

    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to try again."""
        if self.stats.last_failure_time is None:
            return True
        return time.time() - self.stats.last_failure_time >= self.config.timeout

    def _record_success(self) -> None:
        """Record a successful call."""
        with self._lock:
            self.stats.success_count += 1
            self.stats.total_successes += 1
            self.stats.last_success_time = time.time()

            if self.stats.state == CircuitState.HALF_OPEN:
                if self.stats.success_count >= self.config.success_threshold:
                    self.stats.state = CircuitState.CLOSED
                    self.stats.failure_count = 0
                    self.stats.success_count = 0
                    logger.info(
                        f"Circuit breaker '{self.name}' CLOSED after recovery"
                    )
            elif self.stats.state == CircuitState.CLOSED:
                # Reset failure count on success
                self.stats.failure_count = 0

    def _record_failure(self, exception: Exception) -> None:
        """Record a failed call."""
        # Check if exception should be excluded
        if isinstance(exception, self.config.excluded_exceptions):
            return

        with self._lock:
            self.stats.failure_count += 1
            self.stats.total_failures += 1
            self.stats.last_failure_time = time.time()

            if self.stats.state == CircuitState.HALF_OPEN:
                # Failed during recovery test, reopen circuit
                self.stats.state = CircuitState.OPEN
                self.stats.success_count = 0
                logger.warning(
                    f"Circuit breaker '{self.name}' re-OPENED after failed recovery test"
                )
            elif self.stats.state == CircuitState.CLOSED:
                if self.stats.failure_count >= self.config.failure_threshold:
                    self.stats.state = CircuitState.OPEN
                    logger.warning(
                        f"Circuit breaker '{self.name}' OPENED after "
                        f"{self.stats.failure_count} failures"
                    )

    def _can_execute(self) -> bool:
        """Check if call can be executed."""
        current_state = self.state
        if current_state == CircuitState.OPEN:
            with self._lock:
                self.stats.total_rejected += 1
            return False
        return True

    def call(self, func: Callable[..., T]) -> Callable[..., T]:
        """Decorator to wrap function calls with circuit breaker."""
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            if not self._can_execute():
                raise CircuitBreakerError(
                    f"Circuit breaker '{self.name}' is OPEN. "
                    f"Service temporarily unavailable.",
                    self.name
                )

            try:
                result = func(*args, **kwargs)
                self._record_success()
                return result
            except Exception as e:
                self._record_failure(e)
                raise

        return wrapper

    async def async_call(self, func: Callable[..., T]) -> Callable[..., T]:
        """Decorator for async function calls."""
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            if not self._can_execute():
                raise CircuitBreakerError(
                    f"Circuit breaker '{self.name}' is OPEN. "
                    f"Service temporarily unavailable.",
                    self.name
                )

            try:
                result = await func(*args, **kwargs)
                self._record_success()
                return result
            except Exception as e:
                self._record_failure(e)
                raise

        return wrapper

    def get_stats(self) -> dict:
        """Get circuit breaker statistics."""
        with self._lock:
            return {
                "name": self.name,
                "state": self.stats.state.value,
                "failure_count": self.stats.failure_count,
                "success_count": self.stats.success_count,
                "total_failures": self.stats.total_failures,
                "total_successes": self.stats.total_successes,
                "total_rejected": self.stats.total_rejected,
                "last_failure_time": self.stats.last_failure_time,
                "last_success_time": self.stats.last_success_time,
            }

    def reset(self) -> None:
        """Manually reset the circuit breaker."""
        with self._lock:
            self.stats.state = CircuitState.CLOSED
            self.stats.failure_count = 0
            self.stats.success_count = 0
            logger.info(f"Circuit breaker '{self.name}' manually reset")


# Global circuit breakers for different services
class CircuitBreakers:
    """Registry of circuit breakers for different services."""

    _breakers: dict[str, CircuitBreaker] = {}
    _lock = Lock()

    @classmethod
    def get(
        cls,
        name: str,
        config: Optional[CircuitBreakerConfig] = None
    ) -> CircuitBreaker:
        """Get or create a circuit breaker."""
        with cls._lock:
            if name not in cls._breakers:
                cls._breakers[name] = CircuitBreaker(name, config)
            return cls._breakers[name]

    @classmethod
    def get_all_stats(cls) -> dict[str, dict]:
        """Get stats for all circuit breakers."""
        with cls._lock:
            return {
                name: cb.get_stats()
                for name, cb in cls._breakers.items()
            }

    @classmethod
    def reset_all(cls) -> None:
        """Reset all circuit breakers."""
        with cls._lock:
            for cb in cls._breakers.values():
                cb.reset()


# Pre-configured circuit breakers for common services
STRIPE_CIRCUIT_BREAKER = CircuitBreakers.get(
    "stripe",
    CircuitBreakerConfig(
        failure_threshold=3,
        success_threshold=2,
        timeout=60.0,
    )
)

FERRY_API_CIRCUIT_BREAKER = CircuitBreakers.get(
    "ferry_api",
    CircuitBreakerConfig(
        failure_threshold=5,
        success_threshold=3,
        timeout=30.0,
    )
)

EMAIL_CIRCUIT_BREAKER = CircuitBreakers.get(
    "email",
    CircuitBreakerConfig(
        failure_threshold=5,
        success_threshold=2,
        timeout=120.0,  # Longer timeout for email
    )
)


def with_circuit_breaker(breaker: CircuitBreaker):
    """Decorator factory for circuit breaker."""
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        return breaker.call(func)
    return decorator


def with_async_circuit_breaker(breaker: CircuitBreaker):
    """Decorator factory for async circuit breaker."""
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            if not breaker._can_execute():
                raise CircuitBreakerError(
                    f"Circuit breaker '{breaker.name}' is OPEN. "
                    f"Service temporarily unavailable.",
                    breaker.name
                )

            try:
                result = await func(*args, **kwargs)
                breaker._record_success()
                return result
            except Exception as e:
                breaker._record_failure(e)
                raise

        return wrapper
    return decorator
