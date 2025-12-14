"""
Admin API endpoints for platform management.
"""

from typing import Optional
from datetime import datetime, timedelta
import os
import stripe

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from dotenv import load_dotenv
import logging

from app.api.deps import get_db, get_admin_user
from app.models.user import User
from app.models.booking import Booking, BookingStatusEnum
from app.models.payment import Payment, PaymentStatusEnum
from app.services.email_service import email_service

from app.schemas.admin import (
    DashboardStats, DashboardStatsToday, DashboardStatsTotal, DashboardStatsPending,
    UserListResponse, UserResponse, UserUpdate, UserDetailResponse, UserStats,
    BookingListResponse, BookingResponse, BookingUpdate,
    AnalyticsResponse, DailyRevenue, OperatorRevenue,
    RefundRequest, RefundResponse,
    CancelBookingRequest, CancelBookingResponse
)

logger = logging.getLogger(__name__)

# Load environment variables (skip in testing mode)
if os.environ.get("ENVIRONMENT") != "testing":
    load_dotenv()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

router = APIRouter()


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_admin_user)
):
    """
    Get dashboard statistics.

    Returns key metrics for admin dashboard.
    """
    try:
        today = datetime.utcnow().date()

        # Today's bookings
        today_bookings = db.query(func.count(Booking.id)).filter(
            func.date(Booking.created_at) == today
        ).scalar() or 0

        # Today's revenue
        today_revenue = db.query(func.sum(Payment.amount)).filter(
            and_(
                func.date(Payment.created_at) == today,
                Payment.status == "COMPLETED"
            )
        ).scalar() or 0

        # New users today
        today_users = db.query(func.count(User.id)).filter(
            func.date(User.created_at) == today
        ).scalar() or 0

        # Active users (logged in last 7 days)
        active_users = db.query(func.count(User.id)).filter(
            User.last_login >= datetime.utcnow() - timedelta(days=7)
        ).scalar() or 0

        # Total stats
        total_bookings = db.query(func.count(Booking.id)).scalar() or 0
        total_users = db.query(func.count(User.id)).scalar() or 0
        total_revenue = db.query(func.sum(Payment.amount)).filter(
            Payment.status == "COMPLETED"
        ).scalar() or 0

        # Pending actions
        pending_refunds = db.query(func.count(Booking.id)).filter(
            Booking.refund_amount > 0,
            Booking.refund_amount.isnot(None),
            Booking.refund_processed == False
        ).scalar() or 0

        pending_bookings = db.query(func.count(Booking.id)).filter(
            Booking.status == BookingStatusEnum.PENDING
        ).scalar() or 0

        return DashboardStats(
            today=DashboardStatsToday(
                bookings=today_bookings,
                revenue=float(today_revenue),
                new_users=today_users,
                active_users=active_users
            ),
            total=DashboardStatsTotal(
                bookings=total_bookings,
                users=total_users,
                revenue=float(total_revenue)
            ),
            pending=DashboardStatsPending(
                refunds=pending_refunds,
                bookings=pending_bookings
            )
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get dashboard stats: {str(e)}"
        )


@router.get("/users", response_model=UserListResponse)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_admin: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_admin_user)
):
    """
    List all users with filtering and pagination.

    Admins can view and manage all platform users.
    """
    try:
        query = db.query(User)

        # Apply filters
        if search:
            search_filter = or_(
                User.email.ilike(f"%{search}%"),
                User.first_name.ilike(f"%{search}%"),
                User.last_name.ilike(f"%{search}%")
            )
            query = query.filter(search_filter)

        if is_active is not None:
            query = query.filter(User.is_active == is_active)

        if is_admin is not None:
            query = query.filter(User.is_admin == is_admin)

        # Count total
        total = query.count()

        # Get paginated results
        users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

        return UserListResponse(
            users=[UserResponse.from_orm(user) for user in users],
            total=total,
            skip=skip,
            limit=limit
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list users: {str(e)}"
        )


