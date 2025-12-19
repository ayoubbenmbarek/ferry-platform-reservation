"""
Ferry API endpoints for searching ferries, routes, and schedules.
"""

import time
import logging
from typing import Optional
from datetime import datetime, date

logger = logging.getLogger(__name__)

try:
    from fastapi import APIRouter, Depends, HTTPException, status, Query
    from sqlalchemy.orm import Session
except ImportError:
    # Fallback for development
    class APIRouter:
        def __init__(self, *_args, **_kwargs):
            pass
        def get(self, *_args, **_kwargs):
            def decorator(func):
                return func
            return decorator
        def post(self, *_args, **_kwargs):
            def decorator(func):
                return func
            return decorator
    
    class Depends:
        def __init__(self, dependency):
            pass
    
    class HTTPException(Exception):
        pass
    
    class status:
        HTTP_404_NOT_FOUND = 404
        HTTP_500_INTERNAL_SERVER_ERROR = 500
    
    def Query(*_args, **_kwargs):
        return None
    
    class Session:
        pass

try:
    from app.api.deps import get_db, get_optional_current_user
    from app.schemas.ferry import (
        FerrySearch, FerrySearchResponse, FerryResult,
        RouteResponse, HealthCheckResponse,
        PriceComparison, OperatorStatus
    )
    from app.services.ferry_service import FerryService
    from app.services.ferry_integrations.base import FerryAPIError
except ImportError:
    # Fallback for development
    def get_db():
        pass
    def get_optional_current_user():
        pass
    def get_common_params():
        pass
    
    class FerrySearch:
        pass
    class FerrySearchResponse:
        pass
    class FerryResult:
        pass
    class RouteResponse:
        pass
    class ScheduleResponse:
        pass
    class HealthCheckResponse:
        pass
    class PriceComparison:
        pass
    class OperatorStatus:
        pass
    class FerryService:
        pass
    class FerryAPIError(Exception):
        pass

router = APIRouter()

# Initialize ferry service
ferry_service = FerryService()


async def adjust_availability_from_bookings(results: list) -> list:
    """
    Adjust cabin and passenger availability based on our actual bookings.

    This subtracts booked cabins/passengers from the operator's reported availability
    to reflect our platform's bookings.
    """
    from app.database import SessionLocal
    from app.models.booking import Booking, BookingCabin, BookingStatusEnum
    from sqlalchemy import func

    if not results:
        return results

    try:
        db = SessionLocal()

        # Get all sailing IDs from results
        sailing_ids = [r.get("sailing_id") for r in results if r.get("sailing_id")]

        if not sailing_ids:
            db.close()
            return results

        # Query booked cabins grouped by sailing_id and cabin type
        cabin_bookings = (
            db.query(
                Booking.sailing_id,
                BookingCabin.cabin_id,
                func.sum(BookingCabin.quantity).label("total_booked")
            )
            .join(BookingCabin, Booking.id == BookingCabin.booking_id)
            .filter(
                Booking.sailing_id.in_(sailing_ids),
                Booking.status.in_([BookingStatusEnum.CONFIRMED, BookingStatusEnum.PENDING])
            )
            .group_by(Booking.sailing_id, BookingCabin.cabin_id)
            .all()
        )

        # Query booked passengers grouped by sailing_id
        passenger_bookings = (
            db.query(
                Booking.sailing_id,
                func.sum(Booking.total_passengers).label("total_passengers"),
                func.sum(Booking.total_vehicles).label("total_vehicles")
            )
            .filter(
                Booking.sailing_id.in_(sailing_ids),
                Booking.status.in_([BookingStatusEnum.CONFIRMED, BookingStatusEnum.PENDING])
            )
            .group_by(Booking.sailing_id)
            .all()
        )

        db.close()

        # Build lookup dictionaries
        # cabin_booked[sailing_id] = total cabins booked (simplified - all types)
        cabin_booked = {}
        for sailing_id, cabin_id, total in cabin_bookings:
            if sailing_id not in cabin_booked:
                cabin_booked[sailing_id] = 0
            cabin_booked[sailing_id] += total or 0

        # passenger_booked[sailing_id] = (passengers, vehicles)
        passenger_booked = {}
        for sailing_id, passengers, vehicles in passenger_bookings:
            passenger_booked[sailing_id] = (passengers or 0, vehicles or 0)

        # Adjust results
        for result in results:
            sailing_id = result.get("sailing_id")
            if not sailing_id:
                continue

            # Adjust cabin availability
            if sailing_id in cabin_booked:
                booked = cabin_booked[sailing_id]
                cabin_types = result.get("cabin_types", [])
                for cabin in cabin_types:
                    if cabin.get("type") not in ("deck", "seat", "reclining_seat"):
                        # Distribute booked cabins proportionally (simplified)
                        available = cabin.get("available", 0)
                        cabin["available"] = max(0, available - booked)
                        booked = max(0, booked - available)  # Carry over to next type

            # Adjust passenger/vehicle availability
            if sailing_id in passenger_booked:
                booked_pax, booked_vehicles = passenger_booked[sailing_id]

                spaces = result.get("available_spaces", {})
                if spaces:
                    spaces["passengers"] = max(0, spaces.get("passengers", 0) - booked_pax)
                    spaces["vehicles"] = max(0, spaces.get("vehicles", 0) - booked_vehicles)
                    result["available_spaces"] = spaces

        logger.info(f"📊 Adjusted availability for {len(results)} results (cabins: {len(cabin_booked)}, passengers: {len(passenger_booked)} sailings)")
        return results

    except Exception as e:
        logger.warning(f"Failed to adjust availability from bookings: {e}")
        return results


