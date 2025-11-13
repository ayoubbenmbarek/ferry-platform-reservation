"""
Ferry integrations module for all ferry operators.
"""

from typing import Dict, Optional

try:
    from app.config import settings
except ImportError:
    # Fallback for development
    class Settings:
        CTN_API_KEY = ""
        CTN_BASE_URL = "https://api.ctn.com.tn"
        GNV_CLIENT_ID = ""
        GNV_CLIENT_SECRET = ""
        GNV_BASE_URL = "https://api.gnv.it"
        CORSICA_API_KEY = ""
        CORSICA_BASE_URL = "https://api.corsica-linea.com"
        DANEL_USERNAME = ""
        DANEL_PASSWORD = ""
        DANEL_BASE_URL = "https://api.danel.fr"
    settings = Settings()

from .base import BaseFerryIntegration
from .ctn import CTNIntegration
from .gnv import GNVIntegration
from .corsica import CorsicaIntegration
from .danel import DanelIntegration


def get_ferry_integration(operator: str) -> Optional[BaseFerryIntegration]:
    """
    Get a ferry integration instance for a specific operator.
    
    Args:
        operator: Ferry operator name (ctn, gnv, corsica, danel)
        
    Returns:
        Ferry integration instance or None if not found
    """
    operator = operator.lower()
    
    if operator == "ctn":
        return CTNIntegration(
            api_key=settings.CTN_API_KEY,
            base_url=settings.CTN_BASE_URL
        )
    elif operator == "gnv":
        return GNVIntegration(
            api_key=f"{settings.GNV_CLIENT_ID}:{settings.GNV_CLIENT_SECRET}",
            base_url=settings.GNV_BASE_URL
        )
    elif operator == "corsica":
        return CorsicaIntegration(
            api_key=settings.CORSICA_API_KEY,
            base_url=settings.CORSICA_BASE_URL
        )
    elif operator == "danel":
        return DanelIntegration(
            api_key=f"{settings.DANEL_USERNAME}:{settings.DANEL_PASSWORD}",
            base_url=settings.DANEL_BASE_URL
        )
    
    return None


def get_all_integrations() -> Dict[str, BaseFerryIntegration]:
    """
    Get all available ferry integrations.
    
    Returns:
        Dictionary of operator name to integration instance
    """
    integrations = {}
    
    # Only include operators with valid API keys
    if settings.CTN_API_KEY:
        integrations["ctn"] = CTNIntegration(
            api_key=settings.CTN_API_KEY,
            base_url=settings.CTN_BASE_URL
        )
    
    if settings.GNV_CLIENT_ID and settings.GNV_CLIENT_SECRET:
        integrations["gnv"] = GNVIntegration(
            api_key=f"{settings.GNV_CLIENT_ID}:{settings.GNV_CLIENT_SECRET}",
            base_url=settings.GNV_BASE_URL
        )
    
    if settings.CORSICA_API_KEY:
        integrations["corsica"] = CorsicaIntegration(
            api_key=settings.CORSICA_API_KEY,
            base_url=settings.CORSICA_BASE_URL
        )
    
    if settings.DANEL_USERNAME and settings.DANEL_PASSWORD:
        integrations["danel"] = DanelIntegration(
            api_key=f"{settings.DANEL_USERNAME}:{settings.DANEL_PASSWORD}",
            base_url=settings.DANEL_BASE_URL
        )
    
    return integrations


def get_operator_names() -> list[str]:
    """
    Get list of all supported operator names.
    
    Returns:
        List of operator names
    """
    return ["ctn", "gnv", "corsica", "danel"]


def is_operator_available(operator: str) -> bool:
    """
    Check if an operator is available (has valid configuration).
    
    Args:
        operator: Operator name
        
    Returns:
        True if operator is available
    """
    return get_ferry_integration(operator) is not None 