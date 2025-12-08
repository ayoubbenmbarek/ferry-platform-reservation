"""
Integration test fixtures with TestClient for API testing.

Environment variables are set by the root conftest.py before this file is loaded.

To run tests against Docker database:
    TEST_USE_DOCKER=true pytest tests/integration/ -v

To run tests with in-memory SQLite (default):
    pytest tests/integration/ -v
"""

import os
import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Generator, Dict, Any

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db as database_get_db
from app.api.deps import get_db as deps_get_db
from app.models.user import User
from app.models.booking import Booking, BookingStatusEnum
from app.api.v1.auth import create_access_token, get_password_hash

# Check if we're using Docker database (set in root conftest.py)
USE_DOCKER_DB = os.environ.get("TEST_USE_DOCKER", "").lower() in ("true", "1", "yes")

# Get DATABASE_URL from environment (set by root conftest.py before any imports)
_test_db_url = os.environ.get("DATABASE_URL", "sqlite:///:memory:")

# Create engine based on actual database URL (more reliable than USE_DOCKER_DB flag)
if _test_db_url.startswith("sqlite"):
    # SQLite for fast isolated tests
    TEST_ENGINE = create_engine(
        _test_db_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    # PostgreSQL for Docker/CI
    TEST_ENGINE = create_engine(
        _test_db_url,
        pool_pre_ping=True,
    )

TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


# Note: Database override is set per-test in the db_session fixture
# This ensures fixtures and API use the same session


def cleanup_test_data(session: Session):
    """Clean up all test data in correct order to respect foreign key constraints."""
    from sqlalchemy import text
    try:
        # Use raw SQL to delete in correct order (child tables first)
        # This handles all foreign key constraints properly
        # Match all test booking patterns: MR-INTTEST%, MR-WBOOK%, MR-REFUND%, MR-CANCEL%, MR-RETRY%
        session.execute(text("""
            DELETE FROM payments WHERE booking_id IN (
                SELECT id FROM bookings WHERE booking_reference LIKE 'MR-%'
            )
        """))
        session.execute(text("""
            DELETE FROM booking_passengers WHERE booking_id IN (
                SELECT id FROM bookings WHERE booking_reference LIKE 'MR-%'
            )
        """))
        session.execute(text("""
            DELETE FROM booking_vehicles WHERE booking_id IN (
                SELECT id FROM bookings WHERE booking_reference LIKE 'MR-%'
            )
        """))
        session.execute(text("""
            DELETE FROM booking_cabins WHERE booking_id IN (
                SELECT id FROM bookings WHERE booking_reference LIKE 'MR-%'
            )
        """))
        session.execute(text("""
            DELETE FROM booking_meals WHERE booking_id IN (
                SELECT id FROM bookings WHERE booking_reference LIKE 'MR-%'
            )
        """))
        session.execute(text("DELETE FROM bookings WHERE booking_reference LIKE 'MR-%'"))
        session.execute(text("DELETE FROM bookings WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')"))
        session.execute(text("DELETE FROM payments WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')"))
        session.execute(text("DELETE FROM availability_alerts WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@example.com')"))
        session.execute(text("DELETE FROM users WHERE email LIKE '%@example.com'"))
        session.commit()
    except Exception as e:
        session.rollback()
        # Silently ignore errors - tables might not exist in some test scenarios
        pass


@pytest.fixture(scope="function", autouse=True)
def setup_database():
    """Set up database tables before each test."""
    if USE_DOCKER_DB:
        # For Docker database, clean up test data before and after each test
        session = TestSessionLocal()
        cleanup_test_data(session)
        session.close()

        yield

        session = TestSessionLocal()
        cleanup_test_data(session)
        session.close()
    else:
        # For SQLite, create and drop tables for isolation
        Base.metadata.create_all(bind=TEST_ENGINE)
        yield
        Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture
def db_session(setup_database) -> Generator[Session, None, None]:
    """Get a database session for tests and set up the override.

    Depends on setup_database to ensure tables are created first.
    """
    from app import database

    # Swap out the app's database engine with our test engine
    # This ensures the app's startup event uses our test database
    original_engine = database.engine
    database.engine = TEST_ENGINE

    session = TestSessionLocal()

    # Set up the override so API uses the same session
    def override_get_db_shared():
        try:
            yield session
        finally:
            pass  # Session cleanup handled by this fixture

    # Override BOTH get_db functions (database and deps)
    app.dependency_overrides[database_get_db] = override_get_db_shared
    app.dependency_overrides[deps_get_db] = override_get_db_shared

    try:
        yield session
    finally:
        # Clean up both overrides
        app.dependency_overrides.pop(database_get_db, None)
        app.dependency_overrides.pop(deps_get_db, None)
        session.close()
        database.engine = original_engine


@pytest.fixture
def client(db_session: Session) -> TestClient:
    """Create a test client that shares the database session with fixtures."""
    # db_session fixture already sets up the override and swaps the engine
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def test_user(db_session: Session) -> User:
    """Create a test user."""
    user = User(
        email="testuser@example.com",
        hashed_password=get_password_hash("TestPassword123!"),
        first_name="Test",
        last_name="User",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.flush()
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def admin_user(db_session: Session) -> User:
    """Create an admin user."""
    user = User(
        email="admin@example.com",
        hashed_password=get_password_hash("AdminPassword123!"),
        first_name="Admin",
        last_name="User",
        is_active=True,
        is_verified=True,
        is_admin=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user: User) -> Dict[str, str]:
    """Get authentication headers for a test user."""
    token = create_access_token(data={"sub": str(test_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers(admin_user: User) -> Dict[str, str]:
    """Get authentication headers for an admin user."""
    token = create_access_token(data={"sub": str(admin_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_booking(db_session: Session, test_user: User) -> Booking:
    """Create a test booking."""
    booking = Booking(
        user_id=test_user.id,
        sailing_id="TEST-SAIL-001",
        operator="CTN",
        departure_port="Tunis",
        arrival_port="Marseille",
        departure_time=datetime.utcnow() + timedelta(days=14),
        arrival_time=datetime.utcnow() + timedelta(days=14, hours=20),
        vessel_name="Test Vessel",
        booking_reference="MR-INTTEST001",
        contact_email="testuser@example.com",
        contact_phone="+33612345678",
        contact_first_name="Test",
        contact_last_name="User",
        total_passengers=2,
        total_vehicles=0,
        subtotal=Decimal("300.00"),
        tax_amount=Decimal("30.00"),
        total_amount=Decimal("330.00"),
        currency="EUR",
        status=BookingStatusEnum.PENDING,
        is_round_trip=False,
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)
    return booking


@pytest.fixture
def confirmed_booking(db_session: Session, test_booking: Booking) -> Booking:
    """Create a confirmed booking."""
    test_booking.status = BookingStatusEnum.CONFIRMED
    test_booking.operator_booking_reference = "CTN-CONF-12345"
    db_session.commit()
    db_session.refresh(test_booking)
    return test_booking
