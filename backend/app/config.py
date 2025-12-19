"""
Application configuration settings.
"""

from typing import List, Optional, Union, Any
from pydantic_settings import BaseSettings
from pydantic import field_validator
import os
import json
from dotenv import load_dotenv

# Load .env file with override to replace empty docker-compose environment variables
# In development, prefer .env.development if it exists
# IMPORTANT: Skip loading .env files in testing mode - tests control the environment via conftest.py
if os.environ.get("ENVIRONMENT") != "testing":
    env_file = '.env.development' if os.path.exists('.env.development') else '.env'
    load_dotenv(dotenv_path=env_file, override=True)


class Settings(BaseSettings):
    """Application settings."""
    
    # Basic Configuration
    APP_NAME: str = "Maritime Reservation Platform"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"
    USE_MOCK_FERRIES: bool = False  # Enable mock ferry integrations (for dev/staging without real API keys)
    
    # Security
    SECRET_KEY: str = "dev-secret-key-change-this-in-production-12345678901234567890"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Database
    DATABASE_URL: str = "sqlite:///./maritime_reservations.db"
    TEST_DATABASE_URL: Optional[str] = None
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # CORS - Use string input with computed property
    ALLOWED_ORIGINS: str = "http://localhost:3010"
    
    @property
    def ALLOWED_ORIGINS_LIST(self) -> List[str]:
        """Get allowed origins as list."""
        if isinstance(self.ALLOWED_ORIGINS, str):
            return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
        return ["http://localhost:3010"]  # Default fallback
    
    # Email Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = "09388906aA@"
    FROM_EMAIL: str = "ayoubenmbarek@gmail.com"
    
    # Payment Configuration
    STRIPE_SECRET_KEY: str = "sk_test_development_key"
    STRIPE_PUBLISHABLE_KEY: str = "pk_test_development_key"
    STRIPE_WEBHOOK_SECRET: str = "whsec_development_secret"

    # Google OAuth Configuration
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: Optional[str] = None

    # Ferry Operator APIs
    # CTN (Compagnie Tunisienne de Navigation)
    CTN_API_KEY: str = ""
    CTN_BASE_URL: str = "https://api.ctn.com.tn/v1/"
    
    # GNV (Grandi Navi Veloci)
    GNV_CLIENT_ID: str = ""
    GNV_CLIENT_SECRET: str = ""
    GNV_BASE_URL: str = "https://api.gnv.it/v2/"
    
    # Corsica Lines
    CORSICA_API_KEY: str = ""
    CORSICA_SECRET: str = ""
    CORSICA_BASE_URL: str = "https://booking.corsicalines.com/api/v1/"
    
    # Danel Casanova
    DANEL_USERNAME: str = ""
    DANEL_PASSWORD: str = ""
    DANEL_BASE_URL: str = "https://reservations.danel-casanova.fr/api/"

    # FerryHopper (Aggregator API)
    FERRYHOPPER_API_KEY: str = ""
    FERRYHOPPER_BASE_URL: str = "https://ferryhapi.uat.ferryhopper.com"

    # API Configuration
    API_TIMEOUT: int = 30
    MAX_RETRIES: int = 3
    CACHE_TTL_MINUTES: int = 15  # Ferry search cache TTL (ferry schedules don't change often)
    CACHE_TTL_SECONDS: int = 900  # 15 minutes in seconds
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    # Sentry Configuration
    SENTRY_DSN: Optional[str] = None
    SENTRY_ENVIRONMENT: str = "development"
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1
    SENTRY_PROFILES_SAMPLE_RATE: float = 0.1

    # Celery Configuration
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"
    
    # File Upload
    MAX_FILE_SIZE: int = 10485760  # 10MB
    UPLOAD_DIR: str = "uploads/"
    
    # Use model_config for pydantic-settings v2
    # Skip loading .env file in testing mode - tests set environment variables directly
    # In development, use .env.development
    model_config = {
        "env_file": None if os.environ.get("ENVIRONMENT") == "testing" else (
            ".env.development" if os.path.exists(".env.development") else ".env"
        ),
        "case_sensitive": True,
        "extra": "ignore",  # Ignore extra fields from .env
    }


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get application settings."""
    return settings 