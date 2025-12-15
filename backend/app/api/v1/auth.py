"""
Authentication API endpoints for user registration, login, and token management.
"""

import os
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from dotenv import load_dotenv

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.api.deps import get_db, get_current_user, get_current_active_user
from app.config import settings
from app.models.user import User
from app.schemas.user import (
    UserCreate, UserResponse, UserUpdate, UserLogin, Token,
    PasswordChange, PasswordReset, PasswordResetConfirm
)

logger = logging.getLogger(__name__)

# Load environment variables (override=True to override empty docker-compose env vars)
# In development, prefer .env.development if it exists
# Skip in testing mode - tests control environment via conftest.py
if os.environ.get("ENVIRONMENT") != "testing":
    env_file = '.env.development' if os.path.exists('.env.development') else '.env'
    load_dotenv(dotenv_path=env_file, override=True)

router = APIRouter()

# Password hashing - using argon2 as primary (more modern and no length restrictions)
# Falls back to bcrypt if argon2 is not available
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    # Bcrypt has a 72-byte limit, truncate password to first 72 bytes
    # This ensures compatibility with bcrypt's requirements
    if len(password.encode('utf-8')) > 72:
        # Truncate to 72 bytes, handling UTF-8 properly
        password = password.encode('utf-8')[:72].decode('utf-8', errors='ignore')

    # Use explicit bcrypt backend to avoid issues
    try:
        return pwd_context.hash(password)
    except Exception as e:
        # If there's still an error, truncate more aggressively
        password_safe = password[:50]  # Safe length
        return pwd_context.hash(password_safe)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Authenticate a user by email and password."""
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user
    except:
        return None


@router.post("/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """
    Register a new user account.
    
    Creates a new user account with the provided information.
    The user will need to verify their email before full access.
    """
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered"
            )
        
        # Create new user
        hashed_password = get_password_hash(user_data.password)
        db_user = User(
            email=user_data.email,
            hashed_password=hashed_password,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            phone=user_data.phone,
            preferred_language=user_data.preferred_language,
            preferred_currency=user_data.preferred_currency,
            is_active=True,
            is_verified=False  # Require email verification
        )
        
        # Generate verification token
        verification_token = secrets.token_urlsafe(32)
        db_user.email_verification_token = verification_token
        db_user.email_verification_sent_at = datetime.utcnow()

        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        # Send verification email asynchronously via Celery
        try:
            from app.tasks.email_tasks import send_email_verification_task
            base_url = os.getenv("BASE_URL", "http://localhost:3001")
            verification_link = f"{base_url}/verify-email?token={verification_token}"

            email_data = {
                "first_name": db_user.first_name,
                "verification_link": verification_link,
                "base_url": base_url
            }

            # Queue email task asynchronously (non-blocking)
            send_email_verification_task.delay(
                email_data=email_data,
                to_email=db_user.email
            )
        except Exception as e:
            # Log but don't fail registration if task queuing fails
            print(f"Failed to queue verification email: {str(e)}")

        return UserResponse.model_validate(db_user)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration failed: {str(e)}"
        )


@router.post("/register-from-booking", response_model=dict)
async def register_from_booking(
    user_data: UserCreate,
    booking_reference: str,
    db: Session = Depends(get_db)
):
    """
    Create an account and link existing guest booking(s) to it.

    Allows guests who made bookings to create an account afterwards
    and have their bookings automatically linked to the new account.
    """
    try:
        from app.models.booking import Booking

        # Check if user already exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            # Instead of rejecting, we could offer to link the booking if they log in
            # But for security, we don't want to auto-link without password verification
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email is already registered. Please log in to link your booking to your account."
            )

        # Verify booking exists and matches email
        booking = db.query(Booking).filter(
            Booking.booking_reference == booking_reference
        ).first()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        if booking.contact_email.lower() != user_data.email.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email must match the booking email"
            )

        # Create new user
        hashed_password = get_password_hash(user_data.password)
        db_user = User(
            email=user_data.email,
            hashed_password=hashed_password,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            phone=user_data.phone,
            preferred_language=user_data.preferred_language,
            preferred_currency=user_data.preferred_currency,
            is_active=True,
            is_verified=True  # Auto-verify since they have a confirmed booking
        )

        db.add(db_user)
        db.flush()  # Get user ID

        # Link all bookings with this email to the new user
        guest_bookings = db.query(Booking).filter(
            Booking.contact_email == user_data.email,
            Booking.user_id == None
        ).all()

        linked_count = 0
        for guest_booking in guest_bookings:
            print(f"Linking booking {guest_booking.booking_reference} to user {db_user.id}")
            guest_booking.user_id = db_user.id
            linked_count += 1

        print(f"Total bookings linked: {linked_count}")
        db.commit()
        db.refresh(db_user)

        # Create access token for immediate login
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(db_user.id)},
            expires_delta=access_token_expires
        )

        return {
            "user": UserResponse.model_validate(db_user).dict(),
            "token": access_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "bookings_linked": linked_count,
            "message": f"Account created successfully! {linked_count} booking(s) linked to your account."
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration failed: {str(e)}"
        )


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    User login with email and password.

    Returns a JWT access token for authenticated requests.
    """
    try:
        # First check if user exists
        user = db.query(User).filter(User.email == form_data.username).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No account found with this email address. Please check your email or create a new account."
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is deactivated"
            )

        if not user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please verify your email before logging in. Check your inbox for the verification link."
            )

        # Now verify password
        if not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password. Please try again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Update last login
        user.last_login = datetime.utcnow()

        # Auto-link any guest bookings with matching email
        from app.models.booking import Booking
        guest_bookings = db.query(Booking).filter(
            Booking.contact_email == user.email,
            Booking.user_id == None
        ).all()

        for booking in guest_bookings:
            booking.user_id = user.id

        if guest_bookings:
            print(f"Auto-linked {len(guest_bookings)} guest booking(s) to user {user.id} on login")

        db.commit()

        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=access_token_expires
        )

        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Login failed: {str(e)}"
        )