@router.post("/search", response_model=FerrySearchResponse)
async def search_ferries(
    search_params: FerrySearch
):
    """
    Search for available ferries across all operators.

    This endpoint searches all configured ferry operators for available
    sailings based on the provided search criteria.

    Results are cached for 5 minutes to improve performance.
    """
    try:
        start_time = time.time()

        # Try to get from cache first
        from app.services.cache_service import cache_service

        cache_params = {
            "departure_port": search_params.departure_port,
            "arrival_port": search_params.arrival_port,
            "departure_date": search_params.departure_date.isoformat() if search_params.departure_date else None,
            "return_date": search_params.return_date.isoformat() if search_params.return_date else None,
            "return_departure_port": search_params.return_departure_port,
            "return_arrival_port": search_params.return_arrival_port,
            "adults": search_params.adults,
            "children": search_params.children,
            "infants": search_params.infants,
            "vehicles": len(search_params.vehicles) if search_params.vehicles else 0,
            "operators": sorted(search_params.operators) if search_params.operators else None
        }

        logger.info(f"🔑 Ferry search cache key params: {cache_params}")
        cached_response = cache_service.get_ferry_search(cache_params)
        if cached_response:
            # Fix old cached data with vehicles as integer instead of list
            if cached_response.get("search_params") and isinstance(cached_response["search_params"].get("vehicles"), int):
                logger.warning(f"⚠️ Found old cache format with vehicles={cached_response['search_params']['vehicles']}, converting to list")
                cached_response["search_params"]["vehicles"] = []

            # Filter out past departures from cached results (with 1 hour buffer)
            from datetime import datetime, timedelta
            now = datetime.utcnow()
            min_departure_time = now + timedelta(hours=1)

            if cached_response.get("results"):
                filtered_cached = []
                for result in cached_response["results"]:
                    departure_time_str = result.get("departure_time")
                    if departure_time_str:
                        try:
                            if "T" in departure_time_str:
                                departure_time = datetime.fromisoformat(departure_time_str.replace("Z", "+00:00").replace("+00:00", ""))
                            else:
                                departure_time = datetime.strptime(departure_time_str, "%Y-%m-%d %H:%M:%S")
                            if departure_time >= min_departure_time:
                                filtered_cached.append(result)
                        except (ValueError, TypeError):
                            filtered_cached.append(result)
                    else:
                        filtered_cached.append(result)
                cached_response["results"] = filtered_cached
                cached_response["total_results"] = len(filtered_cached)

            # Adjust availability based on our bookings (even for cached results)
            if cached_response.get("results"):
                cached_response["results"] = await adjust_availability_from_bookings(cached_response["results"])
                cached_response["total_results"] = len(cached_response["results"])

            # Add cache hit indicator
            cached_response["cached"] = True
            cached_response["cache_age_ms"] = (time.time() - start_time) * 1000
            logger.debug(f"✅ Cache HIT for ferry search ({(time.time() - start_time)*1000:.0f}ms)")
            return FerrySearchResponse(**cached_response)

        logger.debug(f"❌ Cache MISS for ferry search - fetching from operators")

        # Cache miss - fetch from ferry operators
        results = await ferry_service.search_ferries(
            departure_port=search_params.departure_port,
            arrival_port=search_params.arrival_port,
            departure_date=search_params.departure_date,
            return_date=search_params.return_date,
            # Different return route support
            return_departure_port=search_params.return_departure_port,
            return_arrival_port=search_params.return_arrival_port,
            adults=search_params.adults,
            children=search_params.children,
            infants=search_params.infants,
            vehicles=[v.dict() for v in search_params.vehicles] if search_params.vehicles else None,
            operators=search_params.operators
        )

        search_time = (time.time() - start_time) * 1000

        # Get list of operators that were actually searched
        operators_searched = search_params.operators or ferry_service.get_available_operators()

        # Convert FerryResult objects to dictionaries for Pydantic validation
        results_dict = [result.to_dict() for result in results]

        # Filter out departures that have already passed (with 1 hour buffer for check-in)
        from datetime import datetime, timedelta
        now = datetime.utcnow()
        min_departure_time = now + timedelta(hours=1)

        filtered_results = []
        for result in results_dict:
            departure_time_str = result.get("departure_time")
            if departure_time_str:
                try:
                    # Parse departure time (handle both ISO format and datetime string)
                    if "T" in departure_time_str:
                        departure_time = datetime.fromisoformat(departure_time_str.replace("Z", "+00:00").replace("+00:00", ""))
                    else:
                        departure_time = datetime.strptime(departure_time_str, "%Y-%m-%d %H:%M:%S")

                    # Only include future departures (with 1 hour buffer)
                    if departure_time >= min_departure_time:
                        filtered_results.append(result)
                except (ValueError, TypeError) as e:
                    # If parsing fails, include the result anyway
                    logger.warning(f"Could not parse departure time '{departure_time_str}': {e}")
                    filtered_results.append(result)
            else:
                # No departure time, include anyway
                filtered_results.append(result)

        results_dict = filtered_results

        # Build response (cache RAW results before adjustment)
        # Serialize search_params dates for caching
        search_params_dict = search_params.dict()
        if search_params_dict.get("departure_date"):
            search_params_dict["departure_date"] = search_params_dict["departure_date"].isoformat()
        if search_params_dict.get("return_date"):
            search_params_dict["return_date"] = search_params_dict["return_date"].isoformat()

        response_dict = {
            "results": results_dict,  # RAW unadjusted results for caching
            "total_results": len(results_dict),
            "search_params": search_params_dict,
            "operators_searched": operators_searched,
            "search_time_ms": search_time,
            "cached": False
        }

        # Cache the RAW results (adjustment happens on read)
        # Use 15 minutes TTL - ferry schedules don't change that often
        cache_service.set_ferry_search(cache_params, response_dict, ttl=settings.CACHE_TTL_SECONDS)

        logger.info(f"💾 Cached ferry search results ({search_time:.0f}ms)")

        # Now adjust availability based on our bookings (after caching raw results)
        adjusted_results = await adjust_availability_from_bookings(results_dict)

        # Return adjusted results (not the raw cached ones)
        adjusted_response = {
            **response_dict,
            "results": adjusted_results,
            "total_results": len(adjusted_results),
        }
        return FerrySearchResponse(**adjusted_response)
        
    except FerryAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ferry search failed: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/routes", response_model=RouteResponse)
