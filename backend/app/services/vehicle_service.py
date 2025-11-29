"""
Vehicle data service for retrieving vehicle information.
"""
import requests
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.vehicle import VehicleMake, VehicleModel

logger = logging.getLogger(__name__)


class VehicleDataService:
    """Service for fetching vehicle data from external APIs and database."""

    def __init__(self):
        # CarQuery API (free tier)
        self.carquery_base_url = "https://www.carqueryapi.com/api/0.3/"

        # Alternative: vpic.nhtsa.dot.gov (US government, free)
        self.nhtsa_base_url = "https://vpic.nhtsa.dot.gov/api/vehicles"

    def fetch_makes_from_api(self) -> list:
        """
        Fetch vehicle makes from CarQuery API.
        """
        try:
            response = requests.get(
                f"{self.carquery_base_url}?cmd=getMakes",
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                if data and 'Makes' in data:
                    return data['Makes']

            logger.warning("Failed to fetch makes from CarQuery API")
            return []

        except Exception as e:
            logger.error(f"Error fetching makes from API: {str(e)}")
            return []

    def fetch_models_from_api(self, make: str, year: Optional[int] = None) -> list:
        """
        Fetch vehicle models for a specific make from CarQuery API.
        """
        try:
            params = {
                'cmd': 'getModels',
                'make': make
            }
            if year:
                params['year'] = year

            response = requests.get(
                self.carquery_base_url,
                params=params,
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                if data and 'Models' in data:
                    return data['Models']

            logger.warning(f"Failed to fetch models for {make} from CarQuery API")
            return []

        except Exception as e:
            logger.error(f"Error fetching models from API: {str(e)}")
            return []

    def lookup_license_plate_uk(self, registration: str) -> Optional[Dict[str, Any]]:
        """
        Look up UK license plate using DVLA API (requires API key).
        """
        # Note: Requires DVLA API key - sign up at https://developer-portal.driver-vehicle-licensing.api.gov.uk/
        # This is a placeholder - implement with your API key
        logger.info(f"UK license plate lookup requested for: {registration}")
        return None

    def lookup_license_plate_france(self, registration: str) -> Optional[Dict[str, Any]]:
        """
        Look up French license plate using SIV API (requires API key).
        """
        # Note: Requires SIV API key
        logger.info(f"French license plate lookup requested for: {registration}")
        return None

    def lookup_license_plate_universal(self, registration: str) -> Optional[Dict[str, Any]]:
        """
        Look up license plate using universal API (e.g., RapidAPI).

        Example APIs:
        - Car Data API (RapidAPI): https://rapidapi.com/car-data-api/
        - License Plate to VIN: https://rapidapi.com/licenseplate-to-vin/
        """
        try:
            # Example using RapidAPI (you'll need to sign up and get an API key)
            # Uncomment and configure when you have an API key:

            # rapidapi_key = "YOUR_RAPIDAPI_KEY"
            # rapidapi_host = "car-data.p.rapidapi.com"

            # headers = {
            #     "X-RapidAPI-Key": rapidapi_key,
            #     "X-RapidAPI-Host": rapidapi_host
            # }

            # response = requests.get(
            #     f"https://{rapidapi_host}/api/vin/decode/{registration}",
            #     headers=headers,
            #     timeout=10
            # )

            # if response.status_code == 200:
            #     data = response.json()
            #     return {
            #         'make': data.get('make'),
            #         'model': data.get('model'),
            #         'year': data.get('year'),
            #         'color': data.get('color'),
            #         'vehicle_type': 'car'
            #     }

            logger.info(f"License plate lookup requested for: {registration}")
            return None

        except Exception as e:
            logger.error(f"Error in license plate lookup: {str(e)}")
            return None

    def get_vehicle_dimensions(self, make: str, model: str, db: Session) -> Optional[Dict[str, int]]:
        """
        Get average vehicle dimensions from database or estimate.
        """
        try:
            # Try to find in database first
            make_obj = db.query(VehicleMake).filter(VehicleMake.name.ilike(make)).first()
            if make_obj:
                model_obj = db.query(VehicleModel).filter(
                    VehicleModel.make_id == make_obj.id,
                    VehicleModel.name.ilike(model)
                ).first()

                if model_obj and model_obj.avg_length_cm:
                    return {
                        'length_cm': model_obj.avg_length_cm,
                        'width_cm': model_obj.avg_width_cm,
                        'height_cm': model_obj.avg_height_cm
                    }

            # Fallback: estimate based on vehicle type keywords
            model_lower = model.lower()

            # SUV/Crossover
            if any(keyword in model_lower for keyword in ['suv', 'crossover', 'x5', 'x3', 'q5', 'q7', 'cayenne']):
                return {'length_cm': 470, 'width_cm': 190, 'height_cm': 170}

            # Sedan
            elif any(keyword in model_lower for keyword in ['sedan', 'series', 'class']):
                return {'length_cm': 480, 'width_cm': 180, 'height_cm': 145}

            # Hatchback/Compact
            elif any(keyword in model_lower for keyword in ['golf', 'polo', 'fiesta', 'focus', 'corsa', 'clio']):
                return {'length_cm': 410, 'width_cm': 175, 'height_cm': 145}

            # Van
            elif any(keyword in model_lower for keyword in ['van', 'sprinter', 'transit', 'ducato']):
                return {'length_cm': 540, 'width_cm': 200, 'height_cm': 250}

            # Camper
            elif any(keyword in model_lower for keyword in ['camper', 'motorhome', 'california']):
                return {'length_cm': 600, 'width_cm': 210, 'height_cm': 280}

            # Default car dimensions
            else:
                return {'length_cm': 450, 'width_cm': 180, 'height_cm': 150}

        except Exception as e:
            logger.error(f"Error getting vehicle dimensions: {str(e)}")
            return None


# Singleton instance
vehicle_service = VehicleDataService()
