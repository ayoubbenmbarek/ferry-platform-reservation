#!/usr/bin/env python3
"""
Script to create all database tables directly from SQLAlchemy models.
Used as a fallback when alembic migrations fail in CI.
"""
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set environment to testing to prevent loading .env files
os.environ["ENVIRONMENT"] = "testing"

from sqlalchemy import create_engine
from app.database import Base

# Import all models to register them with Base
from app.models.user import User
from app.models.booking import Booking, BookingPassenger, BookingVehicle, BookingModification, BookingCabin
from app.models.ferry import Ferry, Route, Schedule, Cabin
from app.models.payment import Payment, PaymentMethod
from app.models.vehicle import VehicleMake, VehicleModel
from app.models.promo_code import PromoCode, PromoCodeUsage
from app.models.availability_alert import AvailabilityAlert
from app.models.meal import Meal, BookingMeal

def create_tables():
    """Create all tables using DATABASE_URL from environment."""
    database_url = os.environ.get("DATABASE_URL")

    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)

    print(f"Creating tables using database: {database_url.split('@')[-1]}")

    engine = create_engine(database_url)

    # Create all tables
    Base.metadata.create_all(bind=engine)

    print("✅ All tables created successfully!")

    # List created tables
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"Tables created: {', '.join(sorted(tables))}")

if __name__ == "__main__":
    create_tables()
