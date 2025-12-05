"""
Unit tests for Booking models.
"""

import pytest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models.booking import (
    Booking, BookingPassenger, BookingVehicle, BookingCabin, BookingModification,
    BookingStatusEnum, PassengerTypeEnum, VehicleTypeEnum, JourneyTypeEnum, PetTypeEnum
)


class TestBookingModel:
    """Tests for the Booking model."""

    def test_create_booking(self, db_session, sample_user):
        """Test creating a basic booking."""
        booking = Booking(
            user_id=sample_user.id,
            sailing_id="CTN-2024-001",
            operator="CTN",
            departure_port="Tunis",
            arrival_port="Marseille",
            departure_time=datetime.now() + timedelta(days=7),
            arrival_time=datetime.now() + timedelta(days=7, hours=20),
            vessel_name="Carthage",
            booking_reference="MR-TEST123",
            contact_email="test@example.com",
            contact_first_name="John",
            contact_last_name="Doe",
            total_passengers=2,
            total_vehicles=0,
            subtotal=Decimal("300.00"),
            tax_amount=Decimal("30.00"),
            total_amount=Decimal("330.00"),
            currency="EUR"
        )
        db_session.add(booking)
        db_session.commit()

        assert booking.id is not None
        assert booking.booking_reference == "MR-TEST123"
        assert booking.status == BookingStatusEnum.PENDING
        assert booking.total_amount == Decimal("330.00")

    def test_booking_default_status(self, sample_booking):
        """Test that new bookings have PENDING status by default."""
        assert sample_booking.status == BookingStatusEnum.PENDING

    def test_booking_status_transitions(self, db_session, sample_booking):
        """Test booking status can be changed."""
        # PENDING -> CONFIRMED
        sample_booking.status = BookingStatusEnum.CONFIRMED
        db_session.commit()
        assert sample_booking.status == BookingStatusEnum.CONFIRMED

        # CONFIRMED -> CANCELLED
        sample_booking.status = BookingStatusEnum.CANCELLED
        sample_booking.cancellation_reason = "Customer request"
        sample_booking.cancelled_at = datetime.now()
        db_session.commit()
        assert sample_booking.status == BookingStatusEnum.CANCELLED
        assert sample_booking.cancellation_reason == "Customer request"

    def test_booking_reference_uniqueness(self, db_session, sample_booking, sample_user):
        """Test that booking references must be unique."""
        duplicate_booking = Booking(
            user_id=sample_user.id,
            booking_reference=sample_booking.booking_reference,  # Same reference
            contact_email="other@example.com",
            contact_first_name="Jane",
            contact_last_name="Doe",
            total_passengers=1,
            subtotal=Decimal("100.00"),
            tax_amount=Decimal("10.00"),
            total_amount=Decimal("110.00")
        )
        db_session.add(duplicate_booking)
        with pytest.raises(Exception):  # IntegrityError
            db_session.commit()

    def test_round_trip_booking(self, sample_round_trip_booking):
        """Test round trip booking fields."""
        assert sample_round_trip_booking.is_round_trip is True
        assert sample_round_trip_booking.return_sailing_id is not None
        assert sample_round_trip_booking.return_departure_port == "Marseille"
        assert sample_round_trip_booking.return_arrival_port == "Tunis"

    def test_booking_with_promo_code(self, db_session, sample_booking):
        """Test booking with promo code applied."""
        sample_booking.promo_code = "SUMMER20"
        sample_booking.discount_amount = Decimal("50.00")
        sample_booking.total_amount = sample_booking.total_amount - Decimal("50.00")
        db_session.commit()

        assert sample_booking.promo_code == "SUMMER20"
        assert sample_booking.discount_amount == Decimal("50.00")

    def test_booking_expiration(self, db_session, sample_booking):
        """Test booking expiration field."""
        expires = datetime.now(timezone.utc) + timedelta(hours=1)
        sample_booking.expires_at = expires
        db_session.commit()

        assert sample_booking.expires_at is not None
        # Compare without microseconds to avoid precision issues
        assert sample_booking.expires_at.replace(microsecond=0) == expires.replace(microsecond=0)

    def test_booking_repr(self, sample_booking):
        """Test booking string representation."""
        repr_str = repr(sample_booking)
        assert "Booking" in repr_str
        assert sample_booking.booking_reference in repr_str

    def test_booking_cabin_supplement(self, db_session, sample_booking):
        """Test cabin supplement tracking."""
        sample_booking.cabin_supplement = Decimal("100.00")
        sample_booking.subtotal += Decimal("100.00")
        sample_booking.tax_amount = sample_booking.subtotal * Decimal("0.10")
        sample_booking.total_amount = sample_booking.subtotal + sample_booking.tax_amount
        db_session.commit()

        assert sample_booking.cabin_supplement == Decimal("100.00")


