"""
CTN (Compagnie Tunisienne de Navigation) ferry integration.
"""

import logging
from typing import List, Dict, Optional, Any
from datetime import datetime, date
import httpx

from .base import (
    BaseFerryIntegration,
    SearchRequest,
    FerryResult,
    BookingRequest,
    BookingConfirmation,
    FerryAPIError
)

logger = logging.getLogger(__name__)


class CTNIntegration(BaseFerryIntegration):
    """CTN ferry operator integration."""
    
    def __init__(self, api_key: str = "", base_url: str = "https://api.ctn.com.tn"):
        super().__init__(api_key, base_url)
        self.operator_name = "CTN"
        
        # CTN port mappings
        self.port_mappings = {
            "TUN": "TUNIS",
            "GEN": "GENOVA",
            "CIV": "CIVITAVECCHIA",
            "PAL": "PALERMO",
            "SAL": "SALERNO",
            "MAR": "MARSEILLE",
            "NIC": "NICE"
        }
        
        # CTN vehicle type mappings
        self.vehicle_mappings = {
            "car": "VOITURE",
            "motorcycle": "MOTO",
            "camper": "CAMPING_CAR",
            "truck": "CAMION"
        }
    
    async def search_ferries(self, search_request: SearchRequest) -> List[FerryResult]:
        """Search for available CTN ferries."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            # Prepare search parameters
            params = {
                "departure_port": self._standardize_port_code(search_request.departure_port),
                "arrival_port": self._standardize_port_code(search_request.arrival_port),
                "departure_date": search_request.departure_date.isoformat(),
                "adults": search_request.adults,
                "children": search_request.children,
                "infants": search_request.infants
            }
            
            if search_request.return_date:
                params["return_date"] = search_request.return_date.isoformat()
            
            if search_request.vehicles:
                params["vehicles"] = [
                    {
                        "type": self._standardize_vehicle_type(vehicle.get("type", "car")),
                        "length": vehicle.get("length", 4.5),
                        "height": vehicle.get("height", 1.8)
                    }
                    for vehicle in search_request.vehicles
                ]
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            response = await self.session.post(
                f"{self.base_url}/api/v1/search",
                json=params,
                headers=headers
            )
            
            self._handle_api_error(response)
            data = response.json()
            
            results = []
            for sailing in data.get("sailings", []):
                ferry_result = FerryResult(
                    sailing_id=sailing["id"],
                    operator=self.operator_name,
                    departure_port=sailing["departure_port"],
                    arrival_port=sailing["arrival_port"],
                    departure_time=datetime.fromisoformat(sailing["departure_time"]),
                    arrival_time=datetime.fromisoformat(sailing["arrival_time"]),
                    vessel_name=sailing["vessel_name"],
                    prices={
                        "adult": sailing["prices"]["adult"],
                        "child": sailing["prices"]["child"],
                        "infant": sailing["prices"]["infant"],
                        "vehicle": sailing["prices"].get("vehicle", 0)
                    },
                    cabin_types=sailing.get("cabin_types", []),
                    available_spaces=sailing.get("available_spaces", {})
                )
                results.append(ferry_result)
            
            return results
            
        except httpx.RequestError as e:
            logger.error(f"CTN API request failed: {e}")
            raise FerryAPIError(f"Failed to search CTN ferries: {e}")
        except Exception as e:
            logger.error(f"CTN search error: {e}")
            raise FerryAPIError(f"CTN search failed: {e}")
    
    async def create_booking(self, booking_request: BookingRequest) -> BookingConfirmation:
        """Create a CTN ferry booking."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            # Prepare booking data
            booking_data = {
                "sailing_id": booking_request.sailing_id,
                "passengers": [
                    {
                        "type": passenger.get("type", "adult"),
                        "first_name": passenger["first_name"],
                        "last_name": passenger["last_name"],
                        "date_of_birth": passenger.get("date_of_birth"),
                        "nationality": passenger.get("nationality", "TN"),
                        "passport_number": passenger.get("passport_number"),
                        "special_needs": passenger.get("special_needs")
                    }
                    for passenger in booking_request.passengers
                ],
                "contact": {
                    "email": booking_request.contact_info.get("email"),
                    "phone": booking_request.contact_info.get("phone"),
                    "address": booking_request.contact_info.get("address")
                }
            }
            
            if booking_request.vehicles:
                booking_data["vehicles"] = [
                    {
                        "type": self._standardize_vehicle_type(vehicle.get("type", "car")),
                        "registration": vehicle["registration"],
                        "make": vehicle.get("make"),
                        "model": vehicle.get("model"),
                        "length": vehicle.get("length", 4.5),
                        "height": vehicle.get("height", 1.8)
                    }
                    for vehicle in booking_request.vehicles
                ]
            
            if booking_request.cabin_selection:
                booking_data["cabin"] = {
                    "type": booking_request.cabin_selection.get("type"),
                    "deck": booking_request.cabin_selection.get("deck"),
                    "preferences": booking_request.cabin_selection.get("preferences", [])
                }
            
            if booking_request.special_requests:
                booking_data["special_requests"] = booking_request.special_requests
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            response = await self.session.post(
                f"{self.base_url}/api/v1/bookings",
                json=booking_data,
                headers=headers
            )
            
            self._handle_api_error(response)
            data = response.json()
            
            return BookingConfirmation(
                booking_reference=data["booking_reference"],
                operator_reference=data["ctn_reference"],
                status=data["status"],
                total_amount=data["total_amount"],
                currency=data.get("currency", "EUR"),
                confirmation_details={
                    "confirmation_number": data.get("confirmation_number"),
                    "check_in_time": data.get("check_in_time"),
                    "boarding_time": data.get("boarding_time"),
                    "terminal_info": data.get("terminal_info")
                }
            )
            
        except httpx.RequestError as e:
            logger.error(f"CTN booking request failed: {e}")
            raise FerryAPIError(f"Failed to create CTN booking: {e}")
        except Exception as e:
            logger.error(f"CTN booking error: {e}")
            raise FerryAPIError(f"CTN booking failed: {e}")
    
    async def get_booking_status(self, booking_reference: str) -> Dict[str, Any]:
        """Get CTN booking status."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            response = await self.session.get(
                f"{self.base_url}/api/v1/bookings/{booking_reference}",
                headers=headers
            )
            
            self._handle_api_error(response)
            return response.json()
            
        except httpx.RequestError as e:
            logger.error(f"CTN status check failed: {e}")
            raise FerryAPIError(f"Failed to check CTN booking status: {e}")
        except Exception as e:
            logger.error(f"CTN status error: {e}")
            raise FerryAPIError(f"CTN status check failed: {e}")
    
    async def cancel_booking(self, booking_reference: str, reason: Optional[str] = None) -> bool:
        """Cancel CTN booking."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            cancel_data = {"reason": reason} if reason else {}
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            response = await self.session.delete(
                f"{self.base_url}/api/v1/bookings/{booking_reference}",
                json=cancel_data,
                headers=headers
            )
            
            self._handle_api_error(response)
            data = response.json()
            
            return data.get("cancelled", False)
            
        except httpx.RequestError as e:
            logger.error(f"CTN cancellation failed: {e}")
            raise FerryAPIError(f"Failed to cancel CTN booking: {e}")
        except Exception as e:
            logger.error(f"CTN cancellation error: {e}")
            raise FerryAPIError(f"CTN cancellation failed: {e}")
    
    def _standardize_port_code(self, port_code: str) -> str:
        """Convert standard port codes to CTN format."""
        return self.port_mappings.get(port_code, port_code)
    
    def _standardize_vehicle_type(self, vehicle_type: str) -> str:
        """Convert standard vehicle types to CTN format."""
        return self.vehicle_mappings.get(vehicle_type, vehicle_type)
    
    async def get_route_info(self, departure_port: str, arrival_port: str) -> Dict[str, Any]:
        """Get route information including duration and distance."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            params = {
                "departure": self._standardize_port_code(departure_port),
                "arrival": self._standardize_port_code(arrival_port)
            }
            
            response = await self.session.get(
                f"{self.base_url}/api/v1/routes",
                params=params,
                headers=headers
            )
            
            self._handle_api_error(response)
            return response.json()
            
        except Exception as e:
            logger.error(f"CTN route info error: {e}")
            return {}
    
    async def get_vessel_info(self, vessel_name: str) -> Dict[str, Any]:
        """Get vessel information and amenities."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            response = await self.session.get(
                f"{self.base_url}/api/v1/vessels/{vessel_name}",
                headers=headers
            )
            
            self._handle_api_error(response)
            return response.json()
            
        except Exception as e:
            logger.error(f"CTN vessel info error: {e}")
            return {} 