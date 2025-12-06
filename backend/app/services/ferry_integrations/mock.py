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
            # Tunis routes
            ("TUNIS", "GENOA"): {"duration_hours": 24, "distance": 520},
            ("TUNIS", "MARSEILLE"): {"duration_hours": 21, "distance": 465},
            ("TUNIS", "CIVITAVECCHIA"): {"duration_hours": 22, "distance": 480},
            ("TUNIS", "PALERMO"): {"duration_hours": 11, "distance": 210},
            ("TUNIS", "NICE"): {"duration_hours": 19, "distance": 440},
            ("TUNIS", "SALERNO"): {"duration_hours": 20, "distance": 450},
            # Reverse Tunis routes
            ("GENOA", "TUNIS"): {"duration_hours": 24, "distance": 520},
            ("MARSEILLE", "TUNIS"): {"duration_hours": 21, "distance": 465},
            ("CIVITAVECCHIA", "TUNIS"): {"duration_hours": 22, "distance": 480},
            ("PALERMO", "TUNIS"): {"duration_hours": 11, "distance": 210},
            ("NICE", "TUNIS"): {"duration_hours": 19, "distance": 440},
            ("SALERNO", "TUNIS"): {"duration_hours": 20, "distance": 450},
            # Zarzis routes (Southern Tunisia - Sicily connection)
            ("ZARZIS", "TRAPANI"): {"duration_hours": 8, "distance": 180},
            ("TRAPANI", "ZARZIS"): {"duration_hours": 8, "distance": 180},
            ("ZARZIS", "PALERMO"): {"duration_hours": 10, "distance": 220},
            ("PALERMO", "ZARZIS"): {"duration_hours": 10, "distance": 220},
            # Sfax routes
            ("SFAX", "TRAPANI"): {"duration_hours": 9, "distance": 200},
            ("TRAPANI", "SFAX"): {"duration_hours": 9, "distance": 200},
            ("SFAX", "PALERMO"): {"duration_hours": 12, "distance": 250},
            ("PALERMO", "SFAX"): {"duration_hours": 12, "distance": 250},
        }

    async def search_ferries(self, search_request: SearchRequest) -> List[FerryResult]:
        """Return mock ferry search results."""
        try:
            logger.info(f"Mock search: {search_request.departure_port} -> {search_request.arrival_port}")

            # Normalize port names to uppercase for lookup
            departure_port = search_request.departure_port.upper()
            arrival_port = search_request.arrival_port.upper()

            # Get route info
            route_key = (departure_port, arrival_port)
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
                # First sailing is always at 19:00 for consistent testing
                if i == 0:
                    departure_hour = 19
                    departure_minute = 0
                else:
                    departure_hour = random.choice([20, 21, 22, 23])
                    departure_minute = random.choice([0, 30])
                departure_dt = datetime.combine(
                    search_request.departure_date,
                    datetime.min.time()
                ).replace(hour=departure_hour, minute=departure_minute)

                # Calculate arrival time
                arrival_dt = departure_dt + timedelta(hours=route_info["duration_hours"])

                # Generate prices (deterministic based on route, date, and operator for consistency)
                # This ensures price alerts can track real changes, not random fluctuations
                route_hash = hash(f"{departure_port}{arrival_port}{self.operator_name}")
                date_hash = hash(search_request.departure_date.isoformat())

                # Base price between 60-120, deterministic per route+operator
                base_price = 60 + (abs(route_hash) % 61)

                # Add small daily variation (±10%) to simulate real price changes
                daily_variation = 0.9 + (abs(date_hash) % 21) / 100  # 0.90 to 1.10
                base_price = round(base_price * daily_variation)

                price_multiplier = 1 + (i * 0.15)  # Later sailings slightly more expensive

                prices = {
                    "adult": round(base_price * price_multiplier, 2),
                    "child": round(base_price * price_multiplier * 0.5, 2),
                    "infant": 0.0,
                    "vehicle": round(100 + (abs(route_hash) % 81), 2)  # 100-180, deterministic
                }

                # Generate cabin options with deterministic prices
                cabin_base = 20 + (abs(route_hash) % 16)  # 20-35 base for interior
                cabin_types = [
                    {
                        "type": "interior",
                        "name": "Interior Cabin",
                        "price": round(cabin_base, 2),
                        "available": 0 if route_key == ("PALERMO", "TUNIS") else 8
                    },
                    {
                        "type": "exterior",
                        "name": "Exterior Cabin",
                        "price": round(cabin_base * 1.7, 2),  # ~35-60
                        "available": 0 if route_key == ("PALERMO", "TUNIS") else 5
                    },
                    {
                        "type": "balcony",
                        "name": "Balcony Cabin",
                        "price": round(cabin_base * 2.5, 2),  # ~50-90
                        "available": 0 if route_key == ("PALERMO", "TUNIS") else 3
                    },
                    {
                        "type": "suite",
                        "name": "Suite",
                        "price": round(cabin_base * 4, 2),  # ~80-140
                        "available": 0 if route_key == ("PALERMO", "TUNIS") else 2
                    },
                    {
                        "type": "deck",
                        "name": "Deck Seat",
                        "price": 0.0,
                        "available": 50
                    }
                ]

                # Set available spaces
                # Normal availability for all routes
                available_spaces = {
                    "passengers": random.randint(50, 200),
                    "vehicles": random.randint(20, 80)
                }

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
                    available_spaces=available_spaces
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
