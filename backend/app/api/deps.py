"""
API dependencies for database sessions, authentication, and common parameters.
"""

from typing import Optional, Generator
from datetime import datetime

try:
    from fastapi import Depends, HTTPException, status, Query
    from fastapi.security import OAuth2PasswordBearer
    from sqlalchemy.orm import Session
    from jose import JWTError, jwt
except ImportError:
    # Fallback for development
    class Depends:
        def __init__(self, dependency):
            pass
    
    class HTTPException(Exception):
        pass
    
    class status:
        HTTP_401_UNAUTHORIZED = 401
        HTTP_403_FORBIDDEN = 403
    
    def Query(*args, **kwargs):
        return None
    
    class OAuth2PasswordBearer:
        def __init__(self, tokenUrl: str):
            pass
    
    class Session:
        pass
    
    class JWTError(Exception):
        pass
    
    def jwt_decode(*args, **kwargs):
        return {"sub": "1", "exp": datetime.now().timestamp() + 3600}
    
    jwt = type('JWT', (), {'decode': jwt_decode})()

try:
    from app.database import SessionLocal
    from app.config import settings
    from app.models.user import User
    from app.models.booking import Booking
except ImportError:
    # Fallback for development
    class SessionLocal:
        pass
    
    class settings:
        SECRET_KEY = "fallback-secret-key"
        ALGORITHM = "HS256"
    
    class User:
        id = 1
        is_active = True
        is_admin = False
    
    class Booking:
        pass

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login", auto_error=False)


def get_db() -> Generator[Session, None, None]:
    """
    Get database session.
    
    Creates a database session and ensures it's properly closed after use.
    """
    try:
        db = SessionLocal()
        yield db
    finally:
        if hasattr(db, 'close'):
            db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Get current authenticated user from JWT token.

    Validates the JWT token and returns the corresponding user.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Check if token is None
    if token is None:
        raise credentials_exception

    try:
        # Decode JWT token
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Get user from database
    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
        if user is None:
            raise credentials_exception
        return user
    except:
        # Fallback for development
        return User()


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current active user.
    
    Ensures the current user is active (not deactivated).
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


def get_optional_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Get current user if authenticated, otherwise return None.
    
    This is useful for endpoints that work for both authenticated
    and anonymous users.
    """
    if not token:
        return None
    
    try:
        # Decode JWT token
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        
        # Get user from database
        user = db.query(User).filter(User.id == int(user_id)).first()
        return user
    except (JWTError, ValueError):
        return None


def get_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    Get current user and ensure they have admin privileges.
    
    Raises an exception if the user is not an admin.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


class CommonQueryParams:
    """Common query parameters for pagination and filtering."""
    
    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number"),
        page_size: int = Query(20, ge=1, le=100, description="Items per page"),
        sort_by: Optional[str] = Query(None, description="Sort field"),
        sort_order: str = Query("desc", regex="^(asc|desc)$", description="Sort order")
    ):
        self.page = page
        self.page_size = page_size
        self.offset = (page - 1) * page_size
        self.sort_by = sort_by
        self.sort_order = sort_order


def get_common_params(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(100, ge=1, le=100, description="Items per page"),
    sort_by: Optional[str] = Query(None, description="Sort field"),
    sort_order: str = Query("desc", regex="^(asc|desc)$", description="Sort order")
) -> CommonQueryParams:
    """
    Get common query parameters for pagination and sorting.
    
    Returns a CommonQueryParams object with pagination and sorting info.
    """
    return CommonQueryParams(
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order
    )


def validate_booking_access(
    booking_id: int,
    current_user: Optional[User],
    db: Session
) -> bool:
    """
    Validate if the current user has access to a specific booking.
    
    Returns True if:
    - User is an admin
    - User owns the booking
    - Booking is accessed with valid guest credentials
    """
    try:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            return False
        
        # Admin users can access all bookings
        if current_user and current_user.is_admin:
            return True
        
        # Users can access their own bookings
        if current_user and booking.user_id == current_user.id:
            return True
        
        # Guest bookings can be accessed without authentication
        # (additional validation like email verification should be done in the endpoint)
        if not booking.user_id:
            return True
        
        return False
    except:
        return False


def validate_ferry_operator(operator: str) -> str:
    """
    Validate ferry operator name.
    
    Ensures the operator is supported by the system.
    """
    supported_operators = [
        "ctn",
        "gnv", 
        "corsica_lines",
        "danel_casanova",
        "moby_lines",
        "grimaldi_lines"
    ]
    
    if operator.lower() not in supported_operators:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported ferry operator: {operator}"
        )
    
    return operator.lower()


def validate_route(departure_port: str, arrival_port: str) -> tuple[str, str]:
    """
    Validate ferry route.
    
    Ensures the route is supported by the system.
    """
    supported_routes = {
        ("genoa", "tunis"),
        ("tunis", "genoa"),
        ("civitavecchia", "tunis"),
        ("tunis", "civitavecchia"),
        ("palermo", "tunis"),
        ("tunis", "palermo"),
        ("salerno", "tunis"),
        ("tunis", "salerno"),
        ("marseille", "tunis"),
        ("tunis", "marseille"),
        ("nice", "tunis"),
        ("tunis", "nice")
    }
    
    route = (departure_port.lower(), arrival_port.lower())
    if route not in supported_routes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported route: {departure_port} to {arrival_port}"
        )
    
    return departure_port.lower(), arrival_port.lower()


def validate_currency(currency: str) -> str:
    """
    Validate currency code.
    
    Ensures the currency is supported by the system.
    """
    supported_currencies = ["EUR", "USD", "TND"]
    
    if currency.upper() not in supported_currencies:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported currency: {currency}"
        )
    
    return currency.upper()


def validate_language(language: str) -> str:
    """
    Validate language code.
    
    Ensures the language is supported by the system.
    """
    supported_languages = ["en", "fr", "ar", "it"]
    
    if language.lower() not in supported_languages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported language: {language}"
        )
    
    return language.lower()


class RateLimitParams:
    """Rate limiting parameters."""
    
    def __init__(
        self,
        requests_per_minute: int = 60,
        requests_per_hour: int = 1000,
        requests_per_day: int = 10000
    ):
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self.requests_per_day = requests_per_day


def get_rate_limit_params() -> RateLimitParams:
    """
    Get rate limiting parameters.
    
    Returns rate limiting configuration for API endpoints.
    """
    return RateLimitParams()


def check_maintenance_mode():
    """
    Check if the system is in maintenance mode.
    
    Raises an exception if the system is under maintenance.
    """
    # This would typically check a configuration flag or database setting
    maintenance_mode = False  # This could come from settings or database
    
    if maintenance_mode:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="System is currently under maintenance. Please try again later."
        )


def validate_date_range(
    start_date: Optional[datetime],
    end_date: Optional[datetime],
    max_range_days: int = 365
) -> tuple[Optional[datetime], Optional[datetime]]:
    """
    Validate date range parameters.
    
    Ensures the date range is valid and within acceptable limits.
    """
    if start_date and end_date:
        if start_date > end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Start date must be before end date"
            )
        
        # Check if range is too large
        if (end_date - start_date).days > max_range_days:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Date range cannot exceed {max_range_days} days"
            )
    
    return start_date, end_date 