@router.post("/login-email", response_model=Token)
async def login_with_email(
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    """
    User login with email and password (JSON format).

    Alternative login endpoint that accepts JSON data instead of form data.
    """
    try:
        # First check if user exists
        user = db.query(User).filter(User.email == login_data.email).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No account found with this email address. Please check your email or create a new account."
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is deactivated"
            )

        if not user.is_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please verify your email before logging in. Check your inbox for the verification link."
            )

        # Now verify password
        if not verify_password(login_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password. Please try again."
            )

        # Update last login
        user.last_login = datetime.utcnow()

        # Auto-link any guest bookings with matching email
        from app.models.booking import Booking
        guest_bookings = db.query(Booking).filter(
            Booking.contact_email == user.email,
            Booking.user_id == None
        ).all()

        for booking in guest_bookings:
            booking.user_id = user.id

        if guest_bookings:
            print(f"Auto-linked {len(guest_bookings)} guest booking(s) to user {user.id} on login (email)")

        db.commit()

        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=access_token_expires
        )

        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Login failed: {str(e)}"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get current user information.

    Returns the profile information of the currently authenticated user.
    """
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update current user information.

    Allows authenticated users to update their profile information.
    """
    try:
        # Update user fields
        if user_update.first_name is not None:
            current_user.first_name = user_update.first_name
        if user_update.last_name is not None:
            current_user.last_name = user_update.last_name
        if user_update.phone is not None:
            current_user.phone = user_update.phone
        if user_update.preferred_language is not None:
            current_user.preferred_language = user_update.preferred_language
        if user_update.preferred_currency is not None:
            current_user.preferred_currency = user_update.preferred_currency

        db.commit()
        db.refresh(current_user)

        return UserResponse.model_validate(current_user)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Profile update failed: {str(e)}"
        )


