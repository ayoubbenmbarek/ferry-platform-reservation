"""
Authentication API endpoints for user registration, login, and token management.
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
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
        
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
        # TODO: Send verification email
        
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
        user = authenticate_user(db, form_data.username, form_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is deactivated"
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
        user = authenticate_user(db, login_data.email, login_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is deactivated"
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
    try:
        user = db.query(User).filter(User.email == reset_data.email).first()
        if not user:
            # Don't reveal if email exists or not
            return {"message": "If the email exists, a reset link has been sent"}
        
        # TODO: Generate reset token and send email
        # For now, just return success message
        
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
        # TODO: Validate reset token and get user
        # For now, just return error
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset not implemented yet"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password reset failed: {str(e)}"
        )


@router.post("/verify-email")
async def verify_email(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Verify email address.
    
    Verifies a user's email address using a verification token.
    """
    try:
        # TODO: Validate verification token and update user
        # For now, just return error
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email verification not implemented yet"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email verification failed: {str(e)}"
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


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_active_user)
):
    """
    User logout.

    Logs out the current user (client should discard the token).
    """
    return {"message": "Successfully logged out"} 