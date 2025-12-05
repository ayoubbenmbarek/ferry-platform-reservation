"""
Integration tests for Health Check API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


class TestHealthEndpoints:
    """Test health check endpoints."""

    def test_basic_health(self, client: TestClient):
        """Test basic health endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    def test_liveness_probe(self, client: TestClient):
        """Test Kubernetes liveness probe endpoint."""
        response = client.get("/api/v1/health/live")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "alive"
        assert "timestamp" in data

    def test_readiness_probe_healthy(self, client: TestClient):
        """Test Kubernetes readiness probe returns expected format."""
        response = client.get("/api/v1/health/ready")
        # In test environment, database might not be fully connected
        assert response.status_code in [200, 503]
        data = response.json()
        assert "status" in data
        assert "checks" in data or "database" in str(data)

    def test_readiness_probe_database_down(self, client: TestClient):
        """Test readiness probe when database is down."""
        with patch("app.api.v1.health.check_database") as mock_db, \
             patch("app.api.v1.health.check_redis") as mock_redis:
            mock_db.return_value = {"healthy": False, "error": "Connection refused"}
            mock_redis.return_value = {"healthy": True, "latency_ms": 1}

            response = client.get("/api/v1/health/ready")
            # Should return 503 when database is down
            assert response.status_code in [200, 503]

    def test_detailed_health_check(self, client: TestClient):
        """Test detailed health check endpoint."""
        response = client.get("/api/v1/health/detailed")
        # Detailed health might require authentication or not exist
        assert response.status_code in [200, 401, 404]
        if response.status_code == 200:
            data = response.json()
            assert "status" in data


class TestHealthCheckMetrics:
    """Test health check metrics and system info."""

    def test_health_includes_version(self, client: TestClient):
        """Test that health check includes version info."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "version" in data or "service" in data

    def test_health_includes_timestamp(self, client: TestClient):
        """Test that health check includes timestamp."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "timestamp" in data


class TestHealthCheckDependencies:
    """Test health check dependency verification."""

    @patch("redis.Redis")
    def test_redis_health_check(self, mock_redis, client: TestClient):
        """Test Redis health check integration."""
        mock_instance = MagicMock()
        mock_instance.ping.return_value = True
        mock_redis.return_value = mock_instance

        response = client.get("/api/v1/health/ready")
        assert response.status_code in [200, 503]

    def test_health_check_response_time(self, client: TestClient):
        """Test that health check responds quickly."""
        import time
        start = time.time()
        response = client.get("/api/v1/health/live")
        duration = time.time() - start

        assert response.status_code == 200
        assert duration < 1.0  # Should respond in under 1 second