@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Change user password.
    
    Allows authenticated users to change their password.
    """
    try:
        # Verify current password
        if not verify_password(password_data.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        # Update password
        current_user.hashed_password = get_password_hash(password_data.new_password)
        db.commit()
        
        return {"message": "Password changed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password change failed: {str(e)}"
        )


@router.post("/forgot-password")
async def forgot_password(
    reset_data: PasswordReset,
    db: Session = Depends(get_db)
):
    """
    Request password reset.

    Sends a password reset email to the user if the email exists.
    """
    import secrets
    from datetime import datetime, timedelta
    from app.services.email_service import email_service

    try:
        user = db.query(User).filter(User.email == reset_data.email).first()
        if not user:
            # Don't reveal if email exists or not
            return {"message": "If the email exists, a reset link has been sent"}

        # Generate reset token
        reset_token = secrets.token_urlsafe(32)
        user.password_reset_token = reset_token
        user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        db.commit()

        # Send reset email
        base_url = os.getenv("BASE_URL", "http://localhost:3001")
        reset_link = f"{base_url}/reset-password?token={reset_token}"

        email_data = {
            "first_name": user.first_name,
            "reset_link": reset_link,
            "expires_in": "1 hour",
            "base_url": base_url
        }

        email_service.send_password_reset(
            email_data=email_data,
            to_email=user.email
        )

        return {"message": "If the email exists, a reset link has been sent"}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password reset request failed: {str(e)}"
        )


@router.post("/reset-password")
async def reset_password(
    reset_data: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """
    Reset password with token.

    Resets the user's password using a valid reset token.
    """
    try:
        # Find user with this reset token
        user = db.query(User).filter(
            User.password_reset_token == reset_data.token
        ).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )

        # Check if token has expired
        if user.password_reset_expires and user.password_reset_expires < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reset token has expired. Please request a new one."
            )

        # Update password
        user.hashed_password = get_password_hash(reset_data.new_password)
        user.password_reset_token = None
        user.password_reset_expires = None
        db.commit()

        return {"message": "Password has been reset successfully. You can now login with your new password."}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password reset failed: {str(e)}"
        )


@router.get("/verify-email")
async def verify_email(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Verify email address.

    Verifies a user's email address using a verification token.
    """
    try:
        # Find user with this verification token
        user = db.query(User).filter(
            User.email_verification_token == token
        ).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification token"
            )

        # Check if token has expired (24 hours)
        if user.email_verification_sent_at:
            token_age = datetime.now(timezone.utc) - user.email_verification_sent_at.replace(tzinfo=timezone.utc)
            if token_age.total_seconds() > 24 * 60 * 60:  # 24 hours
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Verification link has expired. Please request a new verification email."
                )

        # Mark email as verified
        user.is_verified = True
        user.email_verification_token = None
        user.email_verification_sent_at = None
        db.commit()

        return {"message": "Email verified successfully! You can now use all features of your account."}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email verification failed: {str(e)}"
        )


@router.post("/resend-verification")
async def resend_verification_email(
    email: str = Query(..., description="Email address to resend verification to"),
    db: Session = Depends(get_db)
):
    """
    Resend email verification link.
    """
    from app.services.email_service import email_service

    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            # Don't reveal if email exists
            return {"message": "If the email exists, a verification link has been sent"}

        if user.is_verified:
            return {"message": "Email is already verified"}

        # Generate new verification token
        verification_token = secrets.token_urlsafe(32)
        user.email_verification_token = verification_token
        user.email_verification_sent_at = datetime.utcnow()
        db.commit()

        # Send verification email
        base_url = os.getenv("BASE_URL", "http://localhost:3001")
        verification_link = f"{base_url}/verify-email?token={verification_token}"

        email_data = {
            "first_name": user.first_name,
            "verification_link": verification_link,
            "base_url": base_url
        }

        email_service.send_email_verification(
            email_data=email_data,
            to_email=user.email
        )

        return {"message": "If the email exists, a verification link has been sent"}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to send verification email: {str(e)}"
        )


@router.post("/refresh-token", response_model=Token)
async def refresh_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Refresh access token.
    
    Generates a new access token for the authenticated user.
    """
    try:
        # Create new access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(current_user.id)}, 
            expires_delta=access_token_expires
        )
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Token refresh failed: {str(e)}"
        )


@router.post("/link-booking")
async def link_booking_to_account(
    booking_reference: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Link a guest booking to the current user's account.

    Allows logged-in users to claim guest bookings made with their email.
    """
    try:
        from app.models.booking import Booking

        # Find the booking
        booking = db.query(Booking).filter(
            Booking.booking_reference == booking_reference
        ).first()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )

        # Verify the booking email matches the user's email
        if booking.contact_email.lower() != current_user.email.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This booking was made with a different email address"
            )

        # Check if booking is already linked
        if booking.user_id is not None:
            if booking.user_id == current_user.id:
                return {
                    "message": "This booking is already linked to your account",
                    "booking_reference": booking_reference
                }
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This booking is already linked to another account"
                )

        # Link the booking to the user
        booking.user_id = current_user.id
        db.commit()

        # Also link any other guest bookings with the same email
        other_bookings = db.query(Booking).filter(
            Booking.contact_email == current_user.email,
            Booking.user_id == None
        ).all()

        linked_count = 1  # Count the main booking
        for other_booking in other_bookings:
            other_booking.user_id = current_user.id
            linked_count += 1

        db.commit()

        return {
            "message": f"Successfully linked {linked_count} booking(s) to your account",
            "booking_reference": booking_reference,
            "total_linked": linked_count
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to link booking: {str(e)}"
        )