@router.get("/users/{user_id}", response_model=UserDetailResponse)
async def get_user_details(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_admin_user)
):
    """Get detailed user information including bookings and stats."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get user's bookings
    bookings = db.query(Booking).filter(Booking.user_id == user_id).all()

    # Get user's payments
    payments = db.query(Payment).filter(Payment.user_id == user_id).all()

    # Calculate stats
    total_spent = sum(p.amount for p in payments if p.status == "COMPLETED")

    user_response = UserResponse.from_orm(user)

    return UserDetailResponse(
        **user_response.dict(),
        stats=UserStats(
            total_bookings=len(bookings),
            total_spent=float(total_spent),
            member_since=user.created_at
        )
    )


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_admin_user)
):
    """Update user details."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update fields
    for field, value in user_update.dict(exclude_unset=True).items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return UserResponse.from_orm(user)


@router.get("/bookings", response_model=BookingListResponse)
async def list_bookings(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    operator: Optional[str] = None,
    search: Optional[str] = None,
    pending_refund: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_admin_user)
):
    """
    List all bookings with filtering.

    Admins can view and manage all platform bookings.
    """
    query = db.query(Booking)

    # Apply filters
    if status:
        try:
            status_enum = BookingStatusEnum[status.upper()]
            query = query.filter(Booking.status == status_enum)
        except KeyError:
            pass

    # Filter for pending refunds
    if pending_refund:
        query = query.filter(
            Booking.refund_amount > 0,
            Booking.refund_amount.isnot(None),
            Booking.refund_processed == False
        )

    if operator:
        query = query.filter(Booking.operator.ilike(f"%{operator}%"))

    if search:
        search_filter = or_(
            Booking.booking_reference.ilike(f"%{search}%"),
            Booking.contact_email.ilike(f"%{search}%"),
            Booking.contact_first_name.ilike(f"%{search}%"),
            Booking.contact_last_name.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)

    # Count total
    total = query.count()

    # Get paginated results
    bookings = query.order_by(Booking.created_at.desc()).offset(skip).limit(limit).all()

    return BookingListResponse(
        bookings=[BookingResponse.from_orm(booking) for booking in bookings],
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/analytics/revenue", response_model=AnalyticsResponse)
async def get_revenue_analytics(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_admin_user)
):
    """Get revenue analytics for the specified period."""
    start_date = datetime.utcnow() - timedelta(days=days)

    # Daily revenue
    daily_revenue = db.query(
        func.date(Payment.created_at).label("date"),
        func.sum(Payment.amount).label("revenue")
    ).filter(
        and_(
            Payment.created_at >= start_date,
            Payment.status == "COMPLETED"
        )
    ).group_by(func.date(Payment.created_at)).all()

    # Revenue by operator
    operator_revenue = db.query(
        Booking.operator,
        func.sum(Booking.total_amount).label("revenue"),
        func.count(Booking.id).label("bookings")
    ).filter(
        Booking.created_at >= start_date,
        Booking.status.in_([BookingStatusEnum.CONFIRMED, BookingStatusEnum.COMPLETED])
    ).group_by(Booking.operator).all()

    return AnalyticsResponse(
        period_days=days,
        daily_revenue=[
            DailyRevenue(date=str(date), revenue=float(revenue or 0))
            for date, revenue in daily_revenue
        ],
        by_operator=[
            OperatorRevenue(
                operator=op or "Unknown",
                revenue=float(rev or 0),
                bookings=count or 0
            )
            for op, rev, count in operator_revenue
        ]
    )


