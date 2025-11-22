"""
Ferry API endpoints for searching ferries, routes, and schedules.
"""

import time
import logging
from typing import List, Optional
from datetime import datetime, date

logger = logging.getLogger(__name__)

try:
    from fastapi import APIRouter, Depends, HTTPException, status, Query
    from sqlalchemy.orm import Session
except ImportError:
    # Fallback for development
    class APIRouter:
        def __init__(self, *args, **kwargs):
            pass
        def get(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
        def post(self, *args, **kwargs):
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
    
    def Query(*args, **kwargs):
        return None
    
    class Session:
        pass

try:
    from app.api.deps import get_db, get_optional_current_user, get_common_params
    from app.schemas.ferry import (
        FerrySearch, FerrySearchResponse, FerryResult,
        RouteResponse, ScheduleResponse, HealthCheckResponse,
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
    search_params: FerrySearch,
    db: Session = Depends(get_db),
    current_user = Depends(get_optional_current_user)
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
            "departure_date": search_params.departure_date,
            "return_date": search_params.return_date,
            "return_departure_port": search_params.return_departure_port,
            "return_arrival_port": search_params.return_arrival_port,
            "adults": search_params.adults,
            "children": search_params.children,
            "infants": search_params.infants,
            "vehicles": len(search_params.vehicles) if search_params.vehicles else 0,
            "operators": sorted(search_params.operators) if search_params.operators else None
        }

        cached_response = cache_service.get_ferry_search(cache_params)
        if cached_response:
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

        # Build response
        response_dict = {
            "results": results_dict,
            "total_results": len(results),
            "search_params": search_params.dict(),
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
    operator: Optional[str] = Query(None, description="Filter by operator"),
    db: Session = Depends(get_db)
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
    infants: int = Query(0, description="Number of infants"),
    db: Session = Depends(get_db)
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


@router.get("/schedules")
async def get_schedules(
    departure_port: str = Query(..., description="Departure port code"),
    arrival_port: str = Query(..., description="Arrival port code"),
    date_from: date = Query(..., description="Start date for schedule"),
    date_to: Optional[date] = Query(None, description="End date for schedule"),
    operator: Optional[str] = Query(None, description="Filter by operator"),
    db: Session = Depends(get_db)
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