class TestBookingPassengerModel:
    """Tests for the BookingPassenger model."""

    def test_create_adult_passenger(self, db_session, sample_booking):
        """Test creating an adult passenger."""
        passenger = BookingPassenger(
            booking_id=sample_booking.id,
            passenger_type=PassengerTypeEnum.ADULT,
            first_name="Marie",
            last_name="Dupont",
            date_of_birth=datetime(1985, 5, 15),
            nationality="FR",
            passport_number="12AB34567",
            base_price=Decimal("150.00"),
            final_price=Decimal("150.00")
        )
        db_session.add(passenger)
        db_session.commit()

        assert passenger.id is not None
        assert passenger.passenger_type == PassengerTypeEnum.ADULT
        assert passenger.final_price == Decimal("150.00")

    def test_create_child_passenger(self, db_session, sample_booking):
        """Test creating a child passenger with discount."""
        passenger = BookingPassenger(
            booking_id=sample_booking.id,
            passenger_type=PassengerTypeEnum.CHILD,
            first_name="Lucas",
            last_name="Dupont",
            date_of_birth=datetime(2015, 8, 20),
            nationality="FR",
            base_price=Decimal("150.00"),
            discounts=Decimal("75.00"),
            final_price=Decimal("75.00")
        )
        db_session.add(passenger)
        db_session.commit()

        assert passenger.passenger_type == PassengerTypeEnum.CHILD
        assert passenger.discounts == Decimal("75.00")
        assert passenger.final_price == Decimal("75.00")

    def test_create_infant_passenger(self, db_session, sample_booking):
        """Test creating an infant passenger (free)."""
        passenger = BookingPassenger(
            booking_id=sample_booking.id,
            passenger_type=PassengerTypeEnum.INFANT,
            first_name="Emma",
            last_name="Dupont",
            date_of_birth=datetime(2023, 1, 10),
            nationality="FR",
            base_price=Decimal("0.00"),
            final_price=Decimal("0.00")
        )
        db_session.add(passenger)
        db_session.commit()

        assert passenger.passenger_type == PassengerTypeEnum.INFANT
        assert passenger.final_price == Decimal("0.00")

    def test_passenger_with_pet(self, db_session, sample_booking):
        """Test passenger with pet information."""
        passenger = BookingPassenger(
            booking_id=sample_booking.id,
            passenger_type=PassengerTypeEnum.ADULT,
            first_name="Pierre",
            last_name="Martin",
            base_price=Decimal("150.00"),
            final_price=Decimal("170.00"),  # Including pet fee
            has_pet=True,
            pet_type=PetTypeEnum.DOG,
            pet_name="Max",
            pet_weight_kg=Decimal("15.5"),
            pet_carrier_provided=True
        )
        db_session.add(passenger)
        db_session.commit()

        assert passenger.has_pet is True
        assert passenger.pet_type == PetTypeEnum.DOG
        assert passenger.pet_name == "Max"
        assert passenger.pet_weight_kg == Decimal("15.5")

    def test_passenger_special_needs(self, db_session, sample_booking):
        """Test passenger with special needs."""
        passenger = BookingPassenger(
            booking_id=sample_booking.id,
            passenger_type=PassengerTypeEnum.ADULT,
            first_name="Sophie",
            last_name="Bernard",
            base_price=Decimal("150.00"),
            final_price=Decimal("150.00"),
            mobility_assistance=True,
            special_needs="Wheelchair access required",
            dietary_requirements="Vegetarian"
        )
        db_session.add(passenger)
        db_session.commit()

        assert passenger.mobility_assistance is True
        assert passenger.special_needs == "Wheelchair access required"
        assert passenger.dietary_requirements == "Vegetarian"

    def test_passenger_repr(self, db_session, sample_booking):
        """Test passenger string representation."""
        passenger = BookingPassenger(
            booking_id=sample_booking.id,
            passenger_type=PassengerTypeEnum.ADULT,
            first_name="Test",
            last_name="User",
            base_price=Decimal("100.00"),
            final_price=Decimal("100.00")
        )
        db_session.add(passenger)
        db_session.commit()

        repr_str = repr(passenger)
        assert "BookingPassenger" in repr_str
        assert "Test User" in repr_str


