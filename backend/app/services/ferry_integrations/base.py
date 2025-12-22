"""
Base ferry integration class that all ferry operators must implement.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any
from datetime import datetime, date
import asyncio
import httpx
import logging

logger = logging.getLogger(__name__)


class FerryAPIError(Exception):
    """Custom exception for ferry API errors."""
    
    def __init__(self, message: str, error_code: Optional[str] = None, status_code: Optional[int] = None):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        super().__init__(self.message)


class SearchRequest:
    """Ferry search request model."""

    def __init__(
        self,
        departure_port: str,
        arrival_port: str,
        departure_date: date,
        return_date: Optional[date] = None,
        # Different return route support
        return_departure_port: Optional[str] = None,
        return_arrival_port: Optional[str] = None,
        adults: int = 1,
        children: int = 0,
        infants: int = 0,
        vehicles: Optional[List[Dict]] = None,
        pets: Optional[List[Dict]] = None
    ):
        self.departure_port = departure_port
        self.arrival_port = arrival_port
        self.departure_date = departure_date
        self.return_date = return_date
        # If no return route specified, use reversed outbound route
        self.return_departure_port = return_departure_port or arrival_port
        self.return_arrival_port = return_arrival_port or departure_port
        self.adults = adults
        self.children = children
        self.infants = infants
        self.vehicles = vehicles or []
        self.pets = pets or []


class FerryResult:
    """Ferry search result model."""

    def __init__(
        self,
        sailing_id: str,
        operator: str,
        departure_port: str,
        arrival_port: str,
        departure_time: datetime,
        arrival_time: datetime,
        vessel_name: str,
        prices: Dict[str, float],
        cabin_types: Optional[List[Dict]] = None,
        available_spaces: Optional[Dict[str, int]] = None,
        available_vehicles: Optional[List[Dict]] = None,
        route_info: Optional[Dict] = None,
        journey_type: str = "outbound"  # "outbound" or "return" for round trips
    ):
        self.sailing_id = sailing_id
        self.operator = operator
        self.departure_port = departure_port
        self.arrival_port = arrival_port
        self.departure_time = departure_time
        self.arrival_time = arrival_time
        self.vessel_name = vessel_name
        self.prices = prices
        self.cabin_types = cabin_types or []
        self.available_spaces = available_spaces or {}
        self.available_vehicles = available_vehicles or []
        self.route_info = route_info or {}
        self.journey_type = journey_type  # "outbound" or "return"

    def to_dict(self) -> Dict:
        """Convert FerryResult to dictionary for Pydantic validation."""
        result = {
            "sailing_id": self.sailing_id,
            "operator": self.operator,
            "departure_port": self.departure_port,
            "arrival_port": self.arrival_port,
            "departure_time": self.departure_time.isoformat() if hasattr(self.departure_time, 'isoformat') else str(self.departure_time),
            "arrival_time": self.arrival_time.isoformat() if hasattr(self.arrival_time, 'isoformat') else str(self.arrival_time),
            "vessel_name": self.vessel_name,
            "prices": self.prices,
            "cabin_types": self.cabin_types,
            "available_spaces": self.available_spaces,
            "available_vehicles": self.available_vehicles,
            "journey_type": self.journey_type,  # "outbound" or "return"
        }
        # Include route_info if it has data
        if self.route_info:
            result["route_info"] = self.route_info
        return result


class BookingRequest:
    """Ferry booking request model."""
    
    def __init__(
        self,
        sailing_id: str,
        passengers: List[Dict],
        vehicles: Optional[List[Dict]] = None,
        cabin_selection: Optional[Dict] = None,
        contact_info: Dict[str, str] = None,
        special_requests: Optional[str] = None
    ):
        self.sailing_id = sailing_id
        self.passengers = passengers
        self.vehicles = vehicles or []
        self.cabin_selection = cabin_selection
        self.contact_info = contact_info or {}
        self.special_requests = special_requests


class BookingConfirmation:
    """Ferry booking confirmation model."""
    
    def __init__(
        self,
        booking_reference: str,
        operator_reference: str,
        status: str,
        total_amount: float,
        currency: str = "EUR",
        confirmation_details: Optional[Dict] = None
    ):
        self.booking_reference = booking_reference
        self.operator_reference = operator_reference
        self.status = status
        self.total_amount = total_amount
        self.currency = currency
        self.confirmation_details = confirmation_details or {}


class BaseFerryIntegration(ABC):
    """Abstract base class for ferry operator integrations."""
    
    def __init__(self, api_key: str = "", base_url: str = "", timeout: int = 30):
        self.api_key = api_key
        self.base_url = base_url
        self.timeout = timeout
        self.session = None
    
    async def __aenter__(self):
        """Async context manager entry."""
        self.session = httpx.AsyncClient(timeout=self.timeout)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.aclose()
    
    @abstractmethod
    async def search_ferries(self, search_request: SearchRequest) -> List[FerryResult]:
        """
        Search for available ferries.
        
        Args:
            search_request: Ferry search parameters
            
        Returns:
            List of available ferry results
            
        Raises:
            FerryAPIError: If the API request fails
        """
        pass
    
    @abstractmethod
    async def create_booking(self, booking_request: BookingRequest) -> BookingConfirmation:
        """
        Create a new ferry booking.
        
        Args:
            booking_request: Booking details
            
        Returns:
            Booking confirmation details
            
        Raises:
            FerryAPIError: If the booking fails
        """
        pass
    
    @abstractmethod
    async def get_booking_status(self, booking_reference: str) -> Dict[str, Any]:
        """
        Get the status of an existing booking.
        
        Args:
            booking_reference: Operator's booking reference
            
        Returns:
            Booking status information
            
        Raises:
            FerryAPIError: If the status check fails
        """
        pass
    
    @abstractmethod
    async def cancel_booking(self, booking_reference: str, reason: Optional[str] = None) -> bool:
        """
        Cancel an existing booking.
        
        Args:
            booking_reference: Operator's booking reference
            reason: Cancellation reason
            
        Returns:
            True if cancellation was successful
            
        Raises:
            FerryAPIError: If the cancellation fails
        """
        pass
    
    async def health_check(self) -> bool:
        """
        Check if the ferry operator API is available.
        
        Returns:
            True if API is healthy
        """
        try:
            if not self.session:
                self.session = httpx.AsyncClient(timeout=self.timeout)
            
            response = await self.session.get(f"{self.base_url}/health")
            return response.status_code == 200
        except Exception as e:
            logger.warning(f"Health check failed for {self.__class__.__name__}: {e}")
            return False
    
    async def retry_with_backoff(
        self,
        func,
        max_retries: int = 3,
        backoff_factor: float = 1.0
    ) -> Any:
        """
        Retry a function with exponential backoff.
        
        Args:
            func: Function to retry
            max_retries: Maximum number of retries
            backoff_factor: Backoff multiplier
            
        Returns:
            Function result
            
        Raises:
            Last exception if all retries fail
        """
        for attempt in range(max_retries):
            try:
                return await func()
            except Exception as e:
                if attempt == max_retries - 1:
                    raise e
                
                wait_time = backoff_factor * (2 ** attempt)
                logger.warning(f"Attempt {attempt + 1} failed, retrying in {wait_time}s: {e}")
                await asyncio.sleep(wait_time)
    
    def _handle_api_error(self, response: httpx.Response) -> None:
        """
        Handle API error responses.
        
        Args:
            response: HTTP response object
            
        Raises:
            FerryAPIError: For non-successful responses
        """
        if response.status_code >= 400:
            try:
                error_data = response.json()
                message = error_data.get("message", "API request failed")
                error_code = error_data.get("error_code")
            except:
                message = f"HTTP {response.status_code}: {response.text}"
                error_code = None
            
            raise FerryAPIError(
                message=message,
                error_code=error_code,
                status_code=response.status_code
            )
    
    def _standardize_port_code(self, port_code: str) -> str:
        """
        Standardize port codes for the operator.
        
        Args:
            port_code: Standard port code
            
        Returns:
            Operator-specific port code
        """
        # Default implementation returns the same code
        # Override in specific integrations
        return port_code
    
    def _standardize_vehicle_type(self, vehicle_type: str) -> str:
        """
        Standardize vehicle types for the operator.
        
        Args:
            vehicle_type: Standard vehicle type
            
        Returns:
            Operator-specific vehicle type
        """
        # Default implementation returns the same type
        # Override in specific integrations
        return vehicle_type 