async def get_routes(
    departure_port: Optional[str] = Query(None, description="Filter by departure port"),
    arrival_port: Optional[str] = Query(None, description="Filter by arrival port"),
    operator: Optional[str] = Query(None, description="Filter by operator")
):
    """
    Get available ferry routes.

    Returns a list of all available ferry routes, optionally filtered
    by departure port, arrival port, or operator.
    """
    try:
        supported_routes = ferry_service.get_supported_routes()

        # Filter routes based on query parameters
        filtered_routes = []
        for op, routes in supported_routes.items():
            if operator and op != operator:
                continue

            for route in routes:
                if departure_port and route["departure"] != departure_port:
                    continue
                if arrival_port and route["arrival"] != arrival_port:
                    continue

                filtered_routes.append({
                    "departure_port": route["departure"],
                    "arrival_port": route["arrival"],
                    "distance_nautical_miles": None,  # Would be fetched from operator APIs
                    "estimated_duration_hours": 18.0,  # Default estimate
                    "operator": op,
                    "seasonal": False
                })

        return RouteResponse(routes=filtered_routes)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get routes: {str(e)}"
        )


@router.get("/operators")
async def get_operators():
    """
    Get list of available ferry operators.
    
    Returns information about all configured ferry operators
    including their availability status.
    """
    try:
        operators = ferry_service.get_available_operators()
        health_status = await ferry_service.check_operator_health()
        
        operator_info = []
        for operator in operators:
            operator_info.append({
                "name": operator.upper(),
                "code": operator,
                "available": health_status.get(operator, False),
                "supported_routes": len(ferry_service.get_supported_routes().get(operator, []))
            })
        
        return {
            "operators": operator_info,
            "total_operators": len(operators),
            "healthy_operators": sum(1 for status in health_status.values() if status)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get operators: {str(e)}"
        )


@router.get("/ports")
async def get_ports(
    language: str = Query("en", description="Language for port names"),
    country: Optional[str] = Query(None, description="Filter by country code (e.g., TN, FR, IT)"),
    source: str = Query("auto", description="Data source: 'db', 'api', or 'auto' (tries db first)")
):
    """
    Get list of available ports.

    Returns information about all ports available for ferry travel,
    including coordinates for map display.

    By default, uses database if available, otherwise falls back to FerryHopper API.
    Use source='api' to force fresh data from FerryHopper.
    """
    try:
        from app.database import SessionLocal
        from app.models.ferry import Port
        from app.services.ferry_integrations.ferryhopper import FerryHopperIntegration
        from app.config import settings

        ports = []
        data_source = "database"

        # Try database first if source is 'db' or 'auto'
        if source in ("db", "auto"):
            db = SessionLocal()
            try:
                query = db.query(Port).filter(Port.is_active == True)
                if country:
                    query = query.filter(Port.country_code == country.upper())
                db_ports = query.all()

                if db_ports:
                    for port in db_ports:
                        coordinates = None
                        if port.latitude and port.longitude:
                            coordinates = {
                                "lat": port.latitude,
                                "lng": port.longitude
                            }

                        ports.append({
                            "code": port.code,
                            "name": port.name,
                            "name_local": port.name_local,
                            "country": port.country,
                            "country_code": port.country_code,
                            "region": port.region,
                            "coordinates": coordinates,
                            "timezone": port.timezone,
                            "connected_ports": port.connected_ports,
                            "is_featured": port.is_featured
                        })

                    # Sort by country then name
                    ports.sort(key=lambda p: (p.get("country", ""), p.get("name", "")))
                    logger.info(f"📍 Returning {len(ports)} ports from database")
            finally:
                db.close()

        # Fallback to FerryHopper API if no ports in database or source is 'api'
        if not ports or source == "api":
            data_source = "ferryhopper_api"
            integration = FerryHopperIntegration(
                api_key=settings.FERRYHOPPER_API_KEY,
                base_url=settings.FERRYHOPPER_BASE_URL
            )

            async with integration:
                ferryhopper_ports = await integration.get_ports(language=language)

            # Transform FerryHopper port format to our format
            ports = []
            for port in ferryhopper_ports:
                # Filter by country if specified
                port_country = port.get("country", {})
                country_code = port_country.get("code", "")

                if country and country_code.upper() != country.upper():
                    continue

                # Extract coordinates
                coordinates = None
                if port.get("latitude") and port.get("longitude"):
                    coordinates = {
                        "lat": port.get("latitude"),
                        "lng": port.get("longitude")
                    }

                ports.append({
                    "code": port.get("code", ""),
                    "name": port.get("name", ""),
                    "country": port_country.get("name", "Unknown"),
                    "country_code": country_code,
                    "coordinates": coordinates,
                    "timezone": port.get("timezone"),
                    "aliases": port.get("aliases", [])
                })

            # Sort by country then name
            ports.sort(key=lambda p: (p.get("country", ""), p.get("name", "")))
            logger.info(f"📍 Returning {len(ports)} ports from FerryHopper API")

        return {
            "ports": ports,
            "total": len(ports),
            "source": data_source
        }

    except Exception as e:
        logger.error(f"Failed to get ports: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get ports: {str(e)}"
        )


