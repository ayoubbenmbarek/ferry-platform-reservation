"""
GNV (Grandi Navi Veloci) ferry integration.
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


class GNVIntegration(BaseFerryIntegration):
    """GNV ferry operator integration."""
    
    def __init__(self, api_key: str = "", base_url: str = "https://api.gnv.it"):
        super().__init__(api_key, base_url)
        self.operator_name = "GNV"
        
        # GNV port mappings
        self.port_mappings = {
            "TUN": "TUNIS",
            "GEN": "GENOVA",
            "CIV": "CIVITAVECCHIA",
            "PAL": "PALERMO",
            "SAL": "SALERNO",
            "MAR": "MARSEILLE",
            "NIC": "NICE",
            "BAR": "BARI",
            "NAP": "NAPOLI"
        }
        
        # GNV vehicle type mappings
        self.vehicle_mappings = {
            "car": "AUTO",
            "motorcycle": "MOTO",
            "camper": "CAMPER",
            "truck": "AUTOCARRO",
            "trailer": "RIMORCHIO"
        }
        
        # GNV cabin type mappings
        self.cabin_mappings = {
            "internal": "INTERNA",
            "external": "ESTERNA",
            "suite": "SUITE",
            "pullman": "PULLMAN"
        }
    
    async def search_ferries(self, search_request: SearchRequest) -> List[FerryResult]:
        """Search for available GNV ferries."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            # Prepare search parameters for GNV API
            search_data = {
                "partenza": self._standardize_port_code(search_request.departure_port),
                "arrivo": self._standardize_port_code(search_request.arrival_port),
                "data_partenza": search_request.departure_date.strftime("%Y-%m-%d"),
                "passeggeri": {
                    "adulti": search_request.adults,
                    "bambini": search_request.children,
                    "neonati": search_request.infants
                }
            }
            
            if search_request.return_date:
                search_data["data_ritorno"] = search_request.return_date.strftime("%Y-%m-%d")
            
            if search_request.vehicles:
                search_data["veicoli"] = [
                    {
                        "tipo": self._standardize_vehicle_type(vehicle.get("type", "car")),
                        "lunghezza": vehicle.get("length", 4.5),
                        "altezza": vehicle.get("height", 1.8),
                        "larghezza": vehicle.get("width", 1.8)
                    }
                    for vehicle in search_request.vehicles
                ]
            
            headers = {
                "Authorization": f"ApiKey {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            
            response = await self.session.post(
                f"{self.base_url}/api/v2/ricerca-traghetti",
                json=search_data,
                headers=headers
            )
            
            self._handle_api_error(response)
            data = response.json()
            
            results = []
            for viaggio in data.get("viaggi", []):
                ferry_result = FerryResult(
                    sailing_id=viaggio["id_viaggio"],
                    operator=self.operator_name,
                    departure_port=viaggio["porto_partenza"],
                    arrival_port=viaggio["porto_arrivo"],
                    departure_time=datetime.fromisoformat(viaggio["orario_partenza"]),
                    arrival_time=datetime.fromisoformat(viaggio["orario_arrivo"]),
                    vessel_name=viaggio["nome_nave"],
                    prices={
                        "adult": viaggio["prezzi"]["adulto"],
                        "child": viaggio["prezzi"]["bambino"],
                        "infant": viaggio["prezzi"]["neonato"],
                        "vehicle": viaggio["prezzi"].get("veicolo", 0)
                    },
                    cabin_types=[
                        {
                            "type": cabin["tipo"],
                            "name": cabin["nome"],
                            "price": cabin["prezzo"],
                            "available": cabin["disponibile"]
                        }
                        for cabin in viaggio.get("cabine", [])
                    ],
                    available_spaces={
                        "passengers": viaggio.get("posti_disponibili", 0),
                        "vehicles": viaggio.get("veicoli_disponibili", 0)
                    }
                )
                results.append(ferry_result)
            
            return results
            
        except httpx.RequestError as e:
            logger.error(f"GNV API request failed: {e}")
            raise FerryAPIError(f"Failed to search GNV ferries: {e}")
        except Exception as e:
            logger.error(f"GNV search error: {e}")
            raise FerryAPIError(f"GNV search failed: {e}")
    
    async def create_booking(self, booking_request: BookingRequest) -> BookingConfirmation:
        """Create a GNV ferry booking."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            # Prepare booking data for GNV API
            prenotazione_data = {
                "id_viaggio": booking_request.sailing_id,
                "passeggeri": [
                    {
                        "tipo": passenger.get("type", "adulto"),
                        "nome": passenger["first_name"],
                        "cognome": passenger["last_name"],
                        "data_nascita": passenger.get("date_of_birth"),
                        "nazionalita": passenger.get("nationality", "IT"),
                        "documento": {
                            "tipo": passenger.get("document_type", "passport"),
                            "numero": passenger.get("passport_number"),
                            "scadenza": passenger.get("document_expiry")
                        },
                        "esigenze_speciali": passenger.get("special_needs")
                    }
                    for passenger in booking_request.passengers
                ],
                "contatto": {
                    "email": booking_request.contact_info.get("email"),
                    "telefono": booking_request.contact_info.get("phone"),
                    "indirizzo": booking_request.contact_info.get("address")
                }
            }
            
            if booking_request.vehicles:
                prenotazione_data["veicoli"] = [
                    {
                        "tipo": self._standardize_vehicle_type(vehicle.get("type", "car")),
                        "targa": vehicle["registration"],
                        "marca": vehicle.get("make"),
                        "modello": vehicle.get("model"),
                        "dimensioni": {
                            "lunghezza": vehicle.get("length", 4.5),
                            "altezza": vehicle.get("height", 1.8),
                            "larghezza": vehicle.get("width", 1.8)
                        }
                    }
                    for vehicle in booking_request.vehicles
                ]
            
            if booking_request.cabin_selection:
                prenotazione_data["cabina"] = {
                    "tipo": booking_request.cabin_selection.get("type"),
                    "ponte": booking_request.cabin_selection.get("deck"),
                    "preferenze": booking_request.cabin_selection.get("preferences", [])
                }
            
            if booking_request.special_requests:
                prenotazione_data["richieste_speciali"] = booking_request.special_requests
            
            headers = {
                "Authorization": f"ApiKey {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            
            response = await self.session.post(
                f"{self.base_url}/api/v2/prenotazioni",
                json=prenotazione_data,
                headers=headers
            )
            
            self._handle_api_error(response)
            data = response.json()
            
            return BookingConfirmation(
                booking_reference=data["codice_prenotazione"],
                operator_reference=data["riferimento_gnv"],
                status=data["stato"],
                total_amount=data["importo_totale"],
                currency=data.get("valuta", "EUR"),
                confirmation_details={
                    "numero_conferma": data.get("numero_conferma"),
                    "orario_check_in": data.get("orario_check_in"),
                    "orario_imbarco": data.get("orario_imbarco"),
                    "info_terminal": data.get("info_terminal"),
                    "biglietti_elettronici": data.get("biglietti_elettronici", [])
                }
            )
            
        except httpx.RequestError as e:
            logger.error(f"GNV booking request failed: {e}")
            raise FerryAPIError(f"Failed to create GNV booking: {e}")
        except Exception as e:
            logger.error(f"GNV booking error: {e}")
            raise FerryAPIError(f"GNV booking failed: {e}")
    
    async def get_booking_status(self, booking_reference: str) -> Dict[str, Any]:
        """Get GNV booking status."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "Authorization": f"ApiKey {self.api_key}",
                "Accept": "application/json"
            }
            
            response = await self.session.get(
                f"{self.base_url}/api/v2/prenotazioni/{booking_reference}",
                headers=headers
            )
            
            self._handle_api_error(response)
            return response.json()
            
        except httpx.RequestError as e:
            logger.error(f"GNV status check failed: {e}")
            raise FerryAPIError(f"Failed to check GNV booking status: {e}")
        except Exception as e:
            logger.error(f"GNV status error: {e}")
            raise FerryAPIError(f"GNV status check failed: {e}")
    
    async def cancel_booking(self, booking_reference: str, reason: Optional[str] = None) -> bool:
        """Cancel GNV booking."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            cancel_data = {"motivo": reason} if reason else {}
            
            headers = {
                "Authorization": f"ApiKey {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            
            response = await self.session.delete(
                f"{self.base_url}/api/v2/prenotazioni/{booking_reference}",
                json=cancel_data,
                headers=headers
            )
            
            self._handle_api_error(response)
            data = response.json()
            
            return data.get("cancellato", False)
            
        except httpx.RequestError as e:
            logger.error(f"GNV cancellation failed: {e}")
            raise FerryAPIError(f"Failed to cancel GNV booking: {e}")
        except Exception as e:
            logger.error(f"GNV cancellation error: {e}")
            raise FerryAPIError(f"GNV cancellation failed: {e}")
    
    def _standardize_port_code(self, port_code: str) -> str:
        """Convert standard port codes to GNV format."""
        return self.port_mappings.get(port_code, port_code)
    
    def _standardize_vehicle_type(self, vehicle_type: str) -> str:
        """Convert standard vehicle types to GNV format."""
        return self.vehicle_mappings.get(vehicle_type, vehicle_type)
    
    async def get_cabin_availability(self, sailing_id: str) -> List[Dict[str, Any]]:
        """Get available cabins for a specific sailing."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "Authorization": f"ApiKey {self.api_key}",
                "Accept": "application/json"
            }
            
            response = await self.session.get(
                f"{self.base_url}/api/v2/viaggi/{sailing_id}/cabine",
                headers=headers
            )
            
            self._handle_api_error(response)
            data = response.json()
            
            return data.get("cabine_disponibili", [])
            
        except Exception as e:
            logger.error(f"GNV cabin availability error: {e}")
            return []
    
    async def get_vessel_amenities(self, vessel_name: str) -> Dict[str, Any]:
        """Get vessel amenities and services."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "Authorization": f"ApiKey {self.api_key}",
                "Accept": "application/json"
            }
            
            response = await self.session.get(
                f"{self.base_url}/api/v2/navi/{vessel_name}/servizi",
                headers=headers
            )
            
            self._handle_api_error(response)
            return response.json()
            
        except Exception as e:
            logger.error(f"GNV vessel amenities error: {e}")
            return {}
    
    async def get_port_info(self, port_code: str) -> Dict[str, Any]:
        """Get port information and facilities."""
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            headers = {
                "Authorization": f"ApiKey {self.api_key}",
                "Accept": "application/json"
            }
            
            gnv_port_code = self._standardize_port_code(port_code)
            response = await self.session.get(
                f"{self.base_url}/api/v2/porti/{gnv_port_code}",
                headers=headers
            )
            
            self._handle_api_error(response)
            return response.json()
            
        except Exception as e:
            logger.error(f"GNV port info error: {e}")
            return {} 