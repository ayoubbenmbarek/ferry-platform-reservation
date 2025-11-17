"""
Script to populate sample cabins and meals data.
Run with: docker-compose exec backend python scripts/populate_cabins_meals.py
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.ferry import Cabin, CabinTypeEnum, BedTypeEnum
from app.models.meal import Meal, MealTypeEnum


def populate_cabins():
    """Create sample cabin options."""
    db = SessionLocal()

    cabins = [
        # Seats (cheapest)
        Cabin(
            name="Aircraft-Style Reclining Seat",
            description="Comfortable reclining seat in the main lounge area. Perfect for short crossings.",
            cabin_type=CabinTypeEnum.SEAT,
            bed_type=BedTypeEnum.SINGLE,
            max_occupancy=1,
            has_private_bathroom=False,
            has_tv=False,
            has_minibar=False,
            has_air_conditioning=True,
            has_wifi=True,
            is_accessible=True,
            base_price=15.00,
            currency="EUR",
            is_available=True,
        ),

        # Inside Cabins
        Cabin(
            name="Standard Inside Cabin - Twin Beds",
            description="Cozy inside cabin with two single beds. Ideal for budget-conscious travelers.",
            cabin_type=CabinTypeEnum.INSIDE,
            bed_type=BedTypeEnum.TWIN,
            max_occupancy=2,
            has_private_bathroom=True,
            has_tv=True,
            has_minibar=False,
            has_air_conditioning=True,
            has_wifi=True,
            is_accessible=False,
            base_price=45.00,
            currency="EUR",
            is_available=True,
        ),
        Cabin(
            name="Standard Inside Cabin - Double Bed",
            description="Comfortable inside cabin with a double bed.",
            cabin_type=CabinTypeEnum.INSIDE,
            bed_type=BedTypeEnum.DOUBLE,
            max_occupancy=2,
            has_private_bathroom=True,
            has_tv=True,
            has_minibar=False,
            has_air_conditioning=True,
            has_wifi=True,
            is_accessible=False,
            base_price=50.00,
            currency="EUR",
            is_available=True,
        ),
        Cabin(
            name="Family Inside Cabin",
            description="Spacious cabin with bunk beds, perfect for families.",
            cabin_type=CabinTypeEnum.INSIDE,
            bed_type=BedTypeEnum.BUNK,
            max_occupancy=4,
            has_private_bathroom=True,
            has_tv=True,
            has_minibar=False,
            has_air_conditioning=True,
            has_wifi=True,
            is_accessible=False,
            base_price=80.00,
            currency="EUR",
            is_available=True,
        ),

        # Outside Cabins (with window)
        Cabin(
            name="Outside Cabin - Sea View",
            description="Cabin with window offering beautiful sea views. Twin beds configuration.",
            cabin_type=CabinTypeEnum.OUTSIDE,
            bed_type=BedTypeEnum.TWIN,
            max_occupancy=2,
            has_private_bathroom=True,
            has_tv=True,
            has_minibar=False,
            has_air_conditioning=True,
            has_wifi=True,
            is_accessible=True,
            base_price=65.00,
            currency="EUR",
            is_available=True,
        ),
        Cabin(
            name="Deluxe Outside Cabin",
            description="Premium cabin with large window and double bed.",
            cabin_type=CabinTypeEnum.OUTSIDE,
            bed_type=BedTypeEnum.DOUBLE,
            max_occupancy=2,
            has_private_bathroom=True,
            has_tv=True,
            has_minibar=True,
            has_air_conditioning=True,
            has_wifi=True,
            is_accessible=False,
            base_price=85.00,
            currency="EUR",
            is_available=True,
        ),

        # Balcony Cabins
        Cabin(
            name="Balcony Cabin",
            description="Luxurious cabin with private balcony for enjoying the sea breeze.",
            cabin_type=CabinTypeEnum.BALCONY,
            bed_type=BedTypeEnum.DOUBLE,
            max_occupancy=2,
            has_private_bathroom=True,
            has_tv=True,
            has_minibar=True,
            has_air_conditioning=True,
            has_wifi=True,
            is_accessible=False,
            base_price=120.00,
            currency="EUR",
            is_available=True,
        ),

        # Suites
        Cabin(
            name="Executive Suite",
            description="Spacious suite with separate living area, premium amenities, and private balcony.",
            cabin_type=CabinTypeEnum.SUITE,
            bed_type=BedTypeEnum.DOUBLE,
            max_occupancy=3,
            has_private_bathroom=True,
            has_tv=True,
            has_minibar=True,
            has_air_conditioning=True,
            has_wifi=True,
            is_accessible=False,
            base_price=180.00,
            currency="EUR",
            is_available=True,
        ),
        Cabin(
            name="Family Suite",
            description="Large suite with double bed and pullman bed, perfect for families.",
            cabin_type=CabinTypeEnum.SUITE,
            bed_type=BedTypeEnum.PULLMAN,
            max_occupancy=4,
            has_private_bathroom=True,
            has_tv=True,
            has_minibar=True,
            has_air_conditioning=True,
            has_wifi=True,
            is_accessible=False,
            base_price=220.00,
            currency="EUR",
            is_available=True,
        ),
    ]

    for cabin in cabins:
        db.add(cabin)

    db.commit()
    print(f"✓ Created {len(cabins)} cabin options")
    db.close()


def populate_meals():
    """Create sample meal options."""
    db = SessionLocal()

    meals = [
        # Breakfast
        Meal(
            name="Continental Breakfast",
            description="Fresh pastries, bread, butter, jam, coffee/tea, orange juice",
            meal_type=MealTypeEnum.BREAKFAST,
            price=8.50,
            currency="EUR",
            is_available=True,
            available_per_day=True,
            dietary_types='["REGULAR", "VEGETARIAN"]',
        ),
        Meal(
            name="Full English Breakfast",
            description="Eggs, bacon, sausage, beans, toast, mushrooms, tomatoes, coffee/tea",
            meal_type=MealTypeEnum.BREAKFAST,
            price=12.50,
            currency="EUR",
            is_available=True,
            available_per_day=True,
            dietary_types='["REGULAR"]',
        ),
        Meal(
            name="Vegan Breakfast Bowl",
            description="Fresh fruits, granola, plant-based yogurt, nuts, seeds, herbal tea",
            meal_type=MealTypeEnum.BREAKFAST,
            price=10.00,
            currency="EUR",
            is_available=True,
            available_per_day=True,
            dietary_types='["VEGAN", "DAIRY_FREE"]',
        ),

        # Lunch
        Meal(
            name="Mediterranean Lunch",
            description="Greek salad, grilled chicken, pita bread, tzatziki, fruit",
            meal_type=MealTypeEnum.LUNCH,
            price=15.00,
            currency="EUR",
            is_available=True,
            available_per_day=True,
            dietary_types='["REGULAR", "HALAL"]',
        ),
        Meal(
            name="Pasta Primavera",
            description="Fresh pasta with seasonal vegetables, garlic bread, dessert",
            meal_type=MealTypeEnum.LUNCH,
            price=13.50,
            currency="EUR",
            is_available=True,
            available_per_day=True,
            dietary_types='["VEGETARIAN"]',
        ),
        Meal(
            name="Fish & Chips",
            description="Beer-battered fish, chips, mushy peas, tartar sauce",
            meal_type=MealTypeEnum.LUNCH,
            price=14.00,
            currency="EUR",
            is_available=True,
            available_per_day=True,
            dietary_types='["REGULAR"]',
        ),

        # Dinner
        Meal(
            name="Grilled Salmon Dinner",
            description="Atlantic salmon, roasted vegetables, rice, salad, dessert",
            meal_type=MealTypeEnum.DINNER,
            price=22.00,
            currency="EUR",
            is_available=True,
            available_per_day=True,
            dietary_types='["REGULAR", "GLUTEN_FREE"]',
        ),
        Meal(
            name="Beef Steak Dinner",
            description="Premium beef steak, mashed potatoes, grilled vegetables, sauce, dessert",
            meal_type=MealTypeEnum.DINNER,
            price=28.00,
            currency="EUR",
            is_available=True,
            available_per_day=True,
            dietary_types='["REGULAR", "HALAL"]',
        ),
        Meal(
            name="Vegetarian Lasagna",
            description="Homemade vegetable lasagna, garlic bread, side salad, dessert",
            meal_type=MealTypeEnum.DINNER,
            price=18.00,
            currency="EUR",
            is_available=True,
            available_per_day=True,
            dietary_types='["VEGETARIAN"]',
        ),
        Meal(
            name="Vegan Buddha Bowl",
            description="Quinoa, roasted vegetables, chickpeas, tahini dressing, fruit dessert",
            meal_type=MealTypeEnum.DINNER,
            price=16.50,
            currency="EUR",
            is_available=True,
            available_per_day=True,
            dietary_types='["VEGAN", "DAIRY_FREE", "GLUTEN_FREE"]',
        ),

        # Buffet
        Meal(
            name="All-Day Buffet Access",
            description="Unlimited access to buffet with hot and cold dishes, salads, desserts",
            meal_type=MealTypeEnum.BUFFET,
            price=35.00,
            currency="EUR",
            is_available=True,
            available_per_day=True,
            dietary_types='["REGULAR", "VEGETARIAN", "VEGAN", "HALAL", "GLUTEN_FREE"]',
        ),

        # Snacks
        Meal(
            name="Sandwich & Drink Combo",
            description="Choice of sandwich, chips, soft drink or water",
            meal_type=MealTypeEnum.SNACK,
            price=7.50,
            currency="EUR",
            is_available=True,
            available_per_day=False,
            dietary_types='["REGULAR", "VEGETARIAN"]',
        ),
        Meal(
            name="Fresh Fruit Platter",
            description="Selection of seasonal fresh fruits",
            meal_type=MealTypeEnum.SNACK,
            price=5.00,
            currency="EUR",
            is_available=True,
            available_per_day=False,
            dietary_types='["VEGAN", "DAIRY_FREE", "GLUTEN_FREE", "NUT_FREE"]',
        ),
    ]

    for meal in meals:
        db.add(meal)

    db.commit()
    print(f"✓ Created {len(meals)} meal options")
    db.close()


if __name__ == "__main__":
    print("Populating cabins and meals...")
    populate_cabins()
    populate_meals()
    print("Done!")
