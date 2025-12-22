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
# This translates VoilaFerry's internal codes to official FerryHopper API codes
# ALL codes here are official FerryHopper codes (uppercase)
VOILAFERRY_TO_FERRYHOPPER_PORT_MAP = {
    # Tunisia - Official FerryHopper codes
    "TUN": "TUN",       # Tunis (La Goulette)
    "TNZRZ": "TNZRZ",   # Zarzis

    # Italy - Official FerryHopper codes
    "GOA": "GOA",       # Genoa
    "CIV": "CIV",       # Civitavecchia (Rome)
    "PLE": "PLE",       # Palermo, Sicily
    "TPS": "TPS",       # Trapani, Sicily
    "SAL": "SAL",       # Salerno
    "NAP": "NAP",       # Naples Calata Porta di Massa
    "LIV": "LIV",       # Livorno
    "AEL00": "AEL00",   # Aeolian Islands (all ports)
    "ANC": "ANC",       # Ancona
    "BAR": "BAR",       # Bari
    "MLZ": "MLZ",       # Milazzo, Sicily
    "MSN": "MSN",       # Messina

    # France - Official FerryHopper codes
    "MRS": "MRS",       # Marseille
    "NCE": "NCE",       # Nice
    "TLN": "TLN",       # Toulon
    "AJA": "AJA",       # Ajaccio, Corsica
    "BIA": "BIA",       # Bastia, Corsica
    "COR00": "COR00",   # Corsica (all ports)

    # Morocco - Official FerryHopper codes
    "TNG": "TNG",       # Tanger Med, Tangier

    # Spain - Official FerryHopper codes
    "BCN": "BCN",       # Barcelona (mapped as BRC in FerryHopper)
    "BRC": "BRC",       # Barcelona official code
    "ALG": "ALG",       # Algeciras

    # Algeria - Official FerryHopper codes
    "DZALG": "DZALG",   # Algiers
}

# Ports NOT supported by FerryHopper (will return empty results)
UNSUPPORTED_PORTS = {"SFA", "SFAX"}

# Virtual "all ports" codes - these are country-level groupings
# Format: XX00 for countries (4 chars), longer codes for regions
# These get mapped to the main port for that country/region when searching
VIRTUAL_ALL_PORTS_CODES = {
    # Country-level virtual codes (4 characters)
    "TN00", "IT00", "FR00", "GR00", "ES00", "MA00", "DZ00",
}

# Region-level virtual codes - these exist in FerryHopper
# They are NOT virtual, they're official FerryHopper region codes
REGION_ALL_PORTS_CODES = {
    "AEL00",   # Aeolian Islands (all ports)
    "COR00",   # Corsica (all ports)
    "NAP00",   # Naples (all ports)
    "SAR00",   # Sardinia (all ports)
    "SIC00",   # Sicily (all ports)
}

# Map virtual country codes to their country code for validation purposes
VIRTUAL_PORT_TO_COUNTRY = {
    "TN00": "TN",  # Tunisia
    "IT00": "IT",  # Italy
    "FR00": "FR",  # France
    "GR00": "GR",  # Greece
    "ES00": "ES",  # Spain
    "MA00": "MA",  # Morocco
    "DZ00": "DZ",  # Algeria
}

# Map virtual "all ports" codes to the main/default FerryHopper port for that country
# This allows searching from "Tunisia all ports" by using the main ferry hub
VIRTUAL_PORT_TO_DEFAULT = {
    "TN00": "TUN",  # Tunisia all ports -> Tunis (La Goulette)
    "IT00": "GOA",  # Italy all ports -> Genoa (main ferry hub)
    "FR00": "MRS",  # France all ports -> Marseille (main ferry hub)
    "GR00": "PIR",  # Greece all ports -> Piraeus (Athens)
    "ES00": "BRC",  # Spain all ports -> Barcelona
    "MA00": "TNG",  # Morocco all ports -> Tangier Med
    "DZ00": "DZALG", # Algeria all ports -> Algiers
}

