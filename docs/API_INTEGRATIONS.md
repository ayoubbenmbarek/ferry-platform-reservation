# Ferry Operators API Integration Guide

## Overview
This document details the integration requirements and specifications for each ferry operator serving the Italy/France to Tunisia routes.

## Base Integration Pattern

### Abstract Base Class
All ferry integrations should inherit from this base class:

```python
# backend/app/services/ferry_integrations/base.py
from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from datetime import datetime, date
from app.schemas.ferry import SearchRequest, FerryResult, BookingRequest, BookingConfirmation

class BaseFerryIntegration(ABC):
    def __init__(self, api_key: str, base_url: str, timeout: int = 30):
        self.api_key = api_key
        self.base_url = base_url
        self.timeout = timeout
        
    @abstractmethod
    async def search_ferries(self, search_request: SearchRequest) -> List[FerryResult]:
        """Search for available ferries"""
        pass
        
    @abstractmethod
    async def create_booking(self, booking_request: BookingRequest) -> BookingConfirmation:
        """Create a new booking"""
        pass
        
    @abstractmethod
    async def get_booking_status(self, booking_reference: str) -> Dict:
        """Check booking status"""
        pass
        
    @abstractmethod
    async def cancel_booking(self, booking_reference: str) -> bool:
        """Cancel an existing booking"""
        pass
```

## Ferry Operator Specifications

### 1. CTN (Compagnie Tunisienne de Navigation)

**Base URL**: `https://api.ctn.com.tn/v1/`
**Authentication**: API Key in header
**Rate Limit**: 100 requests/minute
**Data Format**: JSON
**Documentation**: Available on request from CTN

#### Routes Served
- Tunis ↔ Genoa (Italy)
- Tunis ↔ Marseille (France)
- Tunis ↔ Civitavecchia (Italy)

#### API Endpoints
```
GET  /routes                    # Available routes
POST /search                    # Search availability
POST /bookings                  # Create booking
GET  /bookings/{id}            # Get booking details
PUT  /bookings/{id}/cancel     # Cancel booking
```

#### Search Request Format
```json
{
  "departure_port": "TUNIS",
  "arrival_port": "GENOA",
  "departure_date": "2025-07-15",
  "return_date": "2025-07-22",
  "passengers": {
    "adults": 2,
    "children": 1,
    "infants": 0
  },
  "vehicles": [
    {
      "type": "car",
      "length": 4.5,
      "height": 1.8
    }
  ]
}
```

#### Response Format
```json
{
  "results": [
    {
      "sailing_id": "CTN_2025_07_15_001",
      "departure_port": "TUNIS",
      "arrival_port": "GENOA",
      "departure_time": "2025-07-15T20:00:00Z",
      "arrival_time": "2025-07-16T14:00:00Z",
      "duration": "18h00m",
      "vessel_name": "Carthage",
      "prices": {
        "adult": 85.00,
        "child": 42.50,
        "infant": 0.00,
        "vehicle": 120.00
      },
      "cabin_types": [
        {
          "type": "interior",
          "price": 25.00,
          "available": 5
        },
        {
          "type": "exterior",
          "price": 35.00,
          "available": 3
        }
      ]
    }
  ]
}
```

#### Implementation Notes
- CTN requires advance booking confirmation within 24 hours
- Vehicle dimensions must be provided for accurate pricing
- Special rates available for Tunisian residents (requires documentation)

### 2. GNV (Grandi Navi Veloci)

**Base URL**: `https://api.gnv.it/v2/`
**Authentication**: Bearer Token (OAuth 2.0)
**Rate Limit**: 200 requests/minute
**Data Format**: JSON
**Documentation**: https://developers.gnv.it/

#### Routes Served
- Tunis ↔ Genoa (Italy)
- Tunis ↔ Civitavecchia (Italy)
- Tunis ↔ Palermo (Italy)

#### OAuth Flow
```python
# Get access token
POST /oauth/token
{
  "grant_type": "client_credentials",
  "client_id": "your_client_id",
  "client_secret": "your_client_secret"
}
```

#### Search Request Format
```json
{
  "route": {
    "from": "TUNIS",
    "to": "GENOA"
  },
  "outbound_date": "2025-07-15",
  "return_date": "2025-07-22",
  "pax": [
    {"type": "ADT", "count": 2},
    {"type": "CHD", "count": 1}
  ],
  "vehicles": [
    {
      "category": "CAR",
      "dimensions": {"length": 450, "height": 180}
    }
  ]
}
```