@router.post("/google")
async def google_login(
    token_data: dict,
    db: Session = Depends(get_db)
):
    """
    Authenticate user with Google OAuth token.

    Accepts a Google ID token from the frontend, verifies it,
    and creates/logs in the user.
    """
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests

        # Get Google OAuth client ID from environment
        google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        logger.info(f"Google OAuth client ID: {google_client_id}")
        if not google_client_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Google OAuth is not configured on the server"
            )

        # Verify the Google token (accept both 'credential' and 'id_token' field names)
        google_token = token_data.get("credential") or token_data.get("id_token")
        if not google_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing Google token. Provide 'credential' or 'id_token' field."
            )

        try:
            id_info = id_token.verify_oauth2_token(
                google_token,
                requests.Request(),
                google_client_id
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Google token: {str(e)}"
            )

        # Extract user information from Google
        google_user_id = id_info.get("sub")
        email = id_info.get("email")
        email_verified = id_info.get("email_verified", False)
        first_name = id_info.get("given_name", "")
        last_name = id_info.get("family_name", "")
        picture = id_info.get("picture")

        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email not provided by Google"
            )

        # Check if user exists
        user = db.query(User).filter(User.email == email).first()

        if user:
            # User exists - log them in
            if not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Account is deactivated"
                )

            # Update last login
            user.last_login = datetime.utcnow()

            # Update Google user ID if not set
            if not hasattr(user, 'google_user_id') or not user.google_user_id:
                user.google_user_id = google_user_id

            # If user wasn't verified, verify them now (Google verified the email)
            if not user.is_verified and email_verified:
                user.is_verified = True

        else:
            # Create new user account
            user = User(
                email=email,
                first_name=first_name,
                last_name=last_name,
                is_active=True,
                is_verified=email_verified,  # Trust Google's email verification
                hashed_password=get_password_hash(secrets.token_urlsafe(32)),  # Random password
                google_user_id=google_user_id
            )
            db.add(user)
            db.flush()  # Get user ID

        # Auto-link any guest bookings with matching email
        from app.models.booking import Booking
        guest_bookings = db.query(Booking).filter(
            Booking.contact_email == user.email,
            Booking.user_id == None
        ).all()

        linked_count = 0
        for booking in guest_bookings:
            booking.user_id = user.id
            linked_count += 1

        if linked_count > 0:
            logger.info(f"Auto-linked {linked_count} guest booking(s) to user {user.id} on Google login")

        db.commit()
        db.refresh(user)

        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=access_token_expires
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": UserResponse.model_validate(user).dict(),
            "is_new_user": linked_count == 0 and not user.last_login
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google login failed: {str(e)}"
        )