@router.get("/ports/tunisia")
async def get_tunisia_routes(
    source: str = Query("auto", description="Data source: 'db', 'api', or 'auto'")
):
    """
    Get ports for Tunisia routes (from France and Italy).

    Returns ports relevant for Tunisia ferry routes:
    - Tunisia ports (Tunis, La Goulette)
    - France ports (Marseille)
    - Italy ports (Genoa, Civitavecchia, Palermo, etc.)
    """
    try:
        from app.database import SessionLocal
        from app.models.ferry import Port
        from app.services.ferry_integrations.ferryhopper import FerryHopperIntegration
        from app.config import settings

        relevant_countries = {"TN", "FR", "IT"}
        filtered_ports = []
        data_source = "database"

        # Try database first if source is 'db' or 'auto'
        if source in ("db", "auto"):
            db = SessionLocal()
            try:
                db_ports = db.query(Port).filter(
                    Port.is_active == True,
                    Port.country_code.in_(relevant_countries)
                ).all()

                if db_ports:
                    for port in db_ports:
                        coordinates = None
                        if port.latitude and port.longitude:
                            coordinates = {
                                "lat": port.latitude,
                                "lng": port.longitude
                            }

                        filtered_ports.append({
                            "code": port.code,
                            "name": port.name,
                            "country": port.country,
                            "country_code": port.country_code,
                            "coordinates": coordinates,
                            "connected_ports": port.connected_ports
                        })
            finally:
                db.close()

        # Fallback to FerryHopper API if no ports in database or source is 'api'
        if not filtered_ports or source == "api":
            data_source = "ferryhopper_api"
            integration = FerryHopperIntegration(
                api_key=settings.FERRYHOPPER_API_KEY,
                base_url=settings.FERRYHOPPER_BASE_URL
            )

            async with integration:
                all_ports = await integration.get_ports(language="en")

            filtered_ports = []
            for port in all_ports:
                country_code = port.get("country", {}).get("code", "")
                if country_code in relevant_countries:
                    coordinates = None
                    if port.get("latitude") and port.get("longitude"):
                        coordinates = {
                            "lat": port.get("latitude"),
                            "lng": port.get("longitude")
                        }

                    filtered_ports.append({
                        "code": port.get("code", ""),
                        "name": port.get("name", ""),
                        "country": port.get("country", {}).get("name", "Unknown"),
                        "country_code": country_code,
                        "coordinates": coordinates
                    })

        # Group by country
        result = {
            "tunisia": [p for p in filtered_ports if p["country_code"] == "TN"],
            "france": [p for p in filtered_ports if p["country_code"] == "FR"],
            "italy": [p for p in filtered_ports if p["country_code"] == "IT"],
            "total": len(filtered_ports),
            "source": data_source
        }

        logger.info(f"📍 Tunisia routes: {len(result['tunisia'])} TN, {len(result['france'])} FR, {len(result['italy'])} IT ports (source: {data_source})")
        return result

    except Exception as e:
        logger.error(f"Failed to get Tunisia route ports: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get ports: {str(e)}"
        )


@router.post("/ports/sync")
async def sync_ports():
    """
    Trigger port synchronization from FerryHopper API.

    This endpoint manually triggers the port sync task which:
    - Fetches all ports from FerryHopper API
    - Creates or updates ports in the database
    - Updates sync metadata

    Note: This runs as a Celery background task.
    """
    try:
        from app.tasks.ferryhopper_sync_tasks import sync_ports_from_ferryhopper_task

        # Trigger the sync task asynchronously
        task = sync_ports_from_ferryhopper_task.delay()

        logger.info(f"📍 Port sync task triggered: {task.id}")

        return {
            "status": "started",
            "task_id": task.id,
            "message": "Port sync task has been triggered. Check task status for progress."
        }

    except Exception as e:
        logger.error(f"Failed to trigger port sync: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger port sync: {str(e)}"
        )


@router.get("/vehicles")
async def get_vehicles(
    language: str = Query("en", description="Language for descriptions")
):
    """
    Get list of vehicle types from FerryHopper API.

    Returns all vehicle types supported for ferry bookings
    (cars, motorcycles, campers, etc.)
    """
    try:
        from app.services.ferry_integrations.ferryhopper import FerryHopperIntegration
        from app.config import settings

        integration = FerryHopperIntegration(
            api_key=settings.FERRYHOPPER_API_KEY,
            base_url=settings.FERRYHOPPER_BASE_URL
        )

        async with integration:
            vehicles = await integration.get_vehicles(language=language)

        logger.info(f"🚗 Returning {len(vehicles)} vehicle types from FerryHopper API")
        return vehicles

    except Exception as e:
        logger.error(f"Failed to get vehicles from FerryHopper: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get vehicles: {str(e)}"
        )


