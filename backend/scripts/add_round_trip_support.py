#!/usr/bin/env python3
"""
Migration script to add round trip support:
- Add journey_type to booking_meals table
- Add return journey fields to bookings table
- Add return_cabin_id and return_cabin_supplement to bookings table
"""

import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal, engine
from sqlalchemy import text

def run_migration():
    db = SessionLocal()

    try:
        print("=== Adding Round Trip Support ===\n")

        # Check if columns already exist
        print("Checking current schema...")

        # Add journey_type to booking_meals
        print("\n1. Adding journey_type column to booking_meals...")
        try:
            db.execute(text("""
                ALTER TABLE booking_meals
                ADD COLUMN journey_type VARCHAR(20) NULL
            """))
            db.commit()
            print("   ✓ Added journey_type column")
        except Exception as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("   ℹ Column journey_type already exists")
                db.rollback()
            else:
                raise

        # Add return journey fields to bookings
        print("\n2. Adding return journey fields to bookings...")

        fields_to_add = [
            ("is_round_trip", "BOOLEAN DEFAULT 0"),
            ("return_sailing_id", "VARCHAR(100) NULL"),
            ("return_departure_time", "TIMESTAMP NULL"),
            ("return_arrival_time", "TIMESTAMP NULL"),
            ("return_vessel_name", "VARCHAR(100) NULL"),
            ("return_cabin_id", "INTEGER NULL"),
            ("return_cabin_supplement", "DECIMAL(10,2) DEFAULT 0.00"),
        ]

        for column_name, column_type in fields_to_add:
            try:
                db.execute(text(f"""
                    ALTER TABLE bookings
                    ADD COLUMN {column_name} {column_type}
                """))
                db.commit()
                print(f"   ✓ Added {column_name} column")
            except Exception as e:
                if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                    print(f"   ℹ Column {column_name} already exists")
                    db.rollback()
                else:
                    raise

        print("\n✓ Migration completed successfully!")
        print("\nNew features enabled:")
        print("  - Meals can now be assigned to OUTBOUND or RETURN journeys")
        print("  - Bookings can have separate cabins for outbound and return")
        print("  - Return journey details (sailing_id, times, vessel) can be stored")

    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
