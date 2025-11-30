"""
Pytest configuration and fixtures for Maritime Reservation Website tests.

To run tests against Docker database:
    TEST_USE_DOCKER=true pytest tests/ -v

To run tests with in-memory SQLite (default, faster):
    pytest tests/ -v
"""

import os
import sys

# Add the backend directory to the path FIRST
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Check if we should use Docker database
USE_DOCKER_DB = os.environ.get("TEST_USE_DOCKER", "").lower() in ("true", "1", "yes")

# CRITICAL: Set testing environment variables BEFORE importing app modules
# This must happen before any app imports to ensure correct database is used
os.environ["ENVIRONMENT"] = "testing"

# Helper to set env var only if not set or empty
def set_env_if_empty(key: str, value: str):
    if not os.environ.get(key):
        os.environ[key] = value

# Only set database URLs if not already set (allows CI to override)
if USE_DOCKER_DB:
    # Use Docker/PostgreSQL database
    # Check if DATABASE_URL is already set (e.g., by CI pipeline)
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url or db_url.startswith("sqlite"):
        # Local Docker: PostgreSQL on port 5442, Redis on port 6399
        os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5442/maritime_reservations_dev"
    redis_url = os.environ.get("REDIS_URL", "")
    if not redis_url or redis_url.startswith("memory"):
        os.environ["REDIS_URL"] = "redis://localhost:6399/15"
    celery_broker = os.environ.get("CELERY_BROKER_URL", "")
    if not celery_broker or celery_broker.startswith("memory"):
        os.environ["CELERY_BROKER_URL"] = "redis://localhost:6399/14"
    celery_result = os.environ.get("CELERY_RESULT_BACKEND", "")
    if not celery_result or celery_result.startswith("memory"):
        os.environ["CELERY_RESULT_BACKEND"] = "redis://localhost:6399/14"
else:
    # Use in-memory SQLite for fast isolated tests
    set_env_if_empty("DATABASE_URL", "sqlite:///:memory:")
    set_env_if_empty("REDIS_URL", "memory://")
    set_env_if_empty("CELERY_BROKER_URL", "memory://")
    set_env_if_empty("CELERY_RESULT_BACKEND", "memory://")

set_env_if_empty("SECRET_KEY", "test-secret-key-for-testing-only-12345678901234567890")
set_env_if_empty("JWT_SECRET_KEY", "test-jwt-secret-key-for-testing-only-12345678901234567890")
set_env_if_empty("STRIPE_SECRET_KEY", "sk_test_fake_key")
set_env_if_empty("STRIPE_PUBLISHABLE_KEY", "pk_test_fake_key")
set_env_if_empty("STRIPE_WEBHOOK_SECRET", "whsec_test_secret")
set_env_if_empty("DEBUG", "true")
set_env_if_empty("ALLOWED_ORIGINS", "http://localhost:3001")
set_env_if_empty("SMTP_PORT", "587")
set_env_if_empty("SMTP_HOST", "smtp.test.com")
set_env_if_empty("SMTP_USERNAME", "test@test.com")
set_env_if_empty("SMTP_PASSWORD", "testpassword")
set_env_if_empty("FROM_EMAIL", "test@test.com")
set_env_if_empty("FROM_NAME", "Test")
set_env_if_empty("BASE_URL", "http://localhost:3001")
set_env_if_empty("LOG_LEVEL", "INFO")
set_env_if_empty("GOOGLE_CLIENT_ID", "test-google-client-id")
set_env_if_empty("GOOGLE_CLIENT_SECRET", "test-google-client-secret")
set_env_if_empty("GOOGLE_REDIRECT_URI", "http://localhost:3001/auth/google/callback")

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Generator, Dict, Any
from unittest.mock import MagicMock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models.booking import (
    Booking, BookingPassenger, BookingVehicle, BookingCabin,
    BookingStatusEnum, PassengerTypeEnum, VehicleTypeEnum, JourneyTypeEnum
)
from app.models.user import User
from app.models.payment import Payment, PaymentStatusEnum, PaymentMethodEnum
from app.models.promo_code import PromoCode, PromoCodeTypeEnum, PromoCodeUsage
from app.models.ferry import Cabin, CabinTypeEnum, BedTypeEnum, Ferry, Schedule
from app.models.availability_alert import AvailabilityAlert
from app.models.meal import Meal, BookingMeal