# Fallback for name-based lookups (maps common names to official FerryHopper codes)
FALLBACK_PORT_MAP = {
    # Tunisia - name variations
    "TUNIS": "TUN",
    "LA_GOULETTE": "TUN",
    "LAGOULETTE": "TUN",
    "LA GOULETTE": "TUN",
    "GOULETTE": "TUN",
    "LA-GOULETTE": "TUN",
    "ZARZIS": "TNZRZ",

    # Italy - name variations
    "GENOA": "GOA",
    "GENOVA": "GOA",
    "CIVITAVECCHIA": "CIV",
    "PALERMO": "PLE",
    "TRAPANI": "TPS",
    "SALERNO": "SAL",
    "NAPOLI": "NAP",
    "NAPLES": "NAP",
    "LIVORNO": "LIV",
    "LIVOURNE": "LIV",
    "ANCONA": "ANC",
    "BARI": "BAR",
    "MILAZZO": "MLZ",
    "MESSINA": "MSN",
    "AEOLIAN": "AEL00",
    "AEOLIAN ISLANDS": "AEL00",

    # France - name variations
    "MARSEILLE": "MRS",
    "MARSEILLES": "MRS",
    "NICE": "NCE",
    "TOULON": "TLN",
    "AJACCIO": "AJA",
    "BASTIA": "BIA",
    "CORSICA": "COR00",

    # Morocco - name variations
    "TANGIER": "TNG",
    "TANGER": "TNG",
    "TANGER MED": "TNG",

    # Spain - name variations
    "BARCELONA": "BRC",
    "ALGECIRAS": "ALG",

    # Algeria - name variations
    "ALGIERS": "DZALG",
}

# Reverse mapping for FerryHopper -> VoilaFerry (same codes, no transformation needed)
# All VoilaFerry codes now match FerryHopper codes
REVERSE_PORT_MAP = {
    # Tunisia
    "TUN": "TUN",
    "TNZRZ": "TNZRZ",

    # Italy
    "GOA": "GOA",
    "CIV": "CIV",
    "PLE": "PLE",
    "TPS": "TPS",
    "SAL": "SAL",
    "NAP": "NAP",
    "LIV": "LIV",
    "AEL00": "AEL00",
    "ANC": "ANC",
    "BAR": "BAR",
    "MLZ": "MLZ",
    "MSN": "MSN",

    # France
    "MRS": "MRS",
    "NCE": "NCE",
    "TLN": "TLN",
    "AJA": "AJA",
    "BIA": "BIA",
    "COR00": "COR00",

    # Morocco
    "TNG": "TNG",

    # Spain
    "BRC": "BRC",
    "ALG": "ALG",

    # Algeria
    "DZALG": "DZALG",
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

    # Interior cabin types -> interior (private cabin)
    "CABIN": "interior",
    "CABIN_FULL": "interior",
    "CABIN_INSIDE": "interior",
    "CABIN_INTERIOR": "interior",
    "CABIN_2_BED": "interior",
    "CABIN_4_BED": "interior",
    "CABIN_6_BED": "interior",

    # Shared cabin/bed types -> shared (bed in shared cabin with same-sex passengers)
    # PULLMAN = fold-down berth, often in shared cabins
    "PULLMAN": "shared",
    "DORM": "shared",
    "BERTH": "shared",
    "COUCHETTE": "shared",
    "BED": "shared",
    "BED_IN_CABIN": "shared",
    "SHARED_CABIN": "shared",
    "DORMITORY": "shared",
    "BUNK": "shared",
    "BUNK_BED": "shared",
    "LIT": "shared",  # French for bed
    "LIT_CABIN": "shared",
    "CABIN_BED": "shared",
    "CABIN_SHARED": "shared",
    "CABIN_DORM": "shared",
    "CABIN_BERTH": "shared",

    # Exterior cabin types -> exterior
    "CABIN_OUTSIDE": "exterior",
    "CABIN_EXTERIOR": "exterior",
    "CABIN_FULL_WINDOW": "exterior",
    "CABIN_PORTHOLE": "exterior",
    "CABIN_SEA_VIEW": "exterior",
    "CABIN_WINDOW": "exterior",

    # Pet cabins -> pet (special category - allows pets)
    "PET_CABIN": "pet",
    "PET_CABIN_FULL_WINDOW": "pet",
    "PET_CABIN_INSIDE": "pet",
    "PET_CABIN_OUTSIDE": "pet",
    "CABIN_PET": "pet",
    "CABIN_WITH_PET": "pet",

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
    # Pet cabins - check before exterior since PET_CABIN_FULL_WINDOW contains WINDOW
    if "PET" in normalized:
        return "pet"
    if "WINDOW" in normalized or "OUTSIDE" in normalized or "EXTERIOR" in normalized or "SEA_VIEW" in normalized:
        return "exterior"
    # Shared cabin/bed types (bed in shared cabin with same-sex passengers)
    # Include French terms: LIT (bed), PARTAGÉE/PARTAGE (shared)
    if any(kw in normalized for kw in ["BERTH", "DORM", "COUCHETTE", "SHARED", "BED", "LIT", "PARTAGE", "BUNK"]):
        return "shared"
    if "CABIN" in normalized:
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