@router.post("/bookings/{booking_id}/cancel", response_model=CancelBookingResponse)
async def cancel_booking_admin(
    booking_id: int,
    cancel_request: CancelBookingRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_admin_user)
):
    """
    Cancel a booking (admin action).

    This cancels the booking but does NOT auto-refund.
    The booking will appear in "Pending Refunds" for admin to process manually.
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status == BookingStatusEnum.CANCELLED:
        raise HTTPException(status_code=400, detail="Booking is already cancelled")

    # Get the COMPLETED payment to set refund amount (only completed payments can be refunded)
    payment = db.query(Payment).filter(
        Payment.booking_id == booking_id,
        Payment.status == PaymentStatusEnum.COMPLETED
    ).first()

    booking.status = BookingStatusEnum.CANCELLED
    booking.cancellation_reason = f"Admin cancellation: {cancel_request.reason}"
    booking.cancelled_at = datetime.utcnow()

    # Set refund amount (but don't process yet - admin can do that from Pending Refunds)
    if payment and payment.amount:
        booking.refund_amount = float(payment.amount)
        booking.refund_processed = False
    else:
        # No completed payment found - nothing to refund
        booking.refund_amount = 0
        booking.refund_processed = True  # Mark as processed since there's nothing to refund

    db.commit()
    db.refresh(booking)

    # Queue cancellation email asynchronously (non-blocking)
    try:
        from app.tasks.email_tasks import send_cancellation_email_task

        booking_dict = {
            "id": booking.id,
            "booking_reference": booking.booking_reference,
            "operator": booking.operator,
            "departure_port": booking.departure_port,
            "arrival_port": booking.arrival_port,
            "departure_time": booking.departure_time.isoformat() if booking.departure_time else None,
            "arrival_time": booking.arrival_time.isoformat() if booking.arrival_time else None,
            "vessel_name": booking.vessel_name,
            "contact_email": booking.contact_email,
            "contact_first_name": booking.contact_first_name,
            "contact_last_name": booking.contact_last_name,
            "total_passengers": booking.total_passengers,
            "total_vehicles": booking.total_vehicles,
            "cancellation_reason": cancel_request.reason,
            "cancelled_at": booking.cancelled_at.isoformat() if booking.cancelled_at else None,
            "refund_amount": float(booking.refund_amount) if booking.refund_amount else None,
            "base_url": os.getenv("BASE_URL", "http://localhost:3001")
        }

        # Queue email task (returns immediately)
        task = send_cancellation_email_task.delay(
            booking_data=booking_dict,
            to_email=booking.contact_email
        )
        logger.info(f"Cancellation email queued: task_id={task.id}")

    except Exception as e:
        # Log error but don't fail the cancellation
        logger.error(f"Failed to queue cancellation email for booking {booking_id}: {str(e)}")

    if payment and payment.amount:
        message = f"Booking cancelled. Refund of €{booking.refund_amount:.2f} pending admin approval."
    else:
        message = "Booking cancelled. No completed payment found - nothing to refund."

    return CancelBookingResponse(
        message=message,
        booking_reference=booking.booking_reference,
        cancelled_at=booking.cancelled_at
    )


@router.post("/bookings/{booking_id}/refund", response_model=RefundResponse)
async def process_refund(
    booking_id: int,
    refund_request: RefundRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_admin_user)
):
    """Process a refund for a booking."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.refund_processed:
        raise HTTPException(status_code=400, detail="Refund already processed")

    # Get the COMPLETED payment for this booking (there may be multiple payment attempts)
    payment = db.query(Payment).filter(
        Payment.booking_id == booking_id,
        Payment.status == PaymentStatusEnum.COMPLETED
    ).first()

    if not payment:
        # Check if there are any payments at all
        any_payment = db.query(Payment).filter(Payment.booking_id == booking_id).first()
        if not any_payment:
            raise HTTPException(status_code=404, detail="No payment found for this booking")
        else:
            raise HTTPException(
                status_code=400,
                detail=f"No completed payment found for this booking. Payment status is {any_payment.status.value if hasattr(any_payment.status, 'value') else any_payment.status}"
            )

    if not payment.stripe_payment_intent_id:
        raise HTTPException(status_code=400, detail="No Stripe payment intent found")

    try:
        # Process actual refund via Stripe
        refund = stripe.Refund.create(
            payment_intent=payment.stripe_payment_intent_id,
            amount=int(refund_request.amount * 100)  # Stripe uses cents
        )

        # Update booking
        booking.refund_amount = refund_request.amount
        booking.refund_processed = True
        if refund_request.reason:
            booking.cancellation_reason = refund_request.reason

        # Update payment status
        payment.status = "REFUNDED"
        payment.refund_amount = refund_request.amount

        db.commit()
        db.refresh(booking)

        # Queue refund confirmation email asynchronously (non-blocking)
        try:
            from app.tasks.email_tasks import send_refund_confirmation_email_task

            booking_dict = {
                "id": booking.id,
                "booking_reference": booking.booking_reference,
                "operator": booking.operator,
                "departure_port": booking.departure_port,
                "arrival_port": booking.arrival_port,
                "departure_time": booking.departure_time.isoformat() if booking.departure_time else None,
                "contact_email": booking.contact_email,
                "total_amount": float(booking.total_amount) if booking.total_amount else 0,
                "refund_amount": refund_request.amount,
                "currency": booking.currency or "EUR",
                "stripe_refund_id": refund.id,
                "refunded_at": datetime.utcnow().isoformat(),
                "base_url": os.getenv("BASE_URL", "http://localhost:3001")
            }

            # Queue email task (returns immediately)
            task = send_refund_confirmation_email_task.delay(
                booking_data=booking_dict,
                to_email=booking.contact_email
            )
            logger.info(f"Refund confirmation email queued: task_id={task.id}")

        except Exception as email_error:
            # Log error but don't fail the refund
            logger.error(f"Failed to queue refund confirmation email for booking {booking_id}: {str(email_error)}")

        return RefundResponse(
            message=f"Refund processed successfully (Stripe ID: {refund.id})",
            amount=refund_request.amount,
            booking_id=booking_id
        )

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Refund error: {str(e)}"
        )


