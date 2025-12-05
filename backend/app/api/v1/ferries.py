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

            # Add cache hit indicator
            cached_response["cached"] = True
            cached_response["cache_age_ms"] = (time.time() - start_time) * 1000
            logger.info(f"✅ Cache HIT for ferry search ({(time.time() - start_time)*1000:.0f}ms)")
            return FerrySearchResponse(**cached_response)

        logger.info(f"❌ Cache MISS for ferry search - fetching from operators")

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

        # Build response
        # Serialize search_params dates for caching
        search_params_dict = search_params.dict()
        if search_params_dict.get("departure_date"):
            search_params_dict["departure_date"] = search_params_dict["departure_date"].isoformat()
        if search_params_dict.get("return_date"):
            search_params_dict["return_date"] = search_params_dict["return_date"].isoformat()

        response_dict = {
            "results": results_dict,
            "total_results": len(results_dict),  # Use filtered count
            "search_params": search_params_dict,
            "operators_searched": operators_searched,
            "search_time_ms": search_time,
            "cached": False
        }

        # Cache the results for 5 minutes (300 seconds)
        cache_service.set_ferry_search(cache_params, response_dict, ttl=300)
        logger.info(f"💾 Cached ferry search results ({search_time:.0f}ms)")

        return FerrySearchResponse(**response_dict)
        
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
async def get_ports():
    """
    Get list of available ports.

    Returns information about all ports available for ferry travel.
    """
    try:
        supported_routes = ferry_service.get_supported_routes()

        # Collect unique ports from all routes
        ports_set = set()
        for operator, routes in supported_routes.items():
            for route in routes:
                ports_set.add(route["departure"])
                ports_set.add(route["arrival"])

        # Port information mapping
        port_info = {
            "TUN": {"code": "TUN", "name": "Tunis", "country": "Tunisia"},
            "TUNIS": {"code": "TUNIS", "name": "Tunis", "country": "Tunisia"},
            "MRS": {"code": "MRS", "name": "Marseille", "country": "France"},
            "MARSEILLE": {"code": "MARSEILLE", "name": "Marseille", "country": "France"},
            "GEN": {"code": "GEN", "name": "Genoa", "country": "Italy"},
            "GENOA": {"code": "GENOA", "name": "Genoa", "country": "Italy"},
            "CIV": {"code": "CIV", "name": "Civitavecchia", "country": "Italy"},
            "CIVITAVECCHIA": {"code": "CIVITAVECCHIA", "name": "Civitavecchia", "country": "Italy"},
            "PAL": {"code": "PAL", "name": "Palermo", "country": "Italy"},
            "PALERMO": {"code": "PALERMO", "name": "Palermo", "country": "Italy"},
            "NAP": {"code": "NAP", "name": "Naples", "country": "Italy"},
            "NAPLES": {"code": "NAPLES", "name": "Naples", "country": "Italy"},
            "LIV": {"code": "LIV", "name": "Livorno", "country": "Italy"},
            "LIVORNO": {"code": "LIVORNO", "name": "Livorno", "country": "Italy"},
            "SAL": {"code": "SAL", "name": "Salerno", "country": "Italy"},
            "SALERNO": {"code": "SALERNO", "name": "Salerno", "country": "Italy"},
            "ALG": {"code": "ALG", "name": "Algiers", "country": "Algeria"},
            "BAR": {"code": "BAR", "name": "Barcelona", "country": "Spain"},
            "BARCELONA": {"code": "BARCELONA", "name": "Barcelona", "country": "Spain"},
            "NICE": {"code": "NICE", "name": "Nice", "country": "France"},
        }

        ports = []
        for port_code in sorted(ports_set):
            if port_code in port_info:
                ports.append(port_info[port_code])
            else:
                # Default for unknown ports
                ports.append({
                    "code": port_code,
                    "name": port_code.title(),
                    "country": "Unknown"
                })

        return ports

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get ports: {str(e)}"
        )


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

        date_prices = []
        start_date = center_date - timedelta(days=days_before)
        end_date = center_date + timedelta(days=days_after)

        current_date = start_date
        while current_date <= end_date:
            try:
                # Try to get cached ferry search results first (5-min cache)
                # This ensures calendar prices match the ferry list when both use cache
                # Note: cache key uses integer for vehicles count
                ferry_search_cache_params = {
                    "departure_port": departure_port,
                    "arrival_port": arrival_port,
                    "departure_date": current_date.isoformat(),
                    "return_date": return_date.isoformat() if return_date else None,
                    "return_departure_port": None,
                    "return_arrival_port": None,
                    "adults": adults,
                    "children": children,
                    "infants": infants,
                    "vehicles": 0,  # Integer count for cache key
                    "operators": None
                }

                cached_ferry_results = cache_service.get_ferry_search(ferry_search_cache_params)

                if cached_ferry_results:
                    # Use cached results from ferry search
                    results = [FerryResult(**r) for r in cached_ferry_results.get("results", [])]
                    logger.info(f"  ✅ Calendar using cached ferry_search for {current_date.isoformat()} ({len(results)} ferries)")
                else:
                    # Cache miss - query operators directly
                    # Pass return_date to get round-trip context pricing (if applicable)
                    results = await ferry_service.search_ferries(
                        departure_port=departure_port,
                        arrival_port=arrival_port,
                        departure_date=current_date,
                        return_date=return_date,  # Include return context for accurate pricing
                        adults=adults,
                        children=children,
                        infants=infants
                    )
                    logger.info(f"  ❌ Calendar queried operators for {current_date.isoformat()} ({len(results) if results else 0} ferries)")

                    # Cache these results in ferry_search cache so subsequent searches use same data
                    if results:
                        results_dict = [r.to_dict() for r in results]

                        # Build search_params dict matching FerrySearch schema
                        search_params_for_response = {
                            "departure_port": departure_port,
                            "arrival_port": arrival_port,
                            "departure_date": current_date.isoformat(),
                            "return_date": return_date.isoformat() if return_date else None,
                            "return_departure_port": None,
                            "return_arrival_port": None,
                            "adults": adults,
                            "children": children,
                            "infants": infants,
                            "vehicles": [],  # List for response schema
                            "operators": None,
                            "passengers": None
                        }

                        cache_response = {
                            "results": results_dict,
                            "search_params": search_params_for_response,
                            "operators_searched": list(set([r.operator for r in results])),
                            "total_results": len(results),
                            "search_time_ms": 0,  # Already searched
                            "cached": False
                        }
                        cache_service.set_ferry_search(ferry_search_cache_params, cache_response, ttl=300)
                        logger.info(f"  💾 Calendar cached ferry_search for {current_date.isoformat()} (TTL: 5min)")

                if results:
                    # Calculate lowest per-adult price (to match results display)
                    lowest_price = None
                    prices_found = []
                    for result in results:
                        adult_price = result.prices.get("adult", 0)
                        if adult_price > 0:
                            prices_found.append(adult_price)
                            if lowest_price is None or adult_price < lowest_price:
                                lowest_price = adult_price

                    # Debug logging
                    if current_date.day == 1:  # Log for Dec 1 specifically
                        logger.info(f"🔍 Date {current_date.isoformat()}: Found {len(results)} ferries")
                        logger.info(f"   Adult prices: {prices_found}")
                        logger.info(f"   Lowest: €{lowest_price}")

                    date_prices.append({
                        "date": current_date.isoformat(),
                        "day_of_week": current_date.strftime("%a"),
                        "day_of_month": current_date.day,
                        "month": current_date.strftime("%b"),
                        "lowest_price": round(lowest_price, 2) if lowest_price else None,
                        "available": True,
                        "num_ferries": len(results),
                        "is_center_date": current_date == center_date
                    })
                else:
                    # No ferries available
                    date_prices.append({
                        "date": current_date.isoformat(),
                        "day_of_week": current_date.strftime("%a"),
                        "day_of_month": current_date.day,
                        "month": current_date.strftime("%b"),
                        "lowest_price": None,
                        "available": False,
                        "num_ferries": 0,
                        "is_center_date": current_date == center_date
                    })
            except Exception as e:
                logger.warning(f"Error searching date {current_date}: {e}")
                # Add as unavailable
                date_prices.append({
                    "date": current_date.isoformat(),
                    "day_of_week": current_date.strftime("%a"),
                    "day_of_month": current_date.day,
                    "month": current_date.strftime("%b"),
                    "lowest_price": None,
                    "available": False,
                    "num_ferries": 0,
                    "is_center_date": current_date == center_date
                })

            current_date += timedelta(days=1)

        response = {
            "route": {
                "departure_port": departure_port,
                "arrival_port": arrival_port
            },
            "center_date": center_date.isoformat(),
            "date_prices": date_prices,
            "total_dates": len(date_prices)
        }

        # Cache for 5 minutes to match ferry_search cache TTL
        # Individual dates check ferry_search cache first, so prices will be consistent
        # This whole response cache prevents re-querying when toggling week/month view
        cache_service.set_date_prices(cache_params, response, ttl=300)

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