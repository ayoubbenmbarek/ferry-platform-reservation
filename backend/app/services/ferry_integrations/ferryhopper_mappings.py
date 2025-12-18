"""
FerryHopper port, vehicle, and accommodation mapping service.
Handles code translation between VoilaFerry and FerryHopper systems.
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import asyncio

logger = logging.getLogger(__name__)


# Fallback port mappings for common Mediterranean ports
# These are used when API port lookup fails
FALLBACK_PORT_MAP = {
    # Tunisia
    "TUNIS": "TUN",
    "LA_GOULETTE": "LGO",
    "SFAX": "SFA",
    "ZARZIS": "ZAR",
    # Italy
    "GENOA": "GOA",
    "CIVITAVECCHIA": "CVV",
    "PALERMO": "PMO",
    "TRAPANI": "TPS",
    "SALERNO": "SAL",
    "NAPOLI": "NAP",
    "LIVORNO": "LIV",
    # France
    "MARSEILLE": "MRS",
    "NICE": "NCE",
    "TOULON": "TLN",
    # Greece (common FerryHopper routes)
    "PIRAEUS": "PIR",
    "ATHENS": "ATH",  # Virtual port
    "SANTORINI": "JTR",
    "NAXOS": "JNX",
    "RAFINA": "RAF",
    "HERAKLION": "HER",
    "PATRAS": "GRA",
    # Spain
    "BARCELONA": "BCN",
    "IBIZA": "IBZ",
}

# Reverse mapping for FerryHopper -> VoilaFerry
REVERSE_PORT_MAP = {v: k for k, v in FALLBACK_PORT_MAP.items()}

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
            voilaferry_code: VoilaFerry port code (e.g., "TUNIS")

        Returns:
            FerryHopper port code or None if not found
        """
        normalized_code = voilaferry_code.upper().strip()

        # First try fallback map (fastest)
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