# =============================================================================
# Email Dead-Letter Queue Management
# =============================================================================

@router.get("/emails/dead-letter-queue")
async def get_email_dead_letter_queue(
    current_admin: User = Depends(get_admin_user)
):
    """
    Get statistics and contents of the email dead-letter queue.

    Shows failed emails that exhausted all retries.
    """
    from app.tasks.email_tasks import get_dead_letter_queue_stats, get_failed_emails

    stats = get_dead_letter_queue_stats()
    failed_emails = get_failed_emails(limit=50)

    return {
        "stats": stats,
        "failed_emails": failed_emails
    }


@router.post("/emails/dead-letter-queue/retry/{queue_index}")
async def retry_single_failed_email(
    queue_index: int,
    current_admin: User = Depends(get_admin_user)
):
    """
    Retry a specific failed email from the dead-letter queue.

    Args:
        queue_index: Index of the email in the queue (0 = most recent failure)
    """
    from app.tasks.email_tasks import retry_failed_email

    result = retry_failed_email(queue_index)

    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])

    return result


@router.post("/emails/dead-letter-queue/retry-all")
async def retry_all_failed_emails_endpoint(
    current_admin: User = Depends(get_admin_user)
):
    """
    Retry all failed emails in the dead-letter queue.

    Re-queues all failed emails for another delivery attempt.
    """
    from app.tasks.email_tasks import retry_all_failed_emails

    result = retry_all_failed_emails()

    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])

    return result


@router.delete("/emails/dead-letter-queue")
async def clear_email_dead_letter_queue(
    current_admin: User = Depends(get_admin_user)
):
    """
    Clear all items from the email dead-letter queue.

    Warning: This permanently deletes all failed emails without retrying.
    """
    from app.tasks.email_tasks import clear_dead_letter_queue

    result = clear_dead_letter_queue()

    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])

    return result


# =============================================================================
# Universal Dead-Letter Queue Management (All Task Types)
# =============================================================================

@router.get("/dlq/stats")
async def get_dlq_stats_endpoint(
    category: Optional[str] = Query(None, description="Filter by category: email, payment, booking, price_alert, availability, sync"),
    current_admin: User = Depends(get_admin_user)
):
    """
    Get dead-letter queue statistics for all task types.

    Returns Redis and Database DLQ counts by category.
    """
    from app.tasks.base_task import get_dlq_stats

    return get_dlq_stats(category)


@router.get("/dlq/redis/{category}")
async def get_redis_dlq_tasks(
    category: str,
    limit: int = Query(50, ge=1, le=200),
    current_admin: User = Depends(get_admin_user)
):
    """
    Get failed tasks from Redis DLQ for a specific category.

    Categories: email, payment, booking, price_alert, availability, sync, other
    """
    from app.tasks.base_task import get_failed_tasks_from_redis

    valid_categories = ["email", "payment", "booking", "price_alert", "availability", "sync", "other"]
    if category not in valid_categories:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Must be one of: {valid_categories}"
        )

    return {
        "category": category,
        "tasks": get_failed_tasks_from_redis(category, limit)
    }


