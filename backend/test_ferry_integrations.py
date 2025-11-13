"""
Test script for ferry integrations.
Run this to test the ferry search functionality.

Usage:
    python test_ferry_integrations.py
"""

import asyncio
from datetime import date, timedelta
from app.services.ferry_service import get_ferry_service


async def test_ferry_search():
    """Test ferry search with mock data."""
    print("=" * 60)
    print("Ferry Integration Test")
    print("=" * 60)
    print()

    # Initialize ferry service (will use mock integrations in development)
    ferry_service = get_ferry_service(use_mock=True)

    print(f"Available operators: {ferry_service.get_available_operators()}")
    print()

    # Test search parameters
    departure_date = date.today() + timedelta(days=30)
    return_date = departure_date + timedelta(days=7)

    print("Search Parameters:")
    print(f"  Route: TUNIS → GENOA")
    print(f"  Departure: {departure_date}")
    print(f"  Return: {return_date}")
    print(f"  Passengers: 2 adults, 1 child")
    print(f"  Vehicle: 1 car")
    print()

    # Perform search
    print("Searching for ferries...")
    print()

    results = await ferry_service.search_ferries(
        departure_port="TUNIS",
        arrival_port="GENOA",
        departure_date=departure_date,
        return_date=return_date,
        adults=2,
        children=1,
        infants=0,
        vehicles=[{
            "type": "car",
            "length": 4.5,
            "height": 1.8
        }]
    )

    print(f"Found {len(results)} sailings:")
    print()

    for i, result in enumerate(results, 1):
        print(f"{i}. {result.operator} - {result.vessel_name}")
        print(f"   Departure: {result.departure_time.strftime('%Y-%m-%d %H:%M')}")
        print(f"   Arrival: {result.arrival_time.strftime('%Y-%m-%d %H:%M')}")
        print(f"   Prices: Adult €{result.prices['adult']}, Child €{result.prices['child']}, Vehicle €{result.prices['vehicle']}")
        print(f"   Cabins available: {len(result.cabin_types)}")
        print()

    # Test booking if results found
    if results:
        print("Testing booking creation...")
        print()

        # Use first result for test booking
        first_result = results[0]
        operator_code = first_result.operator.lower().replace(" ", "")

        try:
            confirmation = await ferry_service.create_booking(
                operator=operator_code,
                sailing_id=first_result.sailing_id,
                passengers=[
                    {
                        "type": "adult",
                        "first_name": "John",
                        "last_name": "Doe",
                        "date_of_birth": "1980-01-01",
                        "nationality": "US",
                        "passport_number": "123456789"
                    },
                    {
                        "type": "adult",
                        "first_name": "Jane",
                        "last_name": "Doe",
                        "date_of_birth": "1982-05-15",
                        "nationality": "US",
                        "passport_number": "987654321"
                    },
                    {
                        "type": "child",
                        "first_name": "Jimmy",
                        "last_name": "Doe",
                        "date_of_birth": "2015-08-20",
                        "nationality": "US",
                        "passport_number": "456123789"
                    }
                ],
                vehicles=[{
                    "type": "car",
                    "registration": "ABC123",
                    "make": "Toyota",
                    "model": "Camry",
                    "length": 4.5,
                    "height": 1.8
                }],
                contact_info={
                    "email": "john.doe@example.com",
                    "phone": "+1234567890",
                    "address": "123 Main St, City, Country"
                },
                special_requests="Window seats please"
            )

            print("Booking created successfully!")
            print(f"  Booking Reference: {confirmation.booking_reference}")
            print(f"  Operator Reference: {confirmation.operator_reference}")
            print(f"  Status: {confirmation.status}")
            print(f"  Total Amount: €{confirmation.total_amount}")
            print(f"  Currency: {confirmation.currency}")
            print()

            # Test status check
            print("Testing booking status check...")
            status = await ferry_service.get_booking_status(
                operator=operator_code,
                booking_reference=confirmation.operator_reference
            )
            print(f"  Status: {status.get('status')}")
            print()

        except Exception as e:
            print(f"Error during booking test: {e}")
            print()

    # Test health check
    print("Testing operator health checks...")
    print()

    health_status = await ferry_service.health_check()
    for operator, status in health_status.items():
        print(f"  {operator}: {status}")

    print()
    print("=" * 60)
    print("Test completed!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_ferry_search())