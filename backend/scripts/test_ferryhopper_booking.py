#!/usr/bin/env python3
"""
Test script for FerryHopper booking flow.

This script tests the complete booking flow:
1. Search for ferries
2. Select a sailing
3. Create a booking
4. Get booking status

Usage:
    cd backend
    python scripts/test_ferryhopper_booking.py
"""

import asyncio
import sys
import os
from datetime import date, timedelta

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
from app.services.ferry_integrations.ferryhopper import FerryHopperIntegration
from app.services.ferry_integrations.base import SearchRequest, BookingRequest


async def test_search():
    """Test search functionality."""
    print("\n" + "=" * 60)
    print("STEP 1: Search for ferries")
    print("=" * 60)

    integration = FerryHopperIntegration(
        api_key=settings.FERRYHOPPER_API_KEY,
        base_url=settings.FERRYHOPPER_BASE_URL
    )

    # Search parameters - use FerryHopper sandbox test routes
    # PIR:JTR = Athens (Piraeus) to Santorini - ETICKET boarding (sandbox compatible)
    # PIR:JNX = Athens to Naxos - PRINTED_BOARDING_PASS
    # GRA:ANC = Patras to Ancona - BOARDING_PASS
    search_request = SearchRequest(
        departure_port="PIR",  # Piraeus (Athens)
        arrival_port="JTR",    # Santorini (Thira)
        departure_date=date.today() + timedelta(days=14),  # 2 weeks ahead
        adults=1,
        children=0,
        infants=0,
        vehicles=[]
    )

    print(f"Searching: {search_request.departure_port} -> {search_request.arrival_port}")
    print(f"Date: {search_request.departure_date}")
    print(f"Passengers: {search_request.adults} adult(s)")

    async with integration:
        results = await integration.search_ferries(search_request)

    print(f"\nFound {len(results)} results")

    if results:
        for i, result in enumerate(results[:3]):  # Show first 3
            print(f"\n  [{i+1}] {result.operator} - {result.vessel_name}")
            print(f"      Departure: {result.departure_time}")
            print(f"      Arrival: {result.arrival_time}")
            print(f"      Price: {result.prices.get('adult', 'N/A')} EUR")
            print(f"      Sailing ID: {result.sailing_id}")
            if hasattr(result, 'booking_solution'):
                print(f"      Booking solution cached: Yes")
                print(f"      Accommodations: {len(result.booking_solution.get('accommodations', []))}")

    return results


async def test_booking(results):
    """Test booking creation with first result."""
    if not results:
        print("\nNo results to book. Skipping booking test.")
        return None

    print("\n" + "=" * 60)
    print("STEP 2: Create booking")
    print("=" * 60)

    # Select first result
    selected = results[0]
    print(f"Selected: {selected.operator} - {selected.vessel_name}")
    print(f"Sailing ID: {selected.sailing_id}")

    integration = FerryHopperIntegration(
        api_key=settings.FERRYHOPPER_API_KEY,
        base_url=settings.FERRYHOPPER_BASE_URL
    )

    # Build booking request with test data
    booking_request = BookingRequest(
        sailing_id=selected.sailing_id,
        passengers=[
            {
                "first_name": "Test",
                "last_name": "Passenger",
                "age": 30,
                "gender": "MALE",
                "nationality": "FR",
                "date_of_birth": "1994-01-15"
            }
        ],
        vehicles=[],
        cabin_selection=None,  # Use default (cheapest)
        contact_info={
            "email": "test@voilaferry.com",
            "phone": "0600000000",
            "phone_country_code": "+33"
        },
        special_requests=None
    )

    print(f"\nBooking for: {booking_request.passengers[0]['first_name']} {booking_request.passengers[0]['last_name']}")
    print(f"Contact: {booking_request.contact_info['email']}")

    try:
        async with integration:
            confirmation = await integration.create_booking(booking_request)

        print(f"\n✅ Booking created successfully!")
        print(f"   Booking Reference: {confirmation.booking_reference}")
        print(f"   Status: {confirmation.status}")
        print(f"   Total: {confirmation.total_amount} {confirmation.currency}")
        print(f"   Details: {confirmation.confirmation_details}")

        return confirmation

    except Exception as e:
        print(f"\n❌ Booking failed: {e}")
        return None


async def test_booking_status(confirmation):
    """Test getting booking status."""
    if not confirmation:
        print("\nNo confirmation to check. Skipping status test.")
        return

    print("\n" + "=" * 60)
    print("STEP 3: Get booking status")
    print("=" * 60)

    integration = FerryHopperIntegration(
        api_key=settings.FERRYHOPPER_API_KEY,
        base_url=settings.FERRYHOPPER_BASE_URL
    )

    try:
        async with integration:
            status = await integration.get_booking_status(confirmation.booking_reference)

        print(f"\n✅ Status retrieved:")
        print(f"   Booking Reference: {status.get('booking_reference')}")
        print(f"   Status: {status.get('status')}")
        print(f"   FerryHopper Status: {status.get('ferryhopper_status')}")
        print(f"   Boarding Methods: {status.get('boarding_methods')}")

    except Exception as e:
        print(f"\n❌ Status check failed: {e}")


async def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("FerryHopper Booking Flow Test")
    print("=" * 60)
    print(f"API URL: {settings.FERRYHOPPER_BASE_URL}")
    print(f"API Key: {settings.FERRYHOPPER_API_KEY[:8]}...")

    # Check if we have a valid API key
    if not settings.FERRYHOPPER_API_KEY:
        print("\n❌ FERRYHOPPER_API_KEY not configured!")
        return

    # Step 1: Search
    results = await test_search()

    # Step 2: Book (using sandbox key for full booking flow)
    # Note: With restricted key, booking will fail
    if "sandbox" in settings.FERRYHOPPER_API_KEY.lower() or settings.FERRYHOPPER_API_KEY.startswith("9152"):
        confirmation = await test_booking(results)
    else:
        print("\n⚠️  Skipping booking test (not using sandbox API key)")
        print("   Sandbox key starts with: 9152f15e...")
        print("   Your key starts with: " + settings.FERRYHOPPER_API_KEY[:8])
        confirmation = None

    # Step 3: Check status
    if confirmation:
        await test_booking_status(confirmation)

    print("\n" + "=" * 60)
    print("Test complete!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
