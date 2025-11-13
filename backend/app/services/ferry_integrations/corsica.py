"""
Corsica Lines ferry integration.
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


class CorsicaIntegration(BaseFerryIntegration):
    """Corsica Lines ferry operator integration."""
    
    def __init__(self, api_key: str = "", base_url: str = "https://api.corsica-linea.com"):
        super().__init__(api_key, base_url)
        self.operator_name = "Corsica Lines"
        
        # Corsica Lines port mappings
        self.port_mappings = {
            "TUN": "TUNIS",
            "MAR": "MARSEILLE",
            "NIC": "NICE",
            "TOU": "TOULON",
            "AJA": "AJACCIO",
            "BAS": "BASTIA",
            "ILE": "ILE_ROUSSE",
            "POR": "PORTO_VECCHIO"
        }
        
        # Corsica Lines vehicle type mappings
        self.vehicle_mappings = {
            "car": "VOITURE",
            "motorcycle": "MOTO",
            "camper": "CAMPING_CAR",
            "truck": "CAMION",
            "trailer": "REMORQUE"
        }
        
        # Corsica Lines cabin type mappings
        self.cabin_mappings = {
            "pullman": "PULLMAN",
            "internal": "CABINE_INTERIEURE",
            "external": "CABINE_EXTERIEURE",
            "suite": "SUITE"
        }
    
    async def search_ferries(self, search_request: SearchRequest) -> List[FerryResult]:
        """Search for available Corsica Lines ferries."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            # Prepare search parameters for Corsica Lines API
            search_params = {
                "port_depart": self._standardize_port_code(search_request.departure_port),
                "port_arrivee": self._standardize_port_code(search_request.arrival_port),
                "date_depart": search_request.departure_date.strftime("%d/%m/%Y"),
                "nb_adultes": search_request.adults,
                "nb_enfants": search_request.children,
                "nb_bebes": search_request.infants
            }
            
            if search_request.return_date:
                search_params["date_retour"] = search_request.return_date.strftime("%d/%m/%Y")
            
            if search_request.vehicles:
                search_params["vehicules"] = [
                    {
                        "type": self._standardize_vehicle_type(vehicle.get("type", "car")),
                        "longueur": vehicle.get("length", 4.5),
                        "hauteur": vehicle.get("height", 1.8),
                        "largeur": vehicle.get("width", 1.8)
                    }
                    for vehicle in search_request.vehicles
                ]
            
            headers = {
                "X-API-Key": self.api_key,
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            
            response = await self.session.get(
                f"{self.base_url}/api/v1/recherche",
                params=search_params,
                headers=headers
            )
            
            self._handle_api_error(response)
            data = response.json()
            
            results = []
            for traversee in data.get("traversees", []):
                ferry_result = FerryResult(
                    sailing_id=traversee["id_traversee"],
                    operator=self.operator_name,
                    departure_port=traversee["port_depart"],
                    arrival_port=traversee["port_arrivee"],
                    departure_time=datetime.strptime(
                        f"{traversee['date_depart']} {traversee['heure_depart']}", 
                        "%d/%m/%Y %H:%M"
                    ),
                    arrival_time=datetime.strptime(
                        f"{traversee['date_arrivee']} {traversee['heure_arrivee']}", 
                        "%d/%m/%Y %H:%M"
                    ),
                    vessel_name=traversee["nom_navire"],
                    prices={
                        "adult": traversee["tarifs"]["adulte"],
                        "child": traversee["tarifs"]["enfant"],
                        "infant": traversee["tarifs"]["bebe"],
                        "vehicle": traversee["tarifs"].get("vehicule", 0)
                    },
                    cabin_types=[
                        {
                            "type": cabine["type"],
                            "name": cabine["nom"],
                            "price": cabine["tarif"],
                            "available": cabine["disponible"]
                        }
                        for cabine in traversee.get("cabines", [])
                    ],
                    available_spaces={
                        "passengers": traversee.get("places_disponibles", 0),
                        "vehicles": traversee.get("vehicules_disponibles", 0)
                    }
                )
                results.append(ferry_result)
            
            return results
            
        except httpx.RequestError as e:
            logger.error(f"Corsica Lines API request failed: {e}")
            raise FerryAPIError(f"Failed to search Corsica Lines ferries: {e}")
        except Exception as e:
            logger.error(f"Corsica Lines search error: {e}")
            raise FerryAPIError(f"Corsica Lines search failed: {e}")
    
    async def create_booking(self, booking_request: BookingRequest) -> BookingConfirmation:
        """Create a Corsica Lines ferry booking."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            # Prepare booking data for Corsica Lines API
            reservation_data = {
                "id_traversee": booking_request.sailing_id,
                "passagers": [
                    {
                        "type": passenger.get("type", "adulte"),
                        "prenom": passenger["first_name"],
                        "nom": passenger["last_name"],
                        "date_naissance": passenger.get("date_of_birth"),
                        "nationalite": passenger.get("nationality", "FR"),
                        "piece_identite": {
                            "type": passenger.get("document_type", "passeport"),
                            "numero": passenger.get("passport_number"),
                            "date_expiration": passenger.get("document_expiry")
                        },
                        "besoins_speciaux": passenger.get("special_needs")
                    }
                    for passenger in booking_request.passengers
                ],
                "contact": {
                    "email": booking_request.contact_info.get("email"),
                    "telephone": booking_request.contact_info.get("phone"),
                    "adresse": booking_request.contact_info.get("address")
                }
            }
            
            if booking_request.vehicles:
                reservation_data["vehicules"] = [
                    {
                        "type": self._standardize_vehicle_type(vehicle.get("type", "car")),
                        "immatriculation": vehicle["registration"],
                        "marque": vehicle.get("make"),
                        "modele": vehicle.get("model"),
                        "dimensions": {
                            "longueur": vehicle.get("length", 4.5),
                            "hauteur": vehicle.get("height", 1.8),
                            "largeur": vehicle.get("width", 1.8)
                        }
                    }
                    for vehicle in booking_request.vehicles
                ]
            
            if booking_request.cabin_selection:
                reservation_data["cabine"] = {
                    "type": booking_request.cabin_selection.get("type"),
                    "pont": booking_request.cabin_selection.get("deck"),
                    "preferences": booking_request.cabin_selection.get("preferences", [])
                }
            
            if booking_request.special_requests:
                reservation_data["demandes_speciales"] = booking_request.special_requests
            
            headers = {
                "X-API-Key": self.api_key,
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            
            response = await self.session.post(
                f"{self.base_url}/api/v1/reservations",
                json=reservation_data,
                headers=headers
            )
            
            self._handle_api_error(response)
            data = response.json()
            
            return BookingConfirmation(
                booking_reference=data["numero_reservation"],
                operator_reference=data["reference_corsica"],
                status=data["statut"],
                total_amount=data["montant_total"],
                currency=data.get("devise", "EUR"),
                confirmation_details={
                    "numero_confirmation": data.get("numero_confirmation"),
                    "heure_enregistrement": data.get("heure_enregistrement"),
                    "heure_embarquement": data.get("heure_embarquement"),
                    "informations_terminal": data.get("informations_terminal"),
                    "billets_electroniques": data.get("billets_electroniques", [])
                }
            )
            
        except httpx.RequestError as e:
            logger.error(f"Corsica Lines booking request failed: {e}")
            raise FerryAPIError(f"Failed to create Corsica Lines booking: {e}")
        except Exception as e:
            logger.error(f"Corsica Lines booking error: {e}")
            raise FerryAPIError(f"Corsica Lines booking failed: {e}")
    
    async def get_booking_status(self, booking_reference: str) -> Dict[str, Any]:
        """Get Corsica Lines booking status."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "X-API-Key": self.api_key,
                "Accept": "application/json"
            }
            
            response = await self.session.get(
                f"{self.base_url}/api/v1/reservations/{booking_reference}",
                headers=headers
            )
            
            self._handle_api_error(response)
            return response.json()
            
        except httpx.RequestError as e:
            logger.error(f"Corsica Lines status check failed: {e}")
            raise FerryAPIError(f"Failed to check Corsica Lines booking status: {e}")
        except Exception as e:
            logger.error(f"Corsica Lines status error: {e}")
            raise FerryAPIError(f"Corsica Lines status check failed: {e}")
    
    async def cancel_booking(self, booking_reference: str, reason: Optional[str] = None) -> bool:
        """Cancel Corsica Lines booking."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            cancel_data = {"motif": reason} if reason else {}
            
            headers = {
                "X-API-Key": self.api_key,
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            
            response = await self.session.put(
                f"{self.base_url}/api/v1/reservations/{booking_reference}/annulation",
                json=cancel_data,
                headers=headers
            )
            
            self._handle_api_error(response)
            data = response.json()
            
            return data.get("annule", False)
            
        except httpx.RequestError as e:
            logger.error(f"Corsica Lines cancellation failed: {e}")
            raise FerryAPIError(f"Failed to cancel Corsica Lines booking: {e}")
        except Exception as e:
            logger.error(f"Corsica Lines cancellation error: {e}")
            raise FerryAPIError(f"Corsica Lines cancellation failed: {e}")
    
    def _standardize_port_code(self, port_code: str) -> str:
        """Convert standard port codes to Corsica Lines format."""
        return self.port_mappings.get(port_code, port_code)
    
    def _standardize_vehicle_type(self, vehicle_type: str) -> str:
        """Convert standard vehicle types to Corsica Lines format."""
        return self.vehicle_mappings.get(vehicle_type, vehicle_type)
    
    async def get_schedule(self, departure_port: str, arrival_port: str, date_range: int = 7) -> List[Dict[str, Any]]:
        """Get ferry schedule for a route over a date range."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "X-API-Key": self.api_key,
                "Accept": "application/json"
            }
            
            params = {
                "port_depart": self._standardize_port_code(departure_port),
                "port_arrivee": self._standardize_port_code(arrival_port),
                "nb_jours": date_range
            }
            
            response = await self.session.get(
                f"{self.base_url}/api/v1/horaires",
                params=params,
                headers=headers
            )
            
            self._handle_api_error(response)
            data = response.json()
            
            return data.get("horaires", [])
            
        except Exception as e:
            logger.error(f"Corsica Lines schedule error: {e}")
            return []
    
    async def get_vessel_deck_plan(self, vessel_name: str) -> Dict[str, Any]:
        """Get vessel deck plan and cabin layout."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "X-API-Key": self.api_key,
                "Accept": "application/json"
            }
            
            response = await self.session.get(
                f"{self.base_url}/api/v1/navires/{vessel_name}/plan",
                headers=headers
            )
            
            self._handle_api_error(response)
            return response.json()
            
        except Exception as e:
            logger.error(f"Corsica Lines deck plan error: {e}")
            return {}
    
    async def get_port_facilities(self, port_code: str) -> Dict[str, Any]:
        """Get port facilities and services."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "X-API-Key": self.api_key,
                "Accept": "application/json"
            }
            
            corsica_port_code = self._standardize_port_code(port_code)
            response = await self.session.get(
                f"{self.base_url}/api/v1/ports/{corsica_port_code}/services",
                headers=headers
            )
            
            self._handle_api_error(response)
            return response.json()
            
        except Exception as e:
            logger.error(f"Corsica Lines port facilities error: {e}")
            return {}
    
    async def modify_booking(self, booking_reference: str, modifications: Dict[str, Any]) -> Dict[str, Any]:
        """Modify an existing booking."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "X-API-Key": self.api_key,
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            
            response = await self.session.put(
                f"{self.base_url}/api/v1/reservations/{booking_reference}",
                json=modifications,
                headers=headers
            )
            
            self._handle_api_error(response)
            return response.json()
            
        except Exception as e:
            logger.error(f"Corsica Lines booking modification error: {e}")
            raise FerryAPIError(f"Failed to modify Corsica Lines booking: {e}") 