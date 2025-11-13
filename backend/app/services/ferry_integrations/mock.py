"""
Mock ferry integration for development and testing.
Returns realistic dummy data without calling real APIs.
"""

import logging
from typing import List, Dict, Optional, Any
from datetime import datetime, date, timedelta
import random

from .base import (
    BaseFerryIntegration,
    SearchRequest,
    FerryResult,
    BookingRequest,
    BookingConfirmation,
    FerryAPIError
)

logger = logging.getLogger(__name__)


class MockFerryIntegration(BaseFerryIntegration):
    """Mock ferry operator for development and testing."""

    def __init__(self, operator_name: str = "Mock Ferry", api_key: str = "", base_url: str = ""):
        super().__init__(api_key, base_url)
        self.operator_name = operator_name

        # Mock vessel names
        self.vessels = {
            "CTN": ["Carthage", "Habib", "Tanit"],
            "GNV": ["La Superba", "La Suprema", "Azzurra"],
            "Corsica Lines": ["Piana", "Vizzavona", "Pascal Paoli"],
            "Danel": ["Danielle Casanova", "Monte d'Oro"]
        }

        # Mock routes with typical durations
        self.routes = {
            ("TUNIS", "GENOA"): {"duration_hours": 24, "distance": 520},
            ("TUNIS", "MARSEILLE"): {"duration_hours": 21, "distance": 465},
            ("TUNIS", "CIVITAVECCHIA"): {"duration_hours": 22, "distance": 480},
            ("TUNIS", "PALERMO"): {"duration_hours": 11, "distance": 210},
            ("TUNIS", "NICE"): {"duration_hours": 19, "distance": 440},
            # Reverse routes
            ("GENOA", "TUNIS"): {"duration_hours": 24, "distance": 520},
            ("MARSEILLE", "TUNIS"): {"duration_hours": 21, "distance": 465},
            ("CIVITAVECCHIA", "TUNIS"): {"duration_hours": 22, "distance": 480},
            ("PALERMO", "TUNIS"): {"duration_hours": 11, "distance": 210},
            ("NICE", "TUNIS"): {"duration_hours": 19, "distance": 440},
        }

    async def search_ferries(self, search_request: SearchRequest) -> List[FerryResult]:
        """Return mock ferry search results."""
        try:
            logger.info(f"Mock search: {search_request.departure_port} -> {search_request.arrival_port}")

            # Get route info
            route_key = (search_request.departure_port, search_request.arrival_port)
            route_info = self.routes.get(route_key)

            if not route_info:
                logger.warning(f"No mock route found for {route_key}")
                return []

            # Generate 2-3 mock sailings
            results = []
            num_sailings = random.randint(2, 3)

            vessels = self.vessels.get(self.operator_name, ["Generic Ferry"])

            for i in range(num_sailings):
                # Generate departure time (typically evening sailings)
                departure_hour = random.choice([19, 20, 21, 22, 23])
                departure_dt = datetime.combine(
                    search_request.departure_date,
                    datetime.min.time()
                ).replace(hour=departure_hour, minute=random.choice([0, 30]))

                # Calculate arrival time
                arrival_dt = departure_dt + timedelta(hours=route_info["duration_hours"])

                # Generate prices (vary by sailing)
                base_price = random.randint(60, 120)
                price_multiplier = 1 + (i * 0.15)  # Later sailings slightly cheaper

                prices = {
                    "adult": round(base_price * price_multiplier, 2),
                    "child": round(base_price * price_multiplier * 0.5, 2),
                    "infant": 0.0,
                    "vehicle": round(random.randint(100, 180), 2)
                }

                # Generate cabin options
                cabin_types = [
                    {
                        "type": "interior",
                        "name": "Interior Cabin",
                        "price": round(random.uniform(20, 35), 2),
                        "available": random.randint(3, 15)
                    },
                    {
                        "type": "exterior",
                        "name": "Exterior Cabin",
                        "price": round(random.uniform(35, 55), 2),
                        "available": random.randint(2, 10)
                    },
                    {
                        "type": "suite",
                        "name": "Suite",
                        "price": round(random.uniform(80, 150), 2),
                        "available": random.randint(1, 5)
                    },
                    {
                        "type": "deck",
                        "name": "Deck Seat",
                        "price": 0.0,
                        "available": random.randint(20, 50)
                    }
                ]

                # Create ferry result
                ferry_result = FerryResult(
                    sailing_id=f"{self.operator_name.upper().replace(' ', '_')}_{departure_dt.strftime('%Y%m%d_%H%M')}_{i+1}",
                    operator=self.operator_name,
                    departure_port=search_request.departure_port,
                    arrival_port=search_request.arrival_port,
                    departure_time=departure_dt,
                    arrival_time=arrival_dt,
                    vessel_name=random.choice(vessels),
                    prices=prices,
                    cabin_types=cabin_types,
                    available_spaces={
                        "passengers": random.randint(50, 200),
                        "vehicles": random.randint(20, 80)
                    }
                )

                results.append(ferry_result)

            logger.info(f"Mock search returned {len(results)} results")
            return results

        except Exception as e:
            logger.error(f"Mock search error: {e}")
            raise FerryAPIError(f"Mock search failed: {e}")

    async def create_booking(self, booking_request: BookingRequest) -> BookingConfirmation:
        """Create a mock ferry booking."""
        try:
            logger.info(f"Mock booking for sailing: {booking_request.sailing_id}")

            # Generate mock booking reference
            booking_ref = f"MOCK{random.randint(100000, 999999)}"
            operator_ref = f"{self.operator_name.upper().replace(' ', '')}REF{random.randint(10000, 99999)}"

            # Calculate mock total (simplified)
            num_adults = sum(1 for p in booking_request.passengers if p.get("type") == "adult")
            num_children = sum(1 for p in booking_request.passengers if p.get("type") == "child")
            num_vehicles = len(booking_request.vehicles) if booking_request.vehicles else 0

            total_amount = (num_adults * 85) + (num_children * 42.5) + (num_vehicles * 120)

            if booking_request.cabin_selection:
                total_amount += random.randint(25, 100)  # Cabin supplement

            return BookingConfirmation(
                booking_reference=booking_ref,
                operator_reference=operator_ref,
                status="confirmed",
                total_amount=round(total_amount, 2),
                currency="EUR",
                confirmation_details={
                    "confirmation_number": f"CONF{random.randint(100000, 999999)}",
                    "check_in_time": "2 hours before departure",
                    "boarding_time": "30 minutes before departure",
                    "terminal_info": "Terminal A, Gate 3",
                    "cancellation_policy": "Free cancellation up to 48 hours before departure",
                    "mock_notice": "This is a mock booking for development purposes"
                }
            )

        except Exception as e:
            logger.error(f"Mock booking error: {e}")
            raise FerryAPIError(f"Mock booking failed: {e}")

    async def get_booking_status(self, booking_reference: str) -> Dict[str, Any]:
        """Get mock booking status."""
        try:
            logger.info(f"Mock status check for: {booking_reference}")

            return {
                "booking_reference": booking_reference,
                "status": "confirmed",
                "operator": self.operator_name,
                "created_at": datetime.now().isoformat(),
                "departure_date": (datetime.now() + timedelta(days=30)).isoformat(),
                "passengers": random.randint(1, 4),
                "vehicles": random.randint(0, 1),
                "total_amount": round(random.uniform(200, 500), 2),
                "currency": "EUR",
                "payment_status": "paid",
                "mock_notice": "This is a mock booking status"
            }

        except Exception as e:
            logger.error(f"Mock status check error: {e}")
            raise FerryAPIError(f"Mock status check failed: {e}")

    async def cancel_booking(self, booking_reference: str, reason: Optional[str] = None) -> bool:
        """Cancel mock booking."""
        try:
            logger.info(f"Mock cancellation for: {booking_reference}, reason: {reason}")

            # Simulate 90% success rate
            success = random.random() > 0.1

            if not success:
                raise FerryAPIError("Mock cancellation failed (simulated)")

            return True

        except FerryAPIError:
            raise
        except Exception as e:
            logger.error(f"Mock cancellation error: {e}")
            raise FerryAPIError(f"Mock cancellation failed: {e}")

    async def health_check(self) -> bool:
        """Mock health check (always healthy)."""
        return True


def create_mock_integrations() -> Dict[str, BaseFerryIntegration]:
    """Create mock integrations for all operators."""
    return {
        "ctn": MockFerryIntegration(operator_name="CTN"),
        "gnv": MockFerryIntegration(operator_name="GNV"),
        "corsica": MockFerryIntegration(operator_name="Corsica Lines"),
        "danel": MockFerryIntegration(operator_name="Danel")
    }