# Test database engine using in-memory SQLite
TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    """
    Create a fresh database session for each test.
    Tables are created and dropped for each test to ensure isolation.
    """
    # Create all tables
    Base.metadata.create_all(bind=TEST_ENGINE)

    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        # Drop all tables after test
        Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture
def sample_user(db_session: Session) -> User:
    """Create a sample user for testing."""
    user = User(
        email="test@example.com",
        hashed_password="$argon2id$v=19$m=65536,t=3,p=4$fakehash",
        first_name="John",
        last_name="Doe",
        is_active=True,
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def sample_cabin(db_session: Session) -> Cabin:
    """Create a sample cabin for testing."""
    cabin = Cabin(
        name="Inside Twin",
        cabin_type=CabinTypeEnum.INSIDE,
        bed_type=BedTypeEnum.TWIN,
        max_occupancy=2,
        base_price=Decimal("50.00"),
        has_window=False,
        has_private_bathroom=True,
        has_air_conditioning=True,
        has_tv=False,
        deck_level=3,
        is_accessible=False,
        is_available=True
    )
    db_session.add(cabin)
    db_session.commit()
    db_session.refresh(cabin)
    return cabin


@pytest.fixture
def sample_booking_data() -> Dict[str, Any]:
    """Return sample booking data for creating bookings."""
    return {
        "sailing_id": "CTN-2024-001",
        "operator": "CTN",
        "departure_port": "Tunis",
        "arrival_port": "Marseille",
        "departure_time": datetime.now() + timedelta(days=7),
        "arrival_time": datetime.now() + timedelta(days=7, hours=20),
        "vessel_name": "Carthage",
        "booking_reference": "MR-TEST001",
        "contact_email": "customer@example.com",
        "contact_phone": "+33612345678",
        "contact_first_name": "Marie",
        "contact_last_name": "Dupont",
        "total_passengers": 2,
        "total_vehicles": 1,
        "subtotal": Decimal("450.00"),
        "tax_amount": Decimal("45.00"),
        "total_amount": Decimal("495.00"),
        "currency": "EUR",
        "status": BookingStatusEnum.PENDING,
        "is_round_trip": False,
    }


@pytest.fixture
def sample_booking(db_session: Session, sample_booking_data: Dict[str, Any], sample_user: User) -> Booking:
    """Create a sample booking for testing."""
    booking = Booking(
        user_id=sample_user.id,
        **sample_booking_data
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)
    return booking


@pytest.fixture
def sample_booking_with_passengers(db_session: Session, sample_booking: Booking) -> Booking:
    """Create a booking with passengers."""
    passengers = [
        BookingPassenger(
            booking_id=sample_booking.id,
            passenger_type=PassengerTypeEnum.ADULT,
            first_name="Marie",
            last_name="Dupont",
            date_of_birth=datetime(1985, 5, 15),
            nationality="FR",
            base_price=Decimal("150.00"),
            final_price=Decimal("150.00")
        ),
        BookingPassenger(
            booking_id=sample_booking.id,
            passenger_type=PassengerTypeEnum.CHILD,
            first_name="Lucas",
            last_name="Dupont",
            date_of_birth=datetime(2015, 8, 20),
            nationality="FR",
            base_price=Decimal("75.00"),
            final_price=Decimal("75.00")
        )
    ]
    db_session.add_all(passengers)
    db_session.commit()
    db_session.refresh(sample_booking)
    return sample_booking


@pytest.fixture
def sample_booking_with_vehicle(db_session: Session, sample_booking: Booking) -> Booking:
    """Create a booking with a vehicle."""
    vehicle = BookingVehicle(
        booking_id=sample_booking.id,
        vehicle_type=VehicleTypeEnum.CAR,
        make="Peugeot",
        model="308",
        license_plate="AB-123-CD",
        length_cm=430,
        width_cm=180,
        height_cm=145,
        base_price=Decimal("200.00"),
        final_price=Decimal("200.00")
    )
    db_session.add(vehicle)
    db_session.commit()
    db_session.refresh(sample_booking)
    return sample_booking


@pytest.fixture
def confirmed_booking(db_session: Session, sample_booking: Booking) -> Booking:
    """Create a confirmed booking."""
    sample_booking.status = BookingStatusEnum.CONFIRMED
    sample_booking.operator_booking_reference = "CTN-REF-12345"
    db_session.commit()
    db_session.refresh(sample_booking)
    return sample_booking


@pytest.fixture
def sample_payment(db_session: Session, sample_booking: Booking) -> Payment:
    """Create a sample payment for a booking."""
    amount = sample_booking.total_amount
    payment = Payment(
        booking_id=sample_booking.id,
        amount=amount,
        currency="EUR",
        payment_method=PaymentMethodEnum.CREDIT_CARD,
        status=PaymentStatusEnum.COMPLETED,
        stripe_payment_intent_id="pi_test_12345",
        stripe_charge_id="ch_test_12345",
        card_brand="visa",
        card_last_four="4242",
        net_amount=amount * Decimal("0.97")  # 3% fee
    )
    db_session.add(payment)
    db_session.commit()
    db_session.refresh(payment)
    return payment


@pytest.fixture
def sample_promo_code(db_session: Session) -> PromoCode:
    """Create a sample promo code."""
    promo = PromoCode(
        code="SUMMER20",
        description="Summer discount 20%",
        discount_type=PromoCodeTypeEnum.PERCENTAGE,
        discount_value=Decimal("20.00"),
        minimum_amount=Decimal("100.00"),
        maximum_discount=Decimal("50.00"),
        max_uses=100,
        current_uses=0,
        max_uses_per_user=1,
        valid_from=datetime.utcnow() - timedelta(days=1),
        valid_until=datetime.utcnow() + timedelta(days=30),
        is_active=True,
        first_booking_only=False
    )
    db_session.add(promo)
    db_session.commit()
    db_session.refresh(promo)
    return promo


@pytest.fixture
def sample_round_trip_booking(db_session: Session, sample_user: User) -> Booking:
    """Create a round-trip booking."""
    booking = Booking(
        user_id=sample_user.id,
        sailing_id="CTN-2024-001",
        operator="CTN",
        departure_port="Tunis",
        arrival_port="Marseille",
        departure_time=datetime.now() + timedelta(days=7),
        arrival_time=datetime.now() + timedelta(days=7, hours=20),
        vessel_name="Carthage",
        booking_reference="MR-RT001",
        contact_email="customer@example.com",
        contact_phone="+33612345678",
        contact_first_name="Pierre",
        contact_last_name="Martin",
        total_passengers=1,
        total_vehicles=0,
        subtotal=Decimal("300.00"),
        tax_amount=Decimal("30.00"),
        total_amount=Decimal("330.00"),
        currency="EUR",
        status=BookingStatusEnum.PENDING,
        is_round_trip=True,
        return_sailing_id="CTN-2024-002",
        return_operator="CTN",
        return_departure_port="Marseille",
        return_arrival_port="Tunis",
        return_departure_time=datetime.now() + timedelta(days=14),
        return_arrival_time=datetime.now() + timedelta(days=14, hours=20),
        return_vessel_name="Carthage"
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)
    return booking


@pytest.fixture
def booking_with_cabin(db_session: Session, sample_booking: Booking, sample_cabin: Cabin) -> Booking:
    """Create a booking with cabin selection."""
    booking_cabin = BookingCabin(
        booking_id=sample_booking.id,
        cabin_id=sample_cabin.id,
        journey_type=JourneyTypeEnum.OUTBOUND,
        quantity=1,
        unit_price=Decimal("50.00"),
        total_price=Decimal("50.00"),
        is_paid=False
    )
    db_session.add(booking_cabin)

    # Update booking totals
    sample_booking.cabin_supplement = Decimal("50.00")
    sample_booking.subtotal = sample_booking.subtotal + Decimal("50.00")
    sample_booking.tax_amount = sample_booking.subtotal * Decimal("0.10")
    sample_booking.total_amount = sample_booking.subtotal + sample_booking.tax_amount

    db_session.commit()
    db_session.refresh(sample_booking)
    return sample_booking


# Mock fixtures for external services

@pytest.fixture
def mock_stripe():
    """Mock Stripe API."""
    with patch('stripe.PaymentIntent') as mock_pi:
        mock_pi.create.return_value = MagicMock(
            id="pi_test_12345",
            client_secret="pi_test_12345_secret_test",
            status="requires_payment_method"
        )
        mock_pi.retrieve.return_value = MagicMock(
            id="pi_test_12345",
            status="succeeded",
            amount=49500,
            currency="eur"
        )
        mock_pi.confirm.return_value = MagicMock(
            id="pi_test_12345",
            status="succeeded"
        )
        yield mock_pi


@pytest.fixture
def mock_email_service():
    """Mock email service."""
    with patch('app.services.email_service.EmailService') as mock_email:
        mock_instance = MagicMock()
        mock_instance.send_booking_confirmation.return_value = True
        mock_instance.send_payment_confirmation.return_value = True
        mock_instance.send_cancellation_confirmation.return_value = True
        mock_email.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_ferry_service():
    """Mock ferry service for operator API calls."""
    with patch('app.services.ferry_service.FerryService') as mock_ferry:
        mock_instance = MagicMock()
        mock_instance.search_ferries.return_value = [
            {
                "sailing_id": "CTN-2024-001",
                "operator": "CTN",
                "departure_port": "Tunis",
                "arrival_port": "Marseille",
                "departure_time": datetime.now() + timedelta(days=7),
                "arrival_time": datetime.now() + timedelta(days=7, hours=20),
                "vessel_name": "Carthage",
                "adult_price": 150.00,
                "child_price": 75.00,
                "vehicle_price": 200.00,
                "available_seats": 100
            }
        ]
        mock_instance.confirm_booking.return_value = {
            "success": True,
            "operator_reference": "CTN-REF-12345"
        }
        mock_ferry.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    with patch('redis.Redis') as mock_redis_class:
        mock_instance = MagicMock()
        mock_instance.get.return_value = None
        mock_instance.set.return_value = True
        mock_instance.delete.return_value = True
        mock_instance.exists.return_value = False
        mock_redis_class.return_value = mock_instance
        yield mock_instance


# Helper functions for tests

def create_booking_reference() -> str:
    """Generate a unique booking reference for tests."""
    import uuid
    return f"MR-TEST{uuid.uuid4().hex[:6].upper()}"


def create_test_booking(
    db_session: Session,
    user_id: int = None,
    status: BookingStatusEnum = BookingStatusEnum.PENDING,
    **kwargs
) -> Booking:
    """Helper to create test bookings with custom parameters."""
    defaults = {
        "sailing_id": "TEST-001",
        "operator": "CTN",
        "departure_port": "Tunis",
        "arrival_port": "Marseille",
        "departure_time": datetime.now() + timedelta(days=7),
        "arrival_time": datetime.now() + timedelta(days=7, hours=20),
        "vessel_name": "Test Vessel",
        "booking_reference": create_booking_reference(),
        "contact_email": "test@example.com",
        "contact_first_name": "Test",
        "contact_last_name": "User",
        "total_passengers": 1,
        "total_vehicles": 0,
        "subtotal": Decimal("150.00"),
        "tax_amount": Decimal("15.00"),
        "total_amount": Decimal("165.00"),
        "currency": "EUR",
        "status": status
    }
    defaults.update(kwargs)
    if user_id:
        defaults["user_id"] = user_id

    booking = Booking(**defaults)
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)
    return booking