class TestBookingVehicleModel:
    """Tests for the BookingVehicle model."""

    def test_create_car_vehicle(self, db_session, sample_booking):
        """Test creating a car vehicle."""
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

        assert vehicle.id is not None
        assert vehicle.vehicle_type == VehicleTypeEnum.CAR
        assert vehicle.license_plate == "AB-123-CD"

    def test_vehicle_with_accessories(self, db_session, sample_booking):
        """Test vehicle with accessories."""
        vehicle = BookingVehicle(
            booking_id=sample_booking.id,
            vehicle_type=VehicleTypeEnum.CAR,
            license_plate="XY-789-ZZ",
            length_cm=480,
            width_cm=200,
            height_cm=200,  # With roof box
            base_price=Decimal("200.00"),
            size_supplement=Decimal("30.00"),
            final_price=Decimal("230.00"),
            has_roof_box=True,
            has_bike_rack=True
        )
        db_session.add(vehicle)
        db_session.commit()

        assert vehicle.has_roof_box is True
        assert vehicle.has_bike_rack is True
        assert vehicle.size_supplement == Decimal("30.00")

    def test_camper_vehicle(self, db_session, sample_booking):
        """Test camper/motorhome vehicle."""
        vehicle = BookingVehicle(
            booking_id=sample_booking.id,
            vehicle_type=VehicleTypeEnum.CAMPER,
            make="Fiat",
            model="Ducato",
            license_plate="CA-456-MP",
            length_cm=700,
            width_cm=220,
            height_cm=300,
            weight_kg=3500,
            base_price=Decimal("350.00"),
            size_supplement=Decimal("100.00"),
            final_price=Decimal("450.00")
        )
        db_session.add(vehicle)
        db_session.commit()

        assert vehicle.vehicle_type == VehicleTypeEnum.CAMPER
        assert vehicle.weight_kg == 3500

    def test_vehicle_with_trailer(self, db_session, sample_booking):
        """Test vehicle with trailer."""
        vehicle = BookingVehicle(
            booking_id=sample_booking.id,
            vehicle_type=VehicleTypeEnum.CAR,
            license_plate="TR-111-AA",
            length_cm=430,
            width_cm=180,
            height_cm=145,
            base_price=Decimal("200.00"),
            size_supplement=Decimal("150.00"),
            final_price=Decimal("350.00"),
            has_trailer=True
        )
        db_session.add(vehicle)
        db_session.commit()

        assert vehicle.has_trailer is True
        assert vehicle.final_price == Decimal("350.00")

    def test_vehicle_hazardous_materials(self, db_session, sample_booking):
        """Test vehicle with hazardous materials flag."""
        vehicle = BookingVehicle(
            booking_id=sample_booking.id,
            vehicle_type=VehicleTypeEnum.TRUCK,
            license_plate="HZ-999-XX",
            length_cm=1200,
            width_cm=250,
            height_cm=400,
            base_price=Decimal("500.00"),
            final_price=Decimal("500.00"),
            contains_hazardous_materials=True,
            requires_special_handling=True,
            special_instructions="Contains chemical samples - requires ventilated deck"
        )
        db_session.add(vehicle)
        db_session.commit()

        assert vehicle.contains_hazardous_materials is True
        assert vehicle.requires_special_handling is True

    def test_vehicle_repr(self, sample_booking_with_vehicle):
        """Test vehicle string representation."""
        vehicle = sample_booking_with_vehicle.vehicles[0]
        repr_str = repr(vehicle)
        assert "BookingVehicle" in repr_str
        assert vehicle.license_plate in repr_str


class TestBookingCabinModel:
    """Tests for the BookingCabin model."""

    def test_create_booking_cabin(self, db_session, sample_booking, sample_cabin):
        """Test creating a cabin selection."""
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
        db_session.commit()

        assert booking_cabin.id is not None
        assert booking_cabin.journey_type == JourneyTypeEnum.OUTBOUND
        assert booking_cabin.total_price == Decimal("50.00")

    def test_multiple_cabins_same_booking(self, db_session, sample_booking, sample_cabin):
        """Test multiple cabin selections for same booking."""
        # Outbound cabin
        cabin1 = BookingCabin(
            booking_id=sample_booking.id,
            cabin_id=sample_cabin.id,
            journey_type=JourneyTypeEnum.OUTBOUND,
            quantity=2,
            unit_price=Decimal("50.00"),
            total_price=Decimal("100.00")
        )
        # Return cabin
        cabin2 = BookingCabin(
            booking_id=sample_booking.id,
            cabin_id=sample_cabin.id,
            journey_type=JourneyTypeEnum.RETURN,
            quantity=2,
            unit_price=Decimal("50.00"),
            total_price=Decimal("100.00")
        )
        db_session.add_all([cabin1, cabin2])
        db_session.commit()

        db_session.refresh(sample_booking)
        assert len(sample_booking.booking_cabins) == 2

    def test_cabin_payment_tracking(self, db_session, sample_booking, sample_cabin, sample_payment):
        """Test cabin payment tracking."""
        booking_cabin = BookingCabin(
            booking_id=sample_booking.id,
            cabin_id=sample_cabin.id,
            journey_type=JourneyTypeEnum.OUTBOUND,
            quantity=1,
            unit_price=Decimal("50.00"),
            total_price=Decimal("50.00"),
            payment_id=sample_payment.id,
            is_paid=True
        )
        db_session.add(booking_cabin)
        db_session.commit()

        assert booking_cabin.is_paid is True
        assert booking_cabin.payment_id == sample_payment.id

    def test_cabin_repr(self, db_session, sample_booking, sample_cabin):
        """Test cabin string representation."""
        booking_cabin = BookingCabin(
            booking_id=sample_booking.id,
            cabin_id=sample_cabin.id,
            journey_type=JourneyTypeEnum.OUTBOUND,
            quantity=1,
            unit_price=Decimal("50.00"),
            total_price=Decimal("50.00")
        )
        db_session.add(booking_cabin)
        db_session.commit()

        repr_str = repr(booking_cabin)
        assert "BookingCabin" in repr_str


