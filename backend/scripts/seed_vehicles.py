"""
Script to seed vehicle makes and models database with comprehensive data.
Run with: python -m scripts.seed_vehicles
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal
from app.models.vehicle import VehicleMake, VehicleModel
from app.data.vehicle_seed_data import VEHICLE_MAKES, VEHICLE_MODELS


def seed_vehicles():
    """Seed the database with comprehensive vehicle data."""
    db = SessionLocal()

    try:
        print("Starting vehicle database seeding...")

        # Clear existing data
        print("Clearing existing vehicle data...")
        db.query(VehicleModel).delete()
        db.query(VehicleMake).delete()
        db.commit()

        # Insert makes
        print(f"Inserting {len(VEHICLE_MAKES)} vehicle makes...")
        make_objects = {}
        for make_name in VEHICLE_MAKES:
            make = VehicleMake(name=make_name, is_active=True)
            db.add(make)
            db.flush()  # Get the ID without committing
            make_objects[make_name] = make

        db.commit()
        print(f"✓ Inserted {len(VEHICLE_MAKES)} makes")

        # Insert models
        print(f"Inserting {len(VEHICLE_MODELS)} vehicle models...")
        for make_name, model_name, body_type, length, width, height in VEHICLE_MODELS:
            if make_name in make_objects:
                model = VehicleModel(
                    make_id=make_objects[make_name].id,
                    name=model_name,
                    body_type=body_type,
                    avg_length_cm=length,
                    avg_width_cm=width,
                    avg_height_cm=height,
                    is_active=True
                )
                db.add(model)

        db.commit()
        print(f"✓ Inserted {len(VEHICLE_MODELS)} models")

        # Print summary
        print("\n" + "=" * 50)
        print("DATABASE SEEDING COMPLETE!")
        print("=" * 50)
        print(f"Total Makes: {len(VEHICLE_MAKES)}")
        print(f"Total Models: {len(VEHICLE_MODELS)}")

        # Show some examples
        print("\nSample Makes:")
        for make in db.query(VehicleMake).limit(10).all():
            model_count = db.query(VehicleModel).filter(VehicleModel.make_id == make.id).count()
            print(f"  - {make.name} ({model_count} models)")

        print("\nSample Models:")
        for model in db.query(VehicleModel).join(VehicleMake).limit(10).all():
            print(f"  - {model.make.name} {model.name} ({model.body_type}) - {model.avg_length_cm}×{model.avg_width_cm}×{model.avg_height_cm}cm")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_vehicles()