@router.post("/apple")
async def apple_login(
    token_data: dict,
    db: Session = Depends(get_db)
):
    """
    Authenticate user with Apple Sign-In.

    Accepts an Apple identity token from the mobile app, verifies it,
    and creates/logs in the user.
    """
    import httpx
    import json
    import base64
    from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
    from cryptography.hazmat.backends import default_backend

    try:
        identity_token = token_data.get("identity_token")
        if not identity_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing identity_token field"
            )

        # Apple's public keys endpoint
        apple_keys_url = "https://appleid.apple.com/auth/keys"

        # Fetch Apple's public keys
        async with httpx.AsyncClient() as client:
            response = await client.get(apple_keys_url)
            apple_keys = response.json()

        # Decode the JWT header to get the key ID (without verification)
        try:
            header_segment = identity_token.split('.')[0]
            # Add padding if needed
            padding = 4 - len(header_segment) % 4
            if padding != 4:
                header_segment += '=' * padding
            header_data = base64.urlsafe_b64decode(header_segment)
            unverified_header = json.loads(header_data)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Apple identity token format"
            )

        # Find the matching key
        kid = unverified_header.get("kid")
        matching_key = None
        for key in apple_keys.get("keys", []):
            if key.get("kid") == kid:
                matching_key = key
                break

        if not matching_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to find matching Apple public key"
            )

        # Convert JWK to RSA public key
        def decode_value(val):
            decoded = base64.urlsafe_b64decode(val + '==')
            return int.from_bytes(decoded, byteorder='big')

        e = decode_value(matching_key['e'])
        n = decode_value(matching_key['n'])
        public_numbers = RSAPublicNumbers(e, n)
        public_key = public_numbers.public_key(default_backend())

        # Get Apple Bundle ID from environment (or use default for development)
        apple_bundle_id = os.getenv("APPLE_BUNDLE_ID", "com.maritime.ferries")

        # Verify the token using python-jose
        try:
            decoded = jwt.decode(
                identity_token,
                public_key,
                algorithms=["RS256"],
                audience=apple_bundle_id,
                issuer="https://appleid.apple.com"
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Apple identity token has expired"
            )
        except JWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Apple identity token: {str(e)}"
            )

        # Extract user information from Apple token
        apple_user_id = decoded.get("sub")  # Apple's unique user ID
        email = decoded.get("email")
        email_verified = decoded.get("email_verified", False)

        # Apple only provides name on first sign-in, so get from request if available
        first_name = token_data.get("first_name", "")
        last_name = token_data.get("last_name", "")

        if not apple_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Apple user ID not found in token"
            )

        # Check if user exists by Apple ID first, then by email
        user = db.query(User).filter(User.apple_user_id == apple_user_id).first()

        if not user and email:
            # Check if user exists by email
            user = db.query(User).filter(User.email == email).first()
            if user:
                # Link Apple ID to existing account
                user.apple_user_id = apple_user_id

        if user:
            # User exists - log them in
            if not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Account is deactivated"
                )

            # Update last login
            user.last_login = datetime.now(timezone.utc)

            # If user wasn't verified, verify them now (Apple verified the email)
            if not user.is_verified and email_verified:
                user.is_verified = True

        else:
            # Create new user account
            # If no email provided by Apple (user chose to hide), generate a placeholder
            if not email:
                email = f"{apple_user_id}@privaterelay.appleid.com"

            user = User(
                email=email,
                first_name=first_name or "Apple",
                last_name=last_name or "User",
                is_active=True,
                is_verified=email_verified if email_verified else True,  # Trust Apple's verification
                hashed_password=get_password_hash(secrets.token_urlsafe(32)),  # Random password
                apple_user_id=apple_user_id
            )
            db.add(user)
            db.flush()  # Get user ID

        # Auto-link any guest bookings with matching email
        from app.models.booking import Booking
        guest_bookings = db.query(Booking).filter(
            Booking.contact_email == user.email,
            Booking.user_id == None
        ).all()

        linked_count = 0
        for booking in guest_bookings:
            booking.user_id = user.id
            linked_count += 1

        if linked_count > 0:
            logger.info(f"Auto-linked {linked_count} guest booking(s) to user {user.id} on Apple login")

        db.commit()
        db.refresh(user)

        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=access_token_expires
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": UserResponse.model_validate(user).model_dump(),
            "is_new_user": linked_count == 0 and not user.last_login
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Apple login failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Apple login failed: {str(e)}"
        )


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_active_user)
):
    """
    User logout.

    Logs out the current user (client should discard the token).
    """
    return {"message": "Successfully logged out"}


@router.post("/push-token")
async def register_push_token(
    token_data: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Register or update push notification token.

    Stores the user's Expo push token for sending push notifications.
    """
    try:
        push_token = token_data.get("push_token")
        if not push_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="push_token is required"
            )

        # Validate Expo push token format
        if not push_token.startswith("ExponentPushToken[") and not push_token.startswith("ExpoPushToken["):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid push token format"
            )

        current_user.push_token = push_token
        current_user.push_token_updated_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(f"Push token registered for user {current_user.id}")
        return {"message": "Push token registered successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Push token registration failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Push token registration failed: {str(e)}"
        )


@router.delete("/push-token")
async def remove_push_token(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Remove push notification token.

    Removes the user's push token (e.g., on logout or when notifications are disabled).
    """
    try:
        current_user.push_token = None
        current_user.push_token_updated_at = None
        db.commit()

        logger.info(f"Push token removed for user {current_user.id}")
        return {"message": "Push token removed successfully"}

    except Exception as e:
        db.rollback()
        logger.error(f"Push token removal failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Push token removal failed: {str(e)}"
        ) 