class TestBookingModificationModel:
    """Tests for the BookingModification model."""

    def test_create_modification(self, db_session, sample_booking, sample_user):
        """Test creating a booking modification record."""
        modification = BookingModification(
            booking_id=sample_booking.id,
            modified_by_user_id=sample_user.id,
            changes='{"departure_time": {"old": "2024-01-15", "new": "2024-01-20"}}',
            original_total=Decimal("495.00"),
            new_total=Decimal("520.00"),
            modification_fee=Decimal("25.00"),
            price_difference=Decimal("25.00"),
            total_charged=Decimal("50.00"),
            status="completed"
        )
        db_session.add(modification)
        db_session.commit()

        assert modification.id is not None
        assert modification.total_charged == Decimal("50.00")
        assert modification.status == "completed"

    def test_modification_by_admin(self, db_session, sample_booking):
        """Test modification by admin."""
        modification = BookingModification(
            booking_id=sample_booking.id,
            modified_by_admin=True,
            changes='{"status": {"old": "PENDING", "new": "CONFIRMED"}}',
            original_total=Decimal("495.00"),
            new_total=Decimal("495.00"),
            modification_fee=Decimal("0.00"),
            price_difference=Decimal("0.00"),
            total_charged=Decimal("0.00"),
            status="completed"
        )
        db_session.add(modification)
        db_session.commit()

        assert modification.modified_by_admin is True

    def test_modification_operator_confirmation(self, db_session, sample_booking):
        """Test modification with operator confirmation."""
        modification = BookingModification(
            booking_id=sample_booking.id,
            changes='{"sailing_id": {"old": "CTN-001", "new": "CTN-002"}}',
            original_total=Decimal("495.00"),
            new_total=Decimal("495.00"),
            modification_fee=Decimal("25.00"),
            price_difference=Decimal("0.00"),
            total_charged=Decimal("25.00"),
            status="completed",
            operator_confirmed=True,
            operator_reference="CTN-MOD-12345"
        )
        db_session.add(modification)
        db_session.commit()

        assert modification.operator_confirmed is True
        assert modification.operator_reference == "CTN-MOD-12345"


class TestBookingRelationships:
    """Tests for booking relationships."""

    def test_booking_user_relationship(self, sample_booking, sample_user):
        """Test booking-user relationship."""
        assert sample_booking.user == sample_user
        assert sample_booking in sample_user.bookings

    def test_booking_passengers_relationship(self, sample_booking_with_passengers):
        """Test booking-passengers relationship."""
        assert len(sample_booking_with_passengers.passengers) == 2
        for passenger in sample_booking_with_passengers.passengers:
            assert passenger.booking == sample_booking_with_passengers

    def test_booking_vehicles_relationship(self, sample_booking_with_vehicle):
        """Test booking-vehicles relationship."""
        assert len(sample_booking_with_vehicle.vehicles) == 1
        assert sample_booking_with_vehicle.vehicles[0].booking == sample_booking_with_vehicle

    def test_booking_cabin_relationship(self, booking_with_cabin, sample_cabin):
        """Test booking-cabin relationship."""
        assert len(booking_with_cabin.booking_cabins) == 1
        assert booking_with_cabin.booking_cabins[0].cabin == sample_cabin

    def test_cascade_delete_passengers(self, db_session, sample_booking_with_passengers):
        """Test that deleting booking cascades to passengers."""
        booking_id = sample_booking_with_passengers.id
        db_session.delete(sample_booking_with_passengers)
        db_session.commit()

        # Verify passengers are also deleted
        remaining = db_session.query(BookingPassenger).filter(
            BookingPassenger.booking_id == booking_id
        ).all()
        assert len(remaining) == 0

    def test_cascade_delete_vehicles(self, db_session, sample_booking_with_vehicle):
        """Test that deleting booking cascades to vehicles."""
        booking_id = sample_booking_with_vehicle.id
        db_session.delete(sample_booking_with_vehicle)
        db_session.commit()

        # Verify vehicles are also deleted
        remaining = db_session.query(BookingVehicle).filter(
            BookingVehicle.booking_id == booking_id
        ).all()
        assert len(remaining) == 0
