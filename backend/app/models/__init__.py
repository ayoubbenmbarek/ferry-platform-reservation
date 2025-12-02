"""
Database models for the maritime reservation platform.
"""

from .user import User
from .booking import Booking, BookingPassenger, BookingVehicle
from .ferry import Ferry, Route, Schedule, Cabin, CabinTypeEnum, BedTypeEnum
from .payment import Payment, PaymentMethod
from .meal import Meal, BookingMeal, MealTypeEnum, DietaryTypeEnum, JourneyTypeEnum
from .promo_code import PromoCode, PromoCodeUsage, PromoCodeTypeEnum
from .booking_reminder import BookingReminder, ReminderTypeEnum
from .availability_alert import AvailabilityAlert, AlertTypeEnum, AlertStatusEnum

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
    "PromoCode",
    "PromoCodeUsage",
    "PromoCodeTypeEnum",
    "BookingReminder",
    "ReminderTypeEnum",
    "AvailabilityAlert",
    "AlertTypeEnum",
    "AlertStatusEnum",
] 