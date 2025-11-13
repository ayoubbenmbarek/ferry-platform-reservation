"""
Danel Casanova ferry integration.
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


class DanelIntegration(BaseFerryIntegration):
    """Danel Casanova ferry operator integration."""
    
    def __init__(self, api_key: str = "", base_url: str = "https://api.danel.fr"):
        super().__init__(api_key, base_url)
        self.operator_name = "Danel Casanova"
        
        # Danel port mappings
        self.port_mappings = {
            "TUN": "TUNIS",
            "MAR": "MARSEILLE",
            "NIC": "NICE",
            "TOU": "TOULON",
            "GEN": "GENOVA",
            "CIV": "CIVITAVECCHIA"
        }
        
        # Danel vehicle type mappings
        self.vehicle_mappings = {
            "car": "VOITURE",
            "motorcycle": "MOTO",
            "camper": "CAMPING_CAR",
            "truck": "POIDS_LOURD",
            "trailer": "REMORQUE",
            "bus": "AUTOCAR"
        }
        
        # Danel accommodation type mappings
        self.accommodation_mappings = {
            "seat": "SIEGE",
            "couchette": "COUCHETTE",
            "cabin_internal": "CABINE_INTERIEURE",
            "cabin_external": "CABINE_EXTERIEURE",
            "cabin_suite": "SUITE"
        }
    
    async def search_ferries(self, search_request: SearchRequest) -> List[FerryResult]:
        """Search for available Danel ferries."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            # Prepare search parameters for Danel API
            search_payload = {
                "origine": self._standardize_port_code(search_request.departure_port),
                "destination": self._standardize_port_code(search_request.arrival_port),
                "date_aller": search_request.departure_date.strftime("%Y-%m-%d"),
                "passagers": {
                    "adultes": search_request.adults,
                    "enfants": search_request.children,
                    "bebes": search_request.infants
                }
            }
            
            if search_request.return_date:
                search_payload["date_retour"] = search_request.return_date.strftime("%Y-%m-%d")
            
            if search_request.vehicles:
                search_payload["vehicules"] = [
                    {
                        "type": self._standardize_vehicle_type(vehicle.get("type", "car")),
                        "longueur": vehicle.get("length", 4.5),
                        "hauteur": vehicle.get("height", 1.8),
                        "largeur": vehicle.get("width", 1.8),
                        "poids": vehicle.get("weight", 1500)
                    }
                    for vehicle in search_request.vehicles
                ]
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "Maritime-Reservation-API/1.0"
            }
            
            response = await self.session.post(
                f"{self.base_url}/api/v1/recherche-traversees",
                json=search_payload,
                headers=headers
            )
            
            self._handle_api_error(response)
            data = response.json()
            
            results = []
            for traversee in data.get("resultats", []):
                ferry_result = FerryResult(
                    sailing_id=traversee["id"],
                    operator=self.operator_name,
                    departure_port=traversee["port_depart"],
                    arrival_port=traversee["port_arrivee"],
                    departure_time=datetime.fromisoformat(traversee["heure_depart"]),
                    arrival_time=datetime.fromisoformat(traversee["heure_arrivee"]),
                    vessel_name=traversee["navire"],
                    prices={
                        "adult": traversee["tarifs"]["adulte"],
                        "child": traversee["tarifs"]["enfant"],
                        "infant": traversee["tarifs"]["bebe"],
                        "vehicle": traversee["tarifs"].get("vehicule", 0)
                    },
                    cabin_types=[
                        {
                            "type": hebergement["type"],
                            "name": hebergement["nom"],
                            "price": hebergement["prix"],
                            "available": hebergement["disponible"],
                            "capacity": hebergement.get("capacite", 1)
                        }
                        for hebergement in traversee.get("hebergements", [])
                    ],
                    available_spaces={
                        "passengers": traversee.get("places_libres", 0),
                        "vehicles": traversee.get("vehicules_libres", 0)
                    }
                )
                results.append(ferry_result)
            
            return results
            
        except httpx.RequestError as e:
            logger.error(f"Danel API request failed: {e}")
            raise FerryAPIError(f"Failed to search Danel ferries: {e}")
        except Exception as e:
            logger.error(f"Danel search error: {e}")
            raise FerryAPIError(f"Danel search failed: {e}")
    
    async def create_booking(self, booking_request: BookingRequest) -> BookingConfirmation:
        """Create a Danel ferry booking."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            # Prepare booking data for Danel API
            booking_payload = {
                "id_traversee": booking_request.sailing_id,
                "voyageurs": [
                    {
                        "type": passenger.get("type", "adulte"),
                        "civilite": passenger.get("title", "M"),
                        "prenom": passenger["first_name"],
                        "nom": passenger["last_name"],
                        "date_naissance": passenger.get("date_of_birth"),
                        "nationalite": passenger.get("nationality", "FR"),
                        "document": {
                            "type": passenger.get("document_type", "passeport"),
                            "numero": passenger.get("passport_number"),
                            "date_expiration": passenger.get("document_expiry")
                        },
                        "besoins_particuliers": passenger.get("special_needs")
                    }
                    for passenger in booking_request.passengers
                ],
                "coordonnees": {
                    "email": booking_request.contact_info.get("email"),
                    "telephone": booking_request.contact_info.get("phone"),
                    "adresse": {
                        "rue": booking_request.contact_info.get("address"),
                        "ville": booking_request.contact_info.get("city"),
                        "code_postal": booking_request.contact_info.get("postal_code"),
                        "pays": booking_request.contact_info.get("country", "FR")
                    }
                }
            }
            
            if booking_request.vehicles:
                booking_payload["vehicules"] = [
                    {
                        "type": self._standardize_vehicle_type(vehicle.get("type", "car")),
                        "immatriculation": vehicle["registration"],
                        "marque": vehicle.get("make"),
                        "modele": vehicle.get("model"),
                        "couleur": vehicle.get("color"),
                        "dimensions": {
                            "longueur": vehicle.get("length", 4.5),
                            "hauteur": vehicle.get("height", 1.8),
                            "largeur": vehicle.get("width", 1.8),
                            "poids": vehicle.get("weight", 1500)
                        }
                    }
                    for vehicle in booking_request.vehicles
                ]
            
            if booking_request.cabin_selection:
                booking_payload["hebergement"] = {
                    "type": booking_request.cabin_selection.get("type"),
                    "pont": booking_request.cabin_selection.get("deck"),
                    "preferences": booking_request.cabin_selection.get("preferences", [])
                }
            
            if booking_request.special_requests:
                booking_payload["demandes_particulieres"] = booking_request.special_requests
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "Maritime-Reservation-API/1.0"
            }
            
            response = await self.session.post(
                f"{self.base_url}/api/v1/reservations",
                json=booking_payload,
                headers=headers
            )
            
            self._handle_api_error(response)
            data = response.json()
            
            return BookingConfirmation(
                booking_reference=data["numero_dossier"],
                operator_reference=data["reference_danel"],
                status=data["statut"],
                total_amount=data["montant_total"],
                currency=data.get("devise", "EUR"),
                confirmation_details={
                    "numero_confirmation": data.get("numero_confirmation"),
                    "heure_presentation": data.get("heure_presentation"),
                    "heure_embarquement": data.get("heure_embarquement"),
                    "terminal": data.get("terminal"),
                    "documents": data.get("documents", []),
                    "instructions": data.get("instructions_embarquement")
                }
            )
            
        except httpx.RequestError as e:
            logger.error(f"Danel booking request failed: {e}")
            raise FerryAPIError(f"Failed to create Danel booking: {e}")
        except Exception as e:
            logger.error(f"Danel booking error: {e}")
            raise FerryAPIError(f"Danel booking failed: {e}")
    
    async def get_booking_status(self, booking_reference: str) -> Dict[str, Any]:
        """Get Danel booking status."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Accept": "application/json",
                "User-Agent": "Maritime-Reservation-API/1.0"
            }
            
            response = await self.session.get(
                f"{self.base_url}/api/v1/reservations/{booking_reference}",
                headers=headers
            )
            
            self._handle_api_error(response)
            return response.json()
            
        except httpx.RequestError as e:
            logger.error(f"Danel status check failed: {e}")
            raise FerryAPIError(f"Failed to check Danel booking status: {e}")
        except Exception as e:
            logger.error(f"Danel status error: {e}")
            raise FerryAPIError(f"Danel status check failed: {e}")
    
    async def cancel_booking(self, booking_reference: str, reason: Optional[str] = None) -> bool:
        """Cancel Danel booking."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            cancel_payload = {
                "motif_annulation": reason or "Demande client",
                "date_annulation": datetime.now().isoformat()
            }
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "Maritime-Reservation-API/1.0"
            }
            
            response = await self.session.post(
                f"{self.base_url}/api/v1/reservations/{booking_reference}/annulation",
                json=cancel_payload,
                headers=headers
            )
            
            self._handle_api_error(response)
            data = response.json()
            
            return data.get("annulation_confirmee", False)
            
        except httpx.RequestError as e:
            logger.error(f"Danel cancellation failed: {e}")
            raise FerryAPIError(f"Failed to cancel Danel booking: {e}")
        except Exception as e:
            logger.error(f"Danel cancellation error: {e}")
            raise FerryAPIError(f"Danel cancellation failed: {e}")
    
    def _standardize_port_code(self, port_code: str) -> str:
        """Convert standard port codes to Danel format."""
        return self.port_mappings.get(port_code, port_code)
    
    def _standardize_vehicle_type(self, vehicle_type: str) -> str:
        """Convert standard vehicle types to Danel format."""
        return self.vehicle_mappings.get(vehicle_type, vehicle_type)
    
    async def get_crossing_details(self, sailing_id: str) -> Dict[str, Any]:
        """Get detailed information about a specific crossing."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Accept": "application/json",
                "User-Agent": "Maritime-Reservation-API/1.0"
            }
            
            response = await self.session.get(
                f"{self.base_url}/api/v1/traversees/{sailing_id}",
                headers=headers
            )
            
            self._handle_api_error(response)
            return response.json()
            
        except Exception as e:
            logger.error(f"Danel crossing details error: {e}")
            return {}
    
    async def get_vessel_information(self, vessel_name: str) -> Dict[str, Any]:
        """Get vessel information and facilities."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Accept": "application/json",
                "User-Agent": "Maritime-Reservation-API/1.0"
            }
            
            response = await self.session.get(
                f"{self.base_url}/api/v1/navires/{vessel_name}",
                headers=headers
            )
            
            self._handle_api_error(response)
            return response.json()
            
        except Exception as e:
            logger.error(f"Danel vessel information error: {e}")
            return {}
    
    async def get_port_information(self, port_code: str) -> Dict[str, Any]:
        """Get port information and services."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Accept": "application/json",
                "User-Agent": "Maritime-Reservation-API/1.0"
            }
            
            danel_port_code = self._standardize_port_code(port_code)
            response = await self.session.get(
                f"{self.base_url}/api/v1/ports/{danel_port_code}",
                headers=headers
            )
            
            self._handle_api_error(response)
            return response.json()
            
        except Exception as e:
            logger.error(f"Danel port information error: {e}")
            return {}
    
    async def modify_reservation(self, booking_reference: str, modifications: Dict[str, Any]) -> Dict[str, Any]:
        """Modify an existing reservation."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "Maritime-Reservation-API/1.0"
            }
            
            response = await self.session.put(
                f"{self.base_url}/api/v1/reservations/{booking_reference}",
                json=modifications,
                headers=headers
            )
            
            self._handle_api_error(response)
            return response.json()
            
        except Exception as e:
            logger.error(f"Danel reservation modification error: {e}")
            raise FerryAPIError(f"Failed to modify Danel reservation: {e}")
    
    async def get_available_accommodations(self, sailing_id: str) -> List[Dict[str, Any]]:
        """Get available accommodations for a specific sailing."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Accept": "application/json",
                "User-Agent": "Maritime-Reservation-API/1.0"
            }
            
            response = await self.session.get(
                f"{self.base_url}/api/v1/traversees/{sailing_id}/hebergements",
                headers=headers
            )
            
            self._handle_api_error(response)
            data = response.json()
            
            return data.get("hebergements_disponibles", [])
            
        except Exception as e:
            logger.error(f"Danel accommodations error: {e}")
            return [] 