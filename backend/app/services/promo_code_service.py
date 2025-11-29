"""
Promo code service with fraud prevention mechanisms.
"""

from typing import Optional, List
from datetime import datetime, timezone
from decimal import Decimal
import json
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from app.models.promo_code import PromoCode, PromoCodeUsage, PromoCodeTypeEnum
from app.models.booking import Booking
from app.schemas.promo_code import (
    PromoCodeCreate, PromoCodeUpdate, PromoCodeValidateRequest,
    PromoCodeValidateResponse, PromoCodeApplyRequest
)


class PromoCodeError(Exception):
    """Custom exception for promo code errors."""
    pass


class PromoCodeService:
    """Service for managing promo codes with fraud prevention."""

    def __init__(self, db: Session):
        self.db = db

    # Admin functions
    def create_promo_code(self, promo_data: PromoCodeCreate, created_by: int = None) -> PromoCode:
        """Create a new promo code."""
        # Check if code already exists
        existing = self.db.query(PromoCode).filter(
            PromoCode.code == promo_data.code
        ).first()
        if existing:
            raise PromoCodeError(f"Promo code '{promo_data.code}' already exists")

        # Convert discount_type to the database enum
        if isinstance(promo_data.discount_type, str):
            discount_type_value = promo_data.discount_type
        else:
            discount_type_value = promo_data.discount_type.value

        promo = PromoCode(
            code=promo_data.code,
            description=promo_data.description,
            discount_type=PromoCodeTypeEnum(discount_type_value),
            discount_value=promo_data.discount_value,
            max_uses=promo_data.max_uses,
            max_uses_per_user=promo_data.max_uses_per_user,
            valid_from=promo_data.valid_from,
            valid_until=promo_data.valid_until,
            minimum_amount=promo_data.minimum_amount,
            maximum_discount=promo_data.maximum_discount,
            applicable_operators=json.dumps(promo_data.applicable_operators) if promo_data.applicable_operators else None,
            applicable_routes=json.dumps(promo_data.applicable_routes) if promo_data.applicable_routes else None,
            first_booking_only=promo_data.first_booking_only,
            created_by=created_by
        )

        self.db.add(promo)
        self.db.commit()
        self.db.refresh(promo)
        return promo

    def update_promo_code(self, promo_id: int, update_data: PromoCodeUpdate) -> PromoCode:
        """Update an existing promo code."""
        promo = self.db.query(PromoCode).filter(PromoCode.id == promo_id).first()
        if not promo:
            raise PromoCodeError("Promo code not found")

        for field, value in update_data.model_dump(exclude_unset=True).items():
            setattr(promo, field, value)

        self.db.commit()
        self.db.refresh(promo)
        return promo

    def deactivate_promo_code(self, promo_id: int) -> PromoCode:
        """Deactivate a promo code."""
        promo = self.db.query(PromoCode).filter(PromoCode.id == promo_id).first()
        if not promo:
            raise PromoCodeError("Promo code not found")

        promo.is_active = False
        self.db.commit()
        self.db.refresh(promo)
        return promo

    def list_promo_codes(self, page: int = 1, page_size: int = 20, active_only: bool = False) -> tuple:
        """List promo codes with pagination."""
        query = self.db.query(PromoCode)

        if active_only:
            # Filter for truly active promo codes (not just is_active=True)
            # Must meet all conditions: active, valid period, not used up
            now = datetime.now(timezone.utc)
            query = query.filter(
                PromoCode.is_active == True,
                PromoCode.valid_from <= now,
                or_(
                    PromoCode.valid_until.is_(None),
                    PromoCode.valid_until >= now
                ),
                or_(
                    PromoCode.max_uses.is_(None),
                    PromoCode.current_uses < PromoCode.max_uses
                )
            )

        total = query.count()
        promos = query.order_by(PromoCode.created_at.desc()).offset(
            (page - 1) * page_size
        ).limit(page_size).all()

        return promos, total

    # Validation and fraud prevention
    def validate_promo_code(self, request: PromoCodeValidateRequest) -> PromoCodeValidateResponse:
        """
        Validate a promo code with comprehensive fraud checks.

        Fraud prevention checks:
        1. Code existence and active status
        2. Validity period
        3. Usage limits (total and per user)
        4. Minimum amount requirement
        5. Per-email usage limit (catches multi-account fraud)
        6. Per-IP usage limit (catches device fraud)
        7. Per-device fingerprint limit
        8. First booking only restriction
        9. Operator/route restrictions
        """
        # Get the promo code
        promo = self.db.query(PromoCode).filter(
            PromoCode.code == request.code,
            PromoCode.is_active == True
        ).first()

        if not promo:
            return PromoCodeValidateResponse(
                is_valid=False,
                code=request.code,
                message="Invalid promo code"
            )

        # Check validity period
        now = datetime.now(timezone.utc)
        if promo.valid_from.replace(tzinfo=timezone.utc) > now:
            return PromoCodeValidateResponse(
                is_valid=False,
                code=request.code,
                message="This promo code is not yet active"
            )

        if promo.valid_until and promo.valid_until.replace(tzinfo=timezone.utc) < now:
            return PromoCodeValidateResponse(
                is_valid=False,
                code=request.code,
                message="This promo code has expired"
            )

        # Check total usage limit
        if promo.max_uses and promo.current_uses >= promo.max_uses:
            return PromoCodeValidateResponse(
                is_valid=False,
                code=request.code,
                message="This promo code has reached its usage limit"
            )

        # Check minimum amount
        if promo.minimum_amount and request.booking_amount < float(promo.minimum_amount):
            return PromoCodeValidateResponse(
                is_valid=False,
                code=request.code,
                message=f"Minimum booking amount of €{promo.minimum_amount} required for this code"
            )

        # Check operator restrictions
        if promo.applicable_operators and request.operator:
            allowed_operators = json.loads(promo.applicable_operators)
            if request.operator not in allowed_operators:
                return PromoCodeValidateResponse(
                    is_valid=False,
                    code=request.code,
                    message="This promo code is not valid for the selected operator"
                )

        # Check route restrictions
        if promo.applicable_routes and request.route_id:
            allowed_routes = json.loads(promo.applicable_routes)
            if request.route_id not in allowed_routes:
                return PromoCodeValidateResponse(
                    is_valid=False,
                    code=request.code,
                    message="This promo code is not valid for the selected route"
                )

        # FRAUD PREVENTION: Check per-user usage
        if request.user_id:
            user_usage_count = self.db.query(func.count(PromoCodeUsage.id)).filter(
                PromoCodeUsage.promo_code_id == promo.id,
                PromoCodeUsage.user_id == request.user_id,
                PromoCodeUsage.is_valid == True
            ).scalar()

            if user_usage_count >= promo.max_uses_per_user:
                return PromoCodeValidateResponse(
                    is_valid=False,
                    code=request.code,
                    message="You have already used this promo code"
                )

        # FRAUD PREVENTION: Check per-email usage (catches multi-account fraud)
        email_usage_count = self.db.query(func.count(PromoCodeUsage.id)).filter(
            PromoCodeUsage.promo_code_id == promo.id,
            PromoCodeUsage.email == request.email.lower(),
            PromoCodeUsage.is_valid == True
        ).scalar()

        if email_usage_count >= promo.max_uses_per_user:
            return PromoCodeValidateResponse(
                is_valid=False,
                code=request.code,
                message="This promo code has already been used with this email"
            )

        # FRAUD PREVENTION: Check per-IP usage (with higher threshold)
        if request.ip_address:
            ip_usage_count = self.db.query(func.count(PromoCodeUsage.id)).filter(
                PromoCodeUsage.promo_code_id == promo.id,
                PromoCodeUsage.ip_address == request.ip_address,
                PromoCodeUsage.is_valid == True
            ).scalar()

            # Allow up to 3x per IP (family members, shared network)
            ip_threshold = promo.max_uses_per_user * 3
            if ip_usage_count >= ip_threshold:
                return PromoCodeValidateResponse(
                    is_valid=False,
                    code=request.code,
                    message="This promo code cannot be used from this network anymore"
                )

        # FRAUD PREVENTION: Check per-device fingerprint
        if request.device_fingerprint:
            device_usage_count = self.db.query(func.count(PromoCodeUsage.id)).filter(
                PromoCodeUsage.promo_code_id == promo.id,
                PromoCodeUsage.device_fingerprint == request.device_fingerprint,
                PromoCodeUsage.is_valid == True
            ).scalar()

            # Allow up to 2x per device
            device_threshold = promo.max_uses_per_user * 2
            if device_usage_count >= device_threshold:
                return PromoCodeValidateResponse(
                    is_valid=False,
                    code=request.code,
                    message="This promo code cannot be used from this device anymore"
                )

        # FRAUD PREVENTION: Check first booking only restriction
        if promo.first_booking_only:
            # Check if user has any previous bookings
            previous_bookings = self.db.query(func.count(Booking.id)).filter(
                or_(
                    Booking.user_id == request.user_id if request.user_id else False,
                    Booking.contact_email == request.email.lower()
                )
            ).scalar()

            if previous_bookings > 0:
                return PromoCodeValidateResponse(
                    is_valid=False,
                    code=request.code,
                    message="This promo code is only valid for first-time bookings"
                )

        # Calculate discount
        discount_amount = self._calculate_discount(promo, request.booking_amount)
        final_amount = request.booking_amount - discount_amount

        return PromoCodeValidateResponse(
            is_valid=True,
            code=request.code,
            message="Promo code applied successfully",
            discount_type=promo.discount_type.value,
            discount_value=float(promo.discount_value),
            discount_amount=round(discount_amount, 2),
            final_amount=round(final_amount, 2)
        )

    def apply_promo_code(self, request: PromoCodeApplyRequest) -> PromoCodeUsage:
        """
        Apply a promo code to a booking after validation.
        Records usage for fraud prevention tracking.

        Note: This should only be called after validate_promo_code has already
        been called during booking creation. We skip re-validation here to avoid
        issues with the "first booking only" check seeing the newly created booking.
        """
        # Get the promo code
        promo = self.db.query(PromoCode).filter(
            PromoCode.code == request.code,
            PromoCode.is_active == True
        ).first()

        if not promo:
            raise PromoCodeError("Promo code not found")

        # Calculate final amount
        discount_amount = self._calculate_discount(promo, request.original_amount)
        final_amount = request.original_amount - discount_amount

        # Create usage record
        usage = PromoCodeUsage(
            promo_code_id=promo.id,
            booking_id=request.booking_id,
            user_id=request.user_id,
            email=request.email.lower(),
            ip_address=request.ip_address,
            device_fingerprint=request.device_fingerprint,
            discount_amount=discount_amount,
            original_amount=request.original_amount,
            final_amount=final_amount
        )

        # Increment usage count
        promo.current_uses += 1

        self.db.add(usage)
        self.db.commit()
        self.db.refresh(usage)

        return usage

    def _calculate_discount(self, promo: PromoCode, amount: float) -> float:
        """Calculate the discount amount based on promo code type."""
        if promo.discount_type == PromoCodeTypeEnum.PERCENTAGE:
            discount = amount * (float(promo.discount_value) / 100)
        else:  # FIXED_AMOUNT
            discount = float(promo.discount_value)

        # Apply maximum discount cap if set
        if promo.maximum_discount:
            discount = min(discount, float(promo.maximum_discount))

        # Discount cannot exceed the booking amount
        discount = min(discount, amount)

        # Cap discount at 90% of booking amount to ensure minimum payment
        max_allowed_discount = amount * 0.90
        discount = min(discount, max_allowed_discount)

        return round(discount, 2)

    def get_usage_by_booking(self, booking_id: int) -> Optional[PromoCodeUsage]:
        """Get promo code usage for a booking."""
        return self.db.query(PromoCodeUsage).filter(
            PromoCodeUsage.booking_id == booking_id
        ).first()

    def invalidate_usage(self, booking_id: int, reason: str = None):
        """Invalidate promo code usage (e.g., when booking is cancelled)."""
        usage = self.db.query(PromoCodeUsage).filter(
            PromoCodeUsage.booking_id == booking_id
        ).first()

        if usage:
            usage.is_valid = False
            # Decrement the promo code usage count
            promo = self.db.query(PromoCode).filter(
                PromoCode.id == usage.promo_code_id
            ).first()
            if promo and promo.current_uses > 0:
                promo.current_uses -= 1

            self.db.commit()

    def get_promo_stats(self, promo_id: int) -> dict:
        """Get statistics for a promo code."""
        promo = self.db.query(PromoCode).filter(PromoCode.id == promo_id).first()
        if not promo:
            raise PromoCodeError("Promo code not found")

        usages = self.db.query(PromoCodeUsage).filter(
            PromoCodeUsage.promo_code_id == promo_id,
            PromoCodeUsage.is_valid == True
        ).all()

        total_discount = sum(float(u.discount_amount) for u in usages)
        unique_emails = len(set(u.email for u in usages))
        avg_discount = total_discount / len(usages) if usages else 0
        last_used = max((u.used_at for u in usages), default=None)

        return {
            "code": promo.code,
            "total_uses": len(usages),
            "total_discount_given": round(total_discount, 2),
            "unique_users": unique_emails,
            "average_discount": round(avg_discount, 2),
            "last_used": last_used
        }

    def check_suspicious_activity(self, promo_id: int) -> List[dict]:
        """
        Check for suspicious activity patterns on a promo code.
        Returns list of potential fraud indicators.
        """
        suspicious = []

        # Check for same IP with multiple emails
        ip_email_groups = self.db.query(
            PromoCodeUsage.ip_address,
            func.count(func.distinct(PromoCodeUsage.email)).label('email_count')
        ).filter(
            PromoCodeUsage.promo_code_id == promo_id,
            PromoCodeUsage.is_valid == True,
            PromoCodeUsage.ip_address.isnot(None)
        ).group_by(PromoCodeUsage.ip_address).having(
            func.count(func.distinct(PromoCodeUsage.email)) > 3
        ).all()

        for ip, count in ip_email_groups:
            suspicious.append({
                "type": "multiple_emails_same_ip",
                "ip_address": ip,
                "email_count": count,
                "severity": "high" if count > 5 else "medium"
            })

        # Check for same device with multiple emails
        device_email_groups = self.db.query(
            PromoCodeUsage.device_fingerprint,
            func.count(func.distinct(PromoCodeUsage.email)).label('email_count')
        ).filter(
            PromoCodeUsage.promo_code_id == promo_id,
            PromoCodeUsage.is_valid == True,
            PromoCodeUsage.device_fingerprint.isnot(None)
        ).group_by(PromoCodeUsage.device_fingerprint).having(
            func.count(func.distinct(PromoCodeUsage.email)) > 2
        ).all()

        for device, count in device_email_groups:
            suspicious.append({
                "type": "multiple_emails_same_device",
                "device_fingerprint": device[:20] + "..." if len(device) > 20 else device,
                "email_count": count,
                "severity": "high" if count > 3 else "medium"
            })

        # Check for rapid succession usage
        # (Multiple uses within 1 hour from same promo code)
        from datetime import timedelta
        recent_usages = self.db.query(PromoCodeUsage).filter(
            PromoCodeUsage.promo_code_id == promo_id,
            PromoCodeUsage.is_valid == True,
            PromoCodeUsage.used_at >= datetime.now(timezone.utc) - timedelta(hours=1)
        ).count()

        if recent_usages > 10:
            suspicious.append({
                "type": "rapid_usage",
                "count_last_hour": recent_usages,
                "severity": "high"
            })

        return suspicious