#### Implementation Notes
- GNV uses numeric dimensions in centimeters
- Offers dynamic pricing based on demand
- Requires vehicle registration details at booking

### 3. Corsica Lines

**Base URL**: `https://booking.corsicalines.com/api/v1/`
**Authentication**: API Key + HMAC signature
**Rate Limit**: 150 requests/minute
**Data Format**: JSON
**Documentation**: Available to registered partners

#### Routes Served
- Tunis ↔ Marseille (France)
- Tunis ↔ Nice (France)

#### HMAC Authentication
```python
import hmac
import hashlib
import time

def generate_signature(api_key: str, secret: str, timestamp: str, body: str) -> str:
    message = f"{api_key}{timestamp}{body}"
    return hmac.new(
        secret.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
```

#### Search Request Format
```json
{
  "departure": {
    "port_code": "TUN",
    "date": "2025-07-15"
  },
  "arrival": {
    "port_code": "MRS"
  },
  "passengers": {
    "adults": 2,
    "children": 1,
    "infants": 0
  },
  "vehicle": {
    "type": "VOITURE",
    "length_cm": 450,
    "height_cm": 180
  }
}
```

#### Implementation Notes
- Uses French port codes (MRS for Marseille, NCE for Nice)
- Seasonal schedule variations (reduced frequency in winter)
- Offers pet transportation services

### 4. Danel Casanova

**Base URL**: `https://reservations.danel-casanova.fr/api/`
**Authentication**: Basic Auth
**Rate Limit**: 50 requests/minute
**Data Format**: XML (legacy system)
**Documentation**: PDF manual available on request

#### Routes Served
- Tunis ↔ Marseille (France)
- Seasonal routes to smaller French ports

#### XML Request Format
```xml
<?xml version="1.0" encoding="UTF-8"?>
<SearchRequest>
  <Departure>
    <Port>TUNIS</Port>
    <Date>2025-07-15</Date>
  </Departure>
  <Arrival>
    <Port>MARSEILLE</Port>
  </Arrival>
  <Passengers>
    <Adult>2</Adult>
    <Child>1</Child>
  </Passengers>
  <Vehicle>
    <Type>VOITURE</Type>
    <Length>4.5</Length>
    <Height>1.8</Height>
  </Vehicle>
</SearchRequest>
```

#### Implementation Notes
- Legacy XML API requires careful parsing
- Limited availability - smaller operator
- Often has competitive pricing for France-Tunisia route

## Common Integration Patterns

### Error Handling
```python
from enum import Enum
from typing import Optional

class FerryAPIError(Exception):
    def __init__(self, message: str, error_code: Optional[str] = None):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)

class ErrorCode(Enum):
    TIMEOUT = "TIMEOUT"
    RATE_LIMITED = "RATE_LIMITED"
    INVALID_ROUTE = "INVALID_ROUTE"
    NO_AVAILABILITY = "NO_AVAILABILITY"
    BOOKING_FAILED = "BOOKING_FAILED"
```

### Retry Logic
```python
import asyncio
from typing import Callable, Any
import random

async def retry_with_backoff(
    func: Callable,
    max_retries: int = 3,
    backoff_factor: float = 1.0
) -> Any:
    for attempt in range(max_retries):
        try:
            return await func()
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            
            wait_time = backoff_factor * (2 ** attempt) + random.uniform(0, 1)
            await asyncio.sleep(wait_time)
```

### Response Caching
```python
import redis
import json
from datetime import timedelta

class FerryCache:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        
    async def cache_search_results(
        self, 
        search_key: str, 
        results: List[FerryResult], 
        ttl: timedelta = timedelta(minutes=5)
    ):
        serialized = json.dumps([result.dict() for result in results])
        await self.redis.setex(search_key, ttl, serialized)
```

## Data Mapping

### Port Code Standardization
```python
PORT_CODE_MAPPING = {
    # Tunisia
    "TUNIS": {"ctn": "TUN", "gnv": "TUNIS", "corsica": "TUN", "danel": "TUNIS"},
    
    # Italy
    "GENOA": {"ctn": "GOA", "gnv": "GENOA", "corsica": "GOA", "danel": "GENOA"},
    "CIVITAVECCHIA": {"ctn": "CIV", "gnv": "CIVITAVECCHIA", "corsica": "CIV", "danel": "CIVITAVECCHIA"},
    "PALERMO": {"ctn": "PAL", "gnv": "PALERMO", "corsica": "PAL", "danel": "PALERMO"},
    
    # France
    "MARSEILLE": {"ctn": "MRS", "gnv": "MARSEILLE", "corsica": "MRS", "danel": "MARSEILLE"},
    "NICE": {"ctn": "NCE", "gnv": "NICE", "corsica": "NCE", "danel": "NICE"}
}
```

