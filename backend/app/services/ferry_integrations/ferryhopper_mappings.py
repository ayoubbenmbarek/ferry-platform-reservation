"""
FerryHopper port, vehicle, and accommodation mapping service.
Handles code translation between VoilaFerry and FerryHopper systems.
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import asyncio

logger = logging.getLogger(__name__)


# VoilaFerry port code -> FerryHopper port code mapping
# This translates VoilaFerry's internal codes to FerryHopper API codes
VOILAFERRY_TO_FERRYHOPPER_PORT_MAP = {
    # Tunisia
    "TUN": "TUN",       # Tunis
    "LGO": "TUN",       # La Goulette -> maps to Tunis (same port area)
    "ZAR": "TNZRZ",     # Zarzis
    # NOTE: Sfax (SFA) is NOT available in FerryHopper

    # Italy
    "GOA": "GOA",       # Genoa
    "GEN": "GOA",       # Genoa alternate code
    "CVV": "CIV",       # Civitavecchia -> FerryHopper uses CIV
    "CIV": "CIV",       # Civitavecchia
    "PMO": "PLE",       # Palermo -> FerryHopper uses PLE
    "PAL": "PLE",       # Palermo alternate
    "PLE": "PLE",       # Palermo FerryHopper code
    "TPS": "TPS",       # Trapani
    "SAL": "SAL",       # Salerno
    "NAP": "NAP",       # Naples
    "LIV": "LIV",       # Livorno

    # France
    "MRS": "MRS",       # Marseille
    "MAR": "MRS",       # Marseille alternate
    "NCE": "NCE",       # Nice
    "TLN": "TLN",       # Toulon

    # Greece (common FerryHopper routes)
    "PIR": "PIR",       # Piraeus
    "ATH": "ATH00",     # Athens (virtual)
    "JTR": "JTR",       # Santorini
    "JNX": "JNX",       # Naxos
    "RAF": "RAF",       # Rafina
    "HER": "HER",       # Heraklion
    "GRA": "PAT",       # Patras -> FerryHopper uses PAT
    "PAT": "PAT",       # Patras

    # Spain
    "BCN": "BCN",       # Barcelona
    "IBZ": "IBZ",       # Ibiza

    # Morocco
    "TNG": "TNG",       # Tangier Med
}

# Ports NOT supported by FerryHopper (will return empty results)
UNSUPPORTED_PORTS = {"SFA", "SFAX"}

# Fallback for name-based lookups (legacy support)
FALLBACK_PORT_MAP = {
    "TUNIS": "TUN",
    "LA_GOULETTE": "TUN",
    "ZARZIS": "TNZRZ",
    "GENOA": "GOA",
    "CIVITAVECCHIA": "CIV",
    "PALERMO": "PLE",
    "TRAPANI": "TPS",
    "SALERNO": "SAL",
    "NAPOLI": "NAP",
    "LIVORNO": "LIV",
    "MARSEILLE": "MRS",
    "NICE": "NCE",
    "TOULON": "TLN",
    "PIRAEUS": "PIR",
    "ATHENS": "ATH00",
    "SANTORINI": "JTR",
    "NAXOS": "JNX",
    "RAFINA": "RAF",
    "HERAKLION": "HER",
    "PATRAS": "PAT",
    "BARCELONA": "BCN",
    "IBIZA": "IBZ",
}

# Reverse mapping for FerryHopper -> VoilaFerry
REVERSE_PORT_MAP = {
    "TUN": "TUN",
    "TNZRZ": "ZAR",
    "GOA": "GOA",
    "CIV": "CVV",
    "PLE": "PMO",
    "TPS": "TPS",
    "SAL": "SAL",
    "NAP": "NAP",
    "LIV": "LIV",
    "MRS": "MRS",
    "NCE": "NCE",
    "TLN": "TLN",
    "PIR": "PIR",
    "ATH00": "ATH",
    "JTR": "JTR",
    "JNX": "JNX",
    "RAF": "RAF",
    "HER": "HER",
    "PAT": "GRA",
    "BCN": "BCN",
    "IBZ": "IBZ",
}

# Vehicle type mapping: VoilaFerry -> FerryHopper
VEHICLE_TYPE_MAP = {
    "car": "CAR",
    "suv": "CAR",  # FerryHopper uses CAR for both
    "van": "VAN",
    "motorcycle": "MOTORBIKE",
    "camper": "CAMPER",
    "caravan": "CARAVAN",
    "truck": "TRUCK",
    "trailer": "TRAILER",
    "bicycle": "BICYCLE",
}

# Accommodation type mapping: VoilaFerry -> FerryHopper
ACCOMMODATION_TYPE_MAP = {
    "deck": "DECK",
    "interior": "CABIN_INSIDE",
    "exterior": "CABIN_OUTSIDE",
    "balcony": "CABIN_BALCONY",
    "suite": "SUITE",
    "seat": "SEAT",
}

# FerryHopper accommodation type -> VoilaFerry cabin type mapping
# Maps all FerryHopper types to the 5 VoilaFerry CabinType values
FERRYHOPPER_TO_VOILAFERRY_CABIN_MAP = {
    # Deck/seat types -> deck
    "DECK": "deck",
    "SEAT": "deck",
    "SEAT_NOTNUMBERED": "deck",
    "SEAT_NUMBERED": "deck",
    "ECONOMY": "deck",
    "RECLINING_SEAT": "deck",
    "RESERVED_SEAT": "deck",
    "AIRPLANE_SEAT": "deck",
    "BUS_SEAT": "deck",

    # Interior cabin types -> interior
    "CABIN": "interior",
    "CABIN_FULL": "interior",
    "CABIN_INSIDE": "interior",
    "CABIN_INTERIOR": "interior",
    "CABIN_2_BED": "interior",
    "CABIN_4_BED": "interior",
    "CABIN_6_BED": "interior",
    "DORM": "interior",
    "BERTH": "interior",
    "COUCHETTE": "interior",
    "PULLMAN": "interior",

    # Exterior cabin types -> exterior
    "CABIN_OUTSIDE": "exterior",
    "CABIN_EXTERIOR": "exterior",
    "CABIN_FULL_WINDOW": "exterior",
    "CABIN_PORTHOLE": "exterior",
    "CABIN_SEA_VIEW": "exterior",
    "CABIN_WINDOW": "exterior",

    # Pet cabins -> exterior (special category)
    "PET_CABIN": "exterior",
    "PET_CABIN_FULL_WINDOW": "exterior",
    "PET_CABIN_INSIDE": "interior",

    # Balcony types -> balcony
    "CABIN_BALCONY": "balcony",
    "BALCONY": "balcony",

    # Suite types -> suite
    "SUITE": "suite",
    "CABIN_SUITE": "suite",
    "DELUXE": "suite",
    "LUXURY": "suite",
    "VIP": "suite",
}


def map_ferryhopper_cabin_type(fh_type: str) -> str:
    """
    Map FerryHopper accommodation type to VoilaFerry cabin type.

    Args:
        fh_type: FerryHopper accommodation type (e.g., 'SEAT_NOTNUMBERED')

    Returns:
        VoilaFerry cabin type ('deck', 'interior', 'exterior', 'balcony', 'suite')
    """
    normalized = fh_type.upper().strip()

    if normalized in FERRYHOPPER_TO_VOILAFERRY_CABIN_MAP:
        return FERRYHOPPER_TO_VOILAFERRY_CABIN_MAP[normalized]

    # Fallback logic based on keywords
    if "SUITE" in normalized or "DELUXE" in normalized or "VIP" in normalized:
        return "suite"
    if "BALCONY" in normalized:
        return "balcony"
    if "WINDOW" in normalized or "OUTSIDE" in normalized or "EXTERIOR" in normalized or "SEA_VIEW" in normalized:
        return "exterior"
    if "CABIN" in normalized or "BERTH" in normalized or "DORM" in normalized:
        return "interior"

    # Default to deck for seats and unknown types
    return "deck"


class FerryHopperMappingService:
    """
    Service for mapping between VoilaFerry and FerryHopper codes.
    Fetches and caches data from FerryHopper API.
    """

    def __init__(self, api_client):
        """
        Initialize mapping service.

        Args:
            api_client: HTTP client configured for FerryHopper API
        """
        self.api_client = api_client
        self._ports_cache: Optional[Dict[str, Any]] = None
        self._ports_cache_time: Optional[datetime] = None
        self._vehicles_cache: Optional[List[Dict]] = None
        self._vehicles_cache_time: Optional[datetime] = None
        self._accommodations_cache: Optional[List[Dict]] = None
        self._accommodations_cache_time: Optional[datetime] = None
        self._cache_ttl = timedelta(hours=24)

    async def get_ports(self, language: str = "en") -> List[Dict]:
        """
        Fetch ports from FerryHopper API with caching.

        Args:
            language: Language code for descriptions

        Returns:
            List of port dictionaries
        """
        # Check cache
        if self._ports_cache and self._ports_cache_time:
            if datetime.now() - self._ports_cache_time < self._cache_ttl:
                return self._ports_cache.get("ports", [])

        try:
            response = await self.api_client.get(
                "/ports",
                params={"language": language}
            )
            self._ports_cache = response
            self._ports_cache_time = datetime.now()
            logger.info(f"Cached {len(response.get('ports', []))} ports from FerryHopper")
            return response.get("ports", [])
        except Exception as e:
            logger.error(f"Failed to fetch ports from FerryHopper: {e}")
            return []

    async def get_vehicles(self, language: str = "en") -> List[Dict]:
        """
        Fetch vehicle types from FerryHopper API with caching.

        Args:
            language: Language code for descriptions

        Returns:
            List of vehicle dictionaries
        """
        # Check cache
        if self._vehicles_cache and self._vehicles_cache_time:
            if datetime.now() - self._vehicles_cache_time < self._cache_ttl:
                return self._vehicles_cache

        try:
            response = await self.api_client.get(
                "/vehicles",
                params={"language": language}
            )
            self._vehicles_cache = response.get("vehicles", [])
            self._vehicles_cache_time = datetime.now()
            logger.info(f"Cached {len(self._vehicles_cache)} vehicle types from FerryHopper")
            return self._vehicles_cache
        except Exception as e:
            logger.error(f"Failed to fetch vehicles from FerryHopper: {e}")
            return []

    async def get_accommodations(self) -> List[Dict]:
        """
        Fetch accommodation types from FerryHopper API with caching.

        Returns:
            List of accommodation dictionaries
        """
        # Check cache
        if self._accommodations_cache and self._accommodations_cache_time:
            if datetime.now() - self._accommodations_cache_time < self._cache_ttl:
                return self._accommodations_cache

        try:
            response = await self.api_client.get("/accommodations")
            self._accommodations_cache = response.get("accommodations", [])
            self._accommodations_cache_time = datetime.now()
            logger.info(f"Cached {len(self._accommodations_cache)} accommodation types from FerryHopper")
            return self._accommodations_cache
        except Exception as e:
            logger.error(f"Failed to fetch accommodations from FerryHopper: {e}")
            return []

    async def get_ferryhopper_port_code(self, voilaferry_code: str) -> Optional[str]:
        """
        Map VoilaFerry port code to FerryHopper port code.

        Args:
            voilaferry_code: VoilaFerry port code (e.g., "PMO", "TUN")

        Returns:
            FerryHopper port code or None if not found/unsupported
        """
        normalized_code = voilaferry_code.upper().strip()

        # Check if port is unsupported by FerryHopper
        if normalized_code in UNSUPPORTED_PORTS:
            logger.debug(f"Port {normalized_code} is not supported by FerryHopper")
            return None

        # First try direct VoilaFerry -> FerryHopper mapping (fastest)
        if normalized_code in VOILAFERRY_TO_FERRYHOPPER_PORT_MAP:
            fh_code = VOILAFERRY_TO_FERRYHOPPER_PORT_MAP[normalized_code]
            logger.debug(f"Mapped port {normalized_code} -> {fh_code}")
            return fh_code

        # Try name-based fallback map
        if normalized_code in FALLBACK_PORT_MAP:
            return FALLBACK_PORT_MAP[normalized_code]

        # Try fetching from API and matching
        ports = await self.get_ports()
        for port in ports:
            # Match by code
            if port.get("code", "").upper() == normalized_code:
                return port.get("code")
            # Match by name (case-insensitive)
            if port.get("name", "").upper() == normalized_code:
                return port.get("code")

        logger.warning(f"No FerryHopper port found for: {voilaferry_code}")
        return None

    def get_voilaferry_port_code(self, ferryhopper_code: str) -> str:
        """
        Map FerryHopper port code back to VoilaFerry port code.

        Args:
            ferryhopper_code: FerryHopper port code

        Returns:
            VoilaFerry port code (or original if no mapping)
        """
        normalized = ferryhopper_code.upper().strip()
        return REVERSE_PORT_MAP.get(normalized, normalized)

    def get_ferryhopper_vehicle_code(self, voilaferry_type: str) -> str:
        """
        Map VoilaFerry vehicle type to FerryHopper code.

        Args:
            voilaferry_type: VoilaFerry vehicle type

        Returns:
            FerryHopper vehicle code
        """
        return VEHICLE_TYPE_MAP.get(voilaferry_type.lower(), "CAR")

    def get_ferryhopper_accommodation_code(self, voilaferry_type: str) -> str:
        """
        Map VoilaFerry accommodation type to FerryHopper code.

        Args:
            voilaferry_type: VoilaFerry accommodation type

        Returns:
            FerryHopper accommodation code
        """
        return ACCOMMODATION_TYPE_MAP.get(voilaferry_type.lower(), "DECK")

    async def validate_route(
        self,
        departure_port: str,
        arrival_port: str
    ) -> bool:
        """
        Check if a route is valid in FerryHopper.

        Args:
            departure_port: VoilaFerry departure port code
            arrival_port: VoilaFerry arrival port code

        Returns:
            True if route is valid/connected
        """
        departure_fh = await self.get_ferryhopper_port_code(departure_port)
        arrival_fh = await self.get_ferryhopper_port_code(arrival_port)

        if not departure_fh or not arrival_fh:
            return False

        ports = await self.get_ports()
        for port in ports:
            if port.get("code") == departure_fh:
                connected = port.get("directlyConnectedPortCodes", [])
                if arrival_fh in connected:
                    return True
                # Check indirect connections
                regions = port.get("connectedRegions", [])
                for region_port in ports:
                    if region_port.get("code") == arrival_fh:
                        if any(r in region_port.get("connectedRegions", []) for r in regions):
                            return True
        return False

    def clear_cache(self):
        """Clear all cached data."""
        self._ports_cache = None
        self._ports_cache_time = None
        self._vehicles_cache = None
        self._vehicles_cache_time = None
        self._accommodations_cache = None
        self._accommodations_cache_time = None
        logger.info("FerryHopper mapping cache cleared")


def map_passenger_type(age: int) -> str:
    """
    Determine passenger type based on age.

    Args:
        age: Passenger age

    Returns:
        Passenger type string
    """
    if age < 2:
        return "INFANT"
    elif age < 12:
        return "CHILD"
    else:
        return "ADULT"


def calculate_age_from_type(passenger_type: str) -> int:
    """
    Get a representative age for a passenger type.

    Args:
        passenger_type: VoilaFerry passenger type

    Returns:
        Representative age
    """
    type_ages = {
        "adult": 30,
        "child": 8,
        "infant": 1,
    }
    return type_ages.get(passenger_type.lower(), 30)