@router.get("/dlq/database")
async def get_database_dlq_tasks(
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by status: pending, retried, resolved, ignored"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_admin: User = Depends(get_admin_user)
):
    """
    Get failed tasks from Database DLQ with filtering and pagination.

    Supports filtering by category and status.
    """
    from app.tasks.base_task import get_failed_tasks_from_db

    return get_failed_tasks_from_db(category, status, limit, offset)


@router.post("/dlq/redis/{category}/retry/{queue_index}")
async def retry_redis_dlq_task(
    category: str,
    queue_index: int,
    current_admin: User = Depends(get_admin_user)
):
    """
    Retry a specific failed task from Redis DLQ.

    Args:
        category: Task category (email, payment, booking, etc.)
        queue_index: Index of the task in the queue (0 = most recent)
    """
    from app.tasks.base_task import retry_failed_task_from_redis

    result = retry_failed_task_from_redis(category, queue_index)

    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])

    return result


@router.delete("/dlq/redis/{category}")
async def clear_redis_dlq_endpoint(
    category: str,
    current_admin: User = Depends(get_admin_user)
):
    """
    Clear all items from a Redis DLQ category.

    Warning: This permanently deletes all failed tasks without retrying.
    """
    from app.tasks.base_task import clear_redis_dlq

    valid_categories = ["email", "payment", "booking", "price_alert", "availability", "sync", "other"]
    if category not in valid_categories:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Must be one of: {valid_categories}"
        )

    result = clear_redis_dlq(category)

    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])

    return result


@router.patch("/dlq/database/{task_id}")
async def update_database_dlq_task(
    task_id: int,
    status: str = Query(..., description="New status: pending, retried, resolved, ignored"),
    resolution_notes: Optional[str] = Query(None, description="Notes about resolution"),
    current_admin: User = Depends(get_admin_user)
):
    """
    Update the status of a failed task in the database.

    Use to mark tasks as resolved, ignored, or retried.
    """
    from app.tasks.base_task import update_db_task_status

    valid_statuses = ["pending", "retried", "resolved", "ignored"]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )

    result = update_db_task_status(
        task_id=task_id,
        status=status,
        resolution_notes=resolution_notes,
        resolved_by=current_admin.email
    )

    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])

    return result


@router.post("/dlq/database/{task_id}/retry")
async def retry_database_dlq_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_admin_user)
):
    """
    Retry a failed task from the database DLQ.

    Re-queues the task and updates its status.
    """
    from app.models.failed_task import FailedTask, FailedTaskStatusEnum
    from app.celery_app import celery_app
    from datetime import datetime, timezone

    task = db.query(FailedTask).filter(FailedTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    # Get the Celery task
    celery_task = celery_app.tasks.get(task.task_name)
    if not celery_task:
        raise HTTPException(status_code=400, detail=f"Task {task.task_name} not registered")

    try:
        # Re-queue the task
        result = celery_task.apply_async(kwargs=task.kwargs or {})

        # Update status
        task.status = FailedTaskStatusEnum.RETRIED
        task.retried_at = datetime.now(timezone.utc)
        task.retry_count += 1
        db.commit()

        return {
            "status": "success",
            "message": "Task re-queued",
            "new_task_id": result.id,
            "task_name": task.task_name
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# DLQ Testing Endpoint (Staging/Dev only)
# =============================================================================

@router.post("/dlq/test-failure")
async def trigger_test_failure(
    category: str = Query("email", description="Task category to test"),
    current_admin: User = Depends(get_admin_user)
):
    """
    Trigger a test task that always fails (for DLQ testing).

    Only works in staging/development environments.
    The task will fail 3 times and end up in the DLQ.
    """
    env = os.getenv("ENVIRONMENT", "development")
    if env == "production":
        raise HTTPException(
            status_code=403,
            detail="Test failure endpoint is disabled in production"
        )

    from app.tasks.test_tasks import test_failing_task

    # Trigger the test task
    result = test_failing_task.delay(
        category=category,
        test_id=f"test-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    )

    return {
        "status": "triggered",
        "task_id": result.id,
        "category": category,
        "message": "Test task triggered. It will fail 3 times and appear in DLQ."
    }
