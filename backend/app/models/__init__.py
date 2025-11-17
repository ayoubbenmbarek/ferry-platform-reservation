"""
Database models for the maritime reservation platform.
"""

from .user import User
from .booking import Booking, BookingPassenger, BookingVehicle
from .ferry import Ferry, Route, Schedule, Cabin, CabinTypeEnum, BedTypeEnum
from .payment import Payment, PaymentMethod
from .meal import Meal, BookingMeal, MealTypeEnum, DietaryTypeEnum, JourneyTypeEnum

__all__ = [
    "User",
    "Booking",
    "BookingPassenger",
    "BookingVehicle",
    "Ferry",
    "Route",
    "Schedule",
    "Cabin",
    "CabinTypeEnum",
    "BedTypeEnum",
    "Payment",
    "PaymentMethod",
    "Meal",
    "BookingMeal",
    "MealTypeEnum",
    "DietaryTypeEnum",
    "JourneyTypeEnum",
] 