### Vehicle Type Mapping
```python
VEHICLE_TYPE_MAPPING = {
    "car": {"ctn": "CAR", "gnv": "CAR", "corsica": "VOITURE", "danel": "VOITURE"},
    "motorcycle": {"ctn": "MOTO", "gnv": "MOTORCYCLE", "corsica": "MOTO", "danel": "MOTO"},
    "camper": {"ctn": "CAMPER", "gnv": "CAMPER", "corsica": "CAMPING_CAR", "danel": "CAMPING_CAR"}
}
```

## Testing Strategy

### Mock API Responses
Create mock servers for each operator during development:
```python
# tests/mocks/ctn_mock.py
from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI()

@app.post("/search")
async def mock_ctn_search(request: dict):
    return JSONResponse({
        "results": [
            {
                "sailing_id": "CTN_TEST_001",
                "departure_port": "TUNIS",
                "arrival_port": "GENOA",
                "departure_time": "2025-07-15T20:00:00Z",
                "arrival_time": "2025-07-16T14:00:00Z",
                "prices": {"adult": 85.00, "child": 42.50}
            }
        ]
    })
```

### Integration Tests
```python
import pytest
from app.services.ferry_integrations.ctn import CTNIntegration

@pytest.mark.asyncio
async def test_ctn_search_integration():
    ctn = CTNIntegration(api_key="test_key", base_url="http://localhost:8001")
    
    search_request = SearchRequest(
        departure_port="TUNIS",
        arrival_port="GENOA",
        departure_date=date(2025, 7, 15),
        adults=2,
        children=1
    )
    
    results = await ctn.search_ferries(search_request)
    assert len(results) > 0
    assert results[0].departure_port == "TUNIS"
```

## Monitoring and Logging

### API Call Logging
```python
import logging
from datetime import datetime

logger = logging.getLogger("ferry_api")

class APILogger:
    @staticmethod
    def log_api_call(operator: str, endpoint: str, duration: float, status: int):
        logger.info({
            "timestamp": datetime.utcnow().isoformat(),
            "operator": operator,
            "endpoint": endpoint,
            "duration_ms": duration * 1000,
            "status_code": status,
            "type": "api_call"
        })
```

### Health Checks
```python
from fastapi import APIRouter
from app.services.ferry_integrations import get_all_integrations

router = APIRouter()

@router.get("/health/ferry-apis")
async def check_ferry_apis():
    integrations = get_all_integrations()
    health_status = {}
    
    for name, integration in integrations.items():
        try:
            # Simple health check - get routes or ping endpoint
            await integration.health_check()
            health_status[name] = "healthy"
        except Exception as e:
            health_status[name] = f"unhealthy: {str(e)}"
    
    return health_status
```

## Environment Configuration

```python
# backend/app/config.py
from pydantic import BaseSettings

class Settings(BaseSettings):
    # CTN Configuration
    CTN_API_KEY: str
    CTN_BASE_URL: str = "https://api.ctn.com.tn/v1/"
    
    # GNV Configuration
    GNV_CLIENT_ID: str
    GNV_CLIENT_SECRET: str
    GNV_BASE_URL: str = "https://api.gnv.it/v2/"
    
    # Corsica Lines Configuration
    CORSICA_API_KEY: str
    CORSICA_SECRET: str
    CORSICA_BASE_URL: str = "https://booking.corsicalines.com/api/v1/"
    
    # Danel Casanova Configuration
    DANEL_USERNAME: str
    DANEL_PASSWORD: str
    DANEL_BASE_URL: str = "https://reservations.danel-casanova.fr/api/"
    
    # General API Settings
    API_TIMEOUT: int = 30
    MAX_RETRIES: int = 3
    CACHE_TTL_MINUTES: int = 5

settings = Settings()
```

This guide provides the foundation for integrating with all major ferry operators. Each integration should be developed incrementally, starting with CTN (largest operator) and then expanding to others.