@router.get("/accommodations")
async def get_accommodations():
    """
    Get list of accommodation types from FerryHopper API.

    Returns all accommodation types (deck, seat, cabin types, etc.)
    """
    try:
        from app.services.ferry_integrations.ferryhopper import FerryHopperIntegration
        from app.config import settings

        integration = FerryHopperIntegration(
            api_key=settings.FERRYHOPPER_API_KEY,
            base_url=settings.FERRYHOPPER_BASE_URL
        )

        async with integration:
            accommodations = await integration.get_accommodations()

        logger.info(f"🛏️ Returning {len(accommodations)} accommodation types from FerryHopper API")
        return accommodations

    except Exception as e:
        logger.error(f"Failed to get accommodations from FerryHopper: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get accommodations: {str(e)}"
        )


@router.get("/companies")
async def get_ferry_companies():
    """
    Get list of ferry companies/operators from FerryHopper API.

    Returns all ferry operators available through FerryHopper
    (CTN, GNV, Grimaldi, Blue Star, etc.)
    """
    try:
        from app.services.ferry_integrations.ferryhopper import FerryHopperIntegration
        from app.config import settings

        integration = FerryHopperIntegration(
            api_key=settings.FERRYHOPPER_API_KEY,
            base_url=settings.FERRYHOPPER_BASE_URL
        )

        async with integration:
            companies = await integration.get_companies()

        logger.info(f"🚢 Returning {len(companies)} ferry companies from FerryHopper API")
        return companies

    except Exception as e:
        logger.error(f"Failed to get companies from FerryHopper: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get companies: {str(e)}"
        )


@router.get("/active-ferries")
async def get_active_ferries():
    """
    Get list of ferries currently in transit (simulated).

    Returns ferries that have departed but not yet arrived,
    along with route definitions for map display.
    """
    from datetime import timedelta
    import random

    # Port coordinates for reference
    port_coords = {
        "TUNIS": {"lat": 36.8065, "lng": 10.1815},
        "SFAX": {"lat": 34.7478, "lng": 10.7661},
        "ZARZIS": {"lat": 33.5036, "lng": 11.1117},
        "GENOA": {"lat": 44.4056, "lng": 8.9463},
        "CIVITAVECCHIA": {"lat": 42.0930, "lng": 11.7969},
        "PALERMO": {"lat": 38.1157, "lng": 13.3615},
        "TRAPANI": {"lat": 38.0174, "lng": 12.5365},
        "NAPLES": {"lat": 40.8518, "lng": 14.2681},
        "LIVORNO": {"lat": 43.5485, "lng": 10.3106},
        "SALERNO": {"lat": 40.6824, "lng": 14.7681},
        "MARSEILLE": {"lat": 43.2965, "lng": 5.3698},
        "NICE": {"lat": 43.7102, "lng": 7.2620},
        "TOULON": {"lat": 43.1242, "lng": 5.9280},
        "ALGIERS": {"lat": 36.7538, "lng": 3.0588},
        "BARCELONA": {"lat": 41.3851, "lng": 2.1734},
    }

    # Real vessel data with MMSI numbers for live tracking
    # MMSI (Maritime Mobile Service Identity) is used for AIS tracking
    vessel_registry = {
        "TANIT": {"mmsi": "672748000", "imo": "9598579", "operator": "CTN"},
        "CARTHAGE": {"mmsi": "672266000", "imo": "9138528", "operator": "CTN"},
        "AMILCAR": {"mmsi": "672295000", "imo": "7907429", "operator": "CTN"},
        "LA SUPERBA": {"mmsi": "247039700", "imo": "9224963", "operator": "GNV"},
        "SPLENDID": {"mmsi": "247111500", "imo": "9230428", "operator": "GNV"},
        "EXCELLENT": {"mmsi": "247039500", "imo": "9208402", "operator": "GNV"},
        "MEDITERRANEE": {"mmsi": "226443000", "imo": "7907417", "operator": "Corsica Linea"},
    }

    # Define ferry routes with typical durations
    ferry_routes = [
        {"departure": "TUNIS", "arrival": "GENOA", "duration_hours": 24, "operator": "CTN", "vessel": "CARTHAGE"},
        {"departure": "TUNIS", "arrival": "MARSEILLE", "duration_hours": 21, "operator": "CTN", "vessel": "TANIT"},
        {"departure": "GENOA", "arrival": "TUNIS", "duration_hours": 24, "operator": "GNV", "vessel": "LA SUPERBA"},
        {"departure": "MARSEILLE", "arrival": "TUNIS", "duration_hours": 21, "operator": "Corsica Linea", "vessel": "MEDITERRANEE"},
        {"departure": "PALERMO", "arrival": "TUNIS", "duration_hours": 11, "operator": "GNV", "vessel": "SPLENDID"},
        {"departure": "TUNIS", "arrival": "CIVITAVECCHIA", "duration_hours": 16, "operator": "CTN", "vessel": "AMILCAR"},
        {"departure": "CIVITAVECCHIA", "arrival": "TUNIS", "duration_hours": 16, "operator": "GNV", "vessel": "EXCELLENT"},
        {"departure": "TUNIS", "arrival": "PALERMO", "duration_hours": 11, "operator": "CTN", "vessel": "CARTHAGE"},
    ]

    # Generate simulated active ferries based on current time
    now = datetime.utcnow()
    active_ferries = []

    # Simulate some ferries that departed at various times and are now in transit
    for i, route in enumerate(ferry_routes):
        # Stagger departures so some ferries are always in transit
        hours_ago = (i * 3) % 24  # Spread departures throughout the day
        departure_time = now - timedelta(hours=hours_ago)
        arrival_time = departure_time + timedelta(hours=route["duration_hours"])

        # Only include if ferry is currently in transit (departed but not arrived)
        if departure_time <= now < arrival_time:
            dep_port = route["departure"]
            arr_port = route["arrival"]
            vessel_info = vessel_registry.get(route["vessel"], {})

            active_ferries.append({
                "ferry_id": f"{route['operator'][:3]}-{i+1:03d}",
                "vessel_name": route["vessel"],
                "operator": route["operator"],
                "mmsi": vessel_info.get("mmsi"),
                "imo": vessel_info.get("imo"),
                "departure_port": dep_port,
                "arrival_port": arr_port,
                "departure_time": departure_time.isoformat() + "Z",
                "arrival_time": arrival_time.isoformat() + "Z",
                "departure_coordinates": port_coords.get(dep_port, {"lat": 0, "lng": 0}),
                "arrival_coordinates": port_coords.get(arr_port, {"lat": 0, "lng": 0}),
                "route_duration_hours": route["duration_hours"]
            })

    # Define all routes for map display (lines between ports)
    routes_for_map = [
        {"from": "TUNIS", "to": "GENOA", "from_coords": port_coords["TUNIS"], "to_coords": port_coords["GENOA"]},
        {"from": "TUNIS", "to": "MARSEILLE", "from_coords": port_coords["TUNIS"], "to_coords": port_coords["MARSEILLE"]},
        {"from": "TUNIS", "to": "CIVITAVECCHIA", "from_coords": port_coords["TUNIS"], "to_coords": port_coords["CIVITAVECCHIA"]},
        {"from": "TUNIS", "to": "PALERMO", "from_coords": port_coords["TUNIS"], "to_coords": port_coords["PALERMO"]},
        {"from": "TUNIS", "to": "TRAPANI", "from_coords": port_coords["TUNIS"], "to_coords": port_coords["TRAPANI"]},
        {"from": "TUNIS", "to": "NAPLES", "from_coords": port_coords["TUNIS"], "to_coords": port_coords["NAPLES"]},
        {"from": "TUNIS", "to": "LIVORNO", "from_coords": port_coords["TUNIS"], "to_coords": port_coords["LIVORNO"]},
        {"from": "SFAX", "to": "TRAPANI", "from_coords": port_coords["SFAX"], "to_coords": port_coords["TRAPANI"]},
        {"from": "ZARZIS", "to": "TRAPANI", "from_coords": port_coords["ZARZIS"], "to_coords": port_coords["TRAPANI"]},
    ]

    return {
        "ferries": active_ferries,
        "timestamp": now.isoformat() + "Z",
        "routes": routes_for_map,
        "ports": port_coords,
        "vessel_registry": vessel_registry  # Include for real tracking
    }


@router.get("/vessel-position/{mmsi}")
async def get_vessel_position(mmsi: str):
    """
    Get real-time vessel position from AIS data.

    Uses MMSI (Maritime Mobile Service Identity) to fetch live position.
    Falls back to MarineTraffic embed URL if API is unavailable.
    """
    import httpx
    import os

    # Vessel registry for validation
    valid_vessels = {
        "672748000": {"name": "TANIT", "imo": "9598579"},
        "672266000": {"name": "CARTHAGE", "imo": "9138528"},
        "672295000": {"name": "AMILCAR", "imo": "7907429"},
        "247039700": {"name": "LA SUPERBA", "imo": "9224963"},
        "247111500": {"name": "SPLENDID", "imo": "9230428"},
        "247039500": {"name": "EXCELLENT", "imo": "9208402"},
        "226443000": {"name": "MEDITERRANEE", "imo": "7907417"},
    }

    if mmsi not in valid_vessels:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown vessel MMSI: {mmsi}"
        )

    vessel_info = valid_vessels[mmsi]

    # Try to get real position from AIS API (if configured)
    ais_api_key = os.environ.get("AIS_API_KEY")

    if ais_api_key:
        try:
            async with httpx.AsyncClient() as client:
                # Example: VesselFinder API or MarineTraffic API
                response = await client.get(
                    f"https://api.vesselfinder.com/vesselslist",
                    params={"userkey": ais_api_key, "mmsi": mmsi},
                    timeout=10.0
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("AIS"):
                        ais_data = data["AIS"][0]
                        return {
                            "mmsi": mmsi,
                            "vessel_name": vessel_info["name"],
                            "imo": vessel_info["imo"],
                            "position": {
                                "lat": ais_data.get("LATITUDE"),
                                "lng": ais_data.get("LONGITUDE")
                            },
                            "speed": ais_data.get("SPEED"),
                            "course": ais_data.get("COURSE"),
                            "heading": ais_data.get("HEADING"),
                            "timestamp": ais_data.get("TIMESTAMP"),
                            "status": ais_data.get("NAVSTAT"),
                            "source": "live_ais"
                        }
        except Exception as e:
            logger.warning(f"Failed to fetch AIS data for {mmsi}: {e}")

    # Return embed URL for MarineTraffic widget (free alternative)
    return {
        "mmsi": mmsi,
        "vessel_name": vessel_info["name"],
        "imo": vessel_info["imo"],
        "position": None,  # No real position available without API
        "marine_traffic_url": f"https://www.marinetraffic.com/en/ais/details/ships/mmsi:{mmsi}",
        "vessel_finder_url": f"https://www.vesselfinder.com/vessels?mmsi={mmsi}",
        "embed_url": f"https://www.marinetraffic.com/en/ais/embed/zoom:8/centery:38/centerx:10/maptype:0/shownames:true/mmsi:{mmsi}",
        "source": "simulated",
        "message": "Set AIS_API_KEY environment variable for real-time tracking"
    }


@router.get("/health", response_model=HealthCheckResponse)
async def check_ferry_apis():
    """
    Check health status of all ferry operator APIs.
    
    This endpoint checks the availability and response time of all
    configured ferry operator APIs.
    """
    try:
        health_checks = await ferry_service.check_operator_health()
        
        operator_statuses = []
        for operator, is_healthy in health_checks.items():
            operator_statuses.append(OperatorStatus(
                operator=operator,
                available=is_healthy,
                last_checked=datetime.now(),
                error_message=None if is_healthy else "API unavailable"
            ))
        
        healthy_count = sum(1 for status in health_checks.values() if status)
        overall_status = "healthy" if healthy_count > 0 else "unhealthy"
        
        return HealthCheckResponse(
            status=overall_status,
            operators=operator_statuses,
            total_operators=len(health_checks),
            healthy_operators=healthy_count
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Health check failed: {str(e)}"
        )


@router.get("/compare-prices", response_model=PriceComparison)
async def compare_prices(
    departure_port: str = Query(..., description="Departure port code"),
    arrival_port: str = Query(..., description="Arrival port code"),
    departure_date: date = Query(..., description="Departure date"),
    adults: int = Query(1, description="Number of adults"),
    children: int = Query(0, description="Number of children"),
    infants: int = Query(0, description="Number of infants")
):
    """
    Compare prices across all ferry operators for a specific route.
    
    This endpoint searches all operators for the given route and date,
    then returns a comparison of prices and options.
    """
    try:
        operator_results = await ferry_service.compare_prices(
            departure_port=departure_port,
            arrival_port=arrival_port,
            departure_date=departure_date,
            adults=adults,
            children=children,
            infants=infants
        )
        
        # Find cheapest option
        cheapest_option = await ferry_service.get_cheapest_option(
            departure_port=departure_port,
            arrival_port=arrival_port,
            departure_date=departure_date,
            adults=adults,
            children=children,
            infants=infants
        )
        
        # Calculate price range
        all_results = []
        for results in operator_results.values():
            all_results.extend(results)
        
        price_range = None
        if all_results:
            prices = []
            for result in all_results:
                total_price = (
                    result.prices.get("adult", 0) * adults +
                    result.prices.get("child", 0) * children +
                    result.prices.get("infant", 0) * infants
                )
                prices.append(total_price)
            
            price_range = {
                "min": min(prices),
                "max": max(prices),
                "average": sum(prices) / len(prices)
            }
        
        route_name = f"{departure_port} - {arrival_port}"
        
        return PriceComparison(
            route=route_name,
            departure_date=departure_date,
            cheapest_option=cheapest_option,
            operator_results=operator_results,
            price_range=price_range
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Price comparison failed: {str(e)}"
        )


@router.get("/date-prices")
async def get_date_prices(
    departure_port: str = Query(..., description="Departure port code"),
    arrival_port: str = Query(..., description="Arrival port code"),
    center_date: date = Query(..., description="Center date to search around"),
    days_before: int = Query(3, ge=0, le=15, description="Days before center date"),
    days_after: int = Query(3, ge=0, le=15, description="Days after center date"),
    adults: int = Query(1, description="Number of adults"),
    children: int = Query(0, description="Number of children"),
    infants: int = Query(0, description="Number of infants"),
    return_date: Optional[date] = Query(None, description="Optional return date for round-trip context")
):
    """
    Get lowest prices for dates around a center date.

    This endpoint returns the lowest available price for each date
    in a range around the specified center date. Perfect for displaying
    a price calendar or date selector.

    Returns price information for each date including:
    - Date
    - Lowest price available
    - Number of ferry options
    - Availability status
    """
    try:
        from datetime import timedelta
        from app.services.cache_service import cache_service

        # Check cache first (short TTL to balance performance vs freshness)
        cache_params = {
            "departure_port": departure_port,
            "arrival_port": arrival_port,
            "center_date": center_date.isoformat(),
            "days_before": days_before,
            "days_after": days_after,
            "adults": adults,
            "children": children,
            "infants": infants,
            "return_date": return_date.isoformat() if return_date else None
        }

        cached_result = cache_service.get_date_prices(cache_params)
        if cached_result:
            logger.info(f"✅ Returning cached date prices for {departure_port}→{arrival_port}")
            return cached_result

        trip_type = f"round-trip (return: {return_date.isoformat()})" if return_date else "one-way"
        logger.info(f"🔍 Fetching date prices for {departure_port}→{arrival_port} on {center_date} ({trip_type}, A:{adults}, C:{children}, I:{infants})")

        import asyncio

        start_date = center_date - timedelta(days=days_before)
        end_date = center_date + timedelta(days=days_after)

        # Generate list of dates to search
        dates_to_search = []
        current_date = start_date
        while current_date <= end_date:
            dates_to_search.append(current_date)
            current_date += timedelta(days=1)

        async def search_single_date(search_date: date) -> dict:
            """Search ferries for a single date and return date price info."""
            try:
                # Try to get cached ferry search results first (5-min cache)
                ferry_search_cache_params = {
                    "departure_port": departure_port,
                    "arrival_port": arrival_port,
                    "departure_date": search_date.isoformat(),
                    "return_date": return_date.isoformat() if return_date else None,
                    "return_departure_port": None,
                    "return_arrival_port": None,
                    "adults": adults,
                    "children": children,
                    "infants": infants,
                    "vehicles": 0,
                    "operators": None
                }

                cached_ferry_results = cache_service.get_ferry_search(ferry_search_cache_params)

                if cached_ferry_results:
                    results = [FerryResult(**r) for r in cached_ferry_results.get("results", [])]
                    logger.debug(f"  ✅ Calendar cache HIT for {search_date.isoformat()}")
                else:
                    results = await ferry_service.search_ferries(
                        departure_port=departure_port,
                        arrival_port=arrival_port,
                        departure_date=search_date,
                        return_date=return_date,
                        adults=adults,
                        children=children,
                        infants=infants
                    )
                    logger.debug(f"  ❌ Calendar cache MISS for {search_date.isoformat()}")

                    # Cache results
                    if results:
                        results_dict = [r.to_dict() for r in results]
                        search_params_for_response = {
                            "departure_port": departure_port,
                            "arrival_port": arrival_port,
                            "departure_date": search_date.isoformat(),
                            "return_date": return_date.isoformat() if return_date else None,
                            "return_departure_port": None,
                            "return_arrival_port": None,
                            "adults": adults,
                            "children": children,
                            "infants": infants,
                            "vehicles": [],
                            "operators": None,
                            "passengers": None
                        }
                        cache_response = {
                            "results": results_dict,
                            "search_params": search_params_for_response,
                            "operators_searched": list(set([r.operator for r in results])),
                            "total_results": len(results),
                            "search_time_ms": 0,
                            "cached": False
                        }
                        cache_service.set_ferry_search(ferry_search_cache_params, cache_response, ttl=settings.CACHE_TTL_SECONDS)

                if results:
                    lowest_price = None
                    for result in results:
                        adult_price = result.prices.get("adult", 0)
                        if adult_price > 0:
                            if lowest_price is None or adult_price < lowest_price:
                                lowest_price = adult_price

                    return {
                        "date": search_date.isoformat(),
                        "day_of_week": search_date.strftime("%a"),
                        "day_of_month": search_date.day,
                        "month": search_date.strftime("%b"),
                        "lowest_price": round(lowest_price, 2) if lowest_price else None,
                        "available": True,
                        "num_ferries": len(results),
                        "is_center_date": search_date == center_date
                    }
                else:
                    return {
                        "date": search_date.isoformat(),
                        "day_of_week": search_date.strftime("%a"),
                        "day_of_month": search_date.day,
                        "month": search_date.strftime("%b"),
                        "lowest_price": None,
                        "available": False,
                        "num_ferries": 0,
                        "is_center_date": search_date == center_date
                    }
            except Exception as e:
                logger.warning(f"Error searching date {search_date}: {e}")
                return {
                    "date": search_date.isoformat(),
                    "day_of_week": search_date.strftime("%a"),
                    "day_of_month": search_date.day,
                    "month": search_date.strftime("%b"),
                    "lowest_price": None,
                    "available": False,
                    "num_ferries": 0,
                    "is_center_date": search_date == center_date
                }

        # Search all dates in parallel for much faster response
        logger.info(f"🚀 Calendar searching {len(dates_to_search)} dates in parallel...")
        search_start = time.time()
        date_prices = await asyncio.gather(*[search_single_date(d) for d in dates_to_search])
        search_duration = (time.time() - search_start) * 1000
        logger.info(f"✅ Calendar search completed in {search_duration:.0f}ms for {len(dates_to_search)} dates")

        # Sort by date to ensure correct order
        date_prices = sorted(date_prices, key=lambda x: x["date"])

        response = {
            "route": {
                "departure_port": departure_port,
                "arrival_port": arrival_port
            },
            "center_date": center_date.isoformat(),
            "date_prices": date_prices,
            "total_dates": len(date_prices)
        }

        # Cache for 15 minutes to match ferry_search cache TTL
        # Individual dates check ferry_search cache first, so prices will be consistent
        # This whole response cache prevents re-querying when toggling week/month view
        cache_service.set_date_prices(cache_params, response, ttl=settings.CACHE_TTL_SECONDS)

        return response

    except Exception as e:
        logger.error(f"Date prices endpoint error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get date prices: {str(e)}"
        )


@router.get("/schedules")
async def get_schedules(
    departure_port: str = Query(..., description="Departure port code"),
    arrival_port: str = Query(..., description="Arrival port code"),
    date_from: date = Query(..., description="Start date for schedule"),
    date_to: Optional[date] = Query(None, description="End date for schedule"),
    operator: Optional[str] = Query(None, description="Filter by operator")
):
    """
    Get ferry schedules for a specific route and date range.
    
    Returns available ferry schedules for the specified route,
    optionally filtered by operator.
    """
    try:
        # If no end date specified, search for 7 days
        if not date_to:
            from datetime import timedelta
            date_to = date_from + timedelta(days=7)
        
        # Search for each date in the range
        all_schedules = []
        current_date = date_from
        
        while current_date <= date_to:
            results = await ferry_service.search_ferries(
                departure_port=departure_port,
                arrival_port=arrival_port,
                departure_date=current_date,
                adults=1,  # Minimum search
                operators=[operator] if operator else None
            )
            
            for result in results:
                all_schedules.append({
                    "sailing_id": result.sailing_id,
                    "departure_time": result.departure_time,
                    "arrival_time": result.arrival_time,
                    "vessel_name": result.vessel_name,
                    "operator": result.operator,
                    "available_passengers": result.available_spaces.get("passengers", 0),
                    "available_vehicles": result.available_spaces.get("vehicles", 0),
                    "prices": result.prices
                })
            
            from datetime import timedelta
            current_date += timedelta(days=1)
        
        return {
            "schedules": all_schedules,
            "route": {
                "departure_port": departure_port,
                "arrival_port": arrival_port,
                "date_from": date_from,
                "date_to": date_to
            },
            "total_sailings": len(all_schedules)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get schedules: {str(e)}"
        ) 