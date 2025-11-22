"""
Test script for async architecture integration.

This script tests the complete async flow:
1. Redis caching for ferry search
2. Async email tasks for booking operations
3. Cache invalidation on booking/cancellation

Run with: python test_async_flow.py
"""

import time
import asyncio
from app.services.cache_service import cache_service
from app.tasks.email_tasks import (
    send_booking_confirmation_email_task,
    send_cancellation_email_task,
    send_payment_success_email_task,
    send_refund_confirmation_email_task
)

def test_redis_connection():
    """Test Redis connection and basic operations."""
    print("\n" + "="*60)
    print("TEST 1: Redis Connection")
    print("="*60)

    try:
        # Test basic set/get
        test_key = "test:connection"
        test_value = {"status": "working", "timestamp": time.time()}

        cache_service.redis_client.setex(test_key, 10, str(test_value))
        retrieved = cache_service.redis_client.get(test_key)

        if retrieved:
            print("✅ Redis connection successful")
            print(f"   Stored and retrieved: {retrieved}")
            return True
        else:
            print("❌ Redis connection failed - no data retrieved")
            return False
    except Exception as e:
        print(f"❌ Redis connection error: {str(e)}")
        return False


def test_ferry_search_cache():
    """Test ferry search caching."""
    print("\n" + "="*60)
    print("TEST 2: Ferry Search Caching")
    print("="*60)

    try:
        # Test cache params
        cache_params = {
            "departure_port": "Marseille",
            "arrival_port": "Tunis",
            "departure_date": "2025-12-01",
            "adults": 2,
            "children": 0,
            "infants": 0,
            "vehicles": 0,
            "operators": None
        }

        # Test cache miss
        print("\n1. Testing cache MISS...")
        result = cache_service.get_ferry_search(cache_params)
        if result is None:
            print("   ✅ Cache MISS as expected (cache empty)")
        else:
            print("   ⚠️ Unexpected cache HIT - clearing...")
            cache_service.redis_client.delete(cache_service._generate_cache_key("ferry_search", cache_params))

        # Test cache set
        print("\n2. Caching ferry search results...")
        test_data = {
            "results": [
                {
                    "sailing_id": "TEST001",
                    "operator": "CTN",
                    "departure_time": "2025-12-01T10:00:00",
                    "price": 150.00
                }
            ],
            "total_results": 1
        }

        cache_service.set_ferry_search(cache_params, test_data, ttl=300)
        print("   ✅ Data cached successfully")

        # Test cache hit
        print("\n3. Testing cache HIT...")
        cached_result = cache_service.get_ferry_search(cache_params)

        if cached_result and cached_result.get("total_results") == 1:
            print("   ✅ Cache HIT successful")
            print(f"   Retrieved: {cached_result['total_results']} result(s)")
            return True
        else:
            print("   ❌ Cache HIT failed")
            return False

    except Exception as e:
        print(f"❌ Ferry search cache error: {str(e)}")
        return False


def test_availability_cache():
    """Test availability caching and invalidation."""
    print("\n" + "="*60)
    print("TEST 3: Availability Cache & Invalidation")
    print("="*60)

    try:
        sailing_id = "TEST_SAILING_001"

        # Set availability cache
        print("\n1. Caching availability data...")
        availability_data = {
            "passengers": 100,
            "vehicles": 20,
            "last_updated": time.time()
        }

        cache_service.set_sailing_availability(sailing_id, availability_data, ttl=60)
        print(f"   ✅ Cached availability for {sailing_id}")

        # Verify cache hit
        print("\n2. Verifying cache...")
        cached = cache_service.get_sailing_availability(sailing_id)
        if cached and cached.get("passengers") == 100:
            print("   ✅ Cache verified")
        else:
            print("   ❌ Cache verification failed")
            return False

        # Test invalidation
        print("\n3. Testing cache invalidation...")
        cache_service.invalidate_sailing_availability(sailing_id)

        # Verify invalidation
        cached_after = cache_service.get_sailing_availability(sailing_id)
        if cached_after is None:
            print("   ✅ Cache invalidated successfully")
            return True
        else:
            print("   ❌ Cache still present after invalidation")
            return False

    except Exception as e:
        print(f"❌ Availability cache error: {str(e)}")
        return False


def test_email_tasks():
    """Test async email task queuing."""
    print("\n" + "="*60)
    print("TEST 4: Async Email Tasks")
    print("="*60)

    test_booking_data = {
        "id": 999,
        "booking_reference": "TEST_ASYNC_001",
        "contact_email": "test@example.com",
        "contact_name": "Test User",
        "operator": "CTN",
        "departure_port": "Marseille",
        "arrival_port": "Tunis",
        "departure_time": "2025-12-01T10:00:00",
        "arrival_time": "2025-12-01T18:00:00",
        "total_price": 300.00,
        "currency": "EUR",
        "status": "confirmed"
    }

    test_email = "test@example.com"

    try:
        # Test booking confirmation email
        print("\n1. Queuing booking confirmation email...")
        task1 = send_booking_confirmation_email_task.delay(
            booking_data=test_booking_data,
            to_email=test_email
        )
        print(f"   ✅ Task queued: {task1.id}")

        # Test cancellation email
        print("\n2. Queuing cancellation email...")
        task2 = send_cancellation_email_task.delay(
            booking_data=test_booking_data,
            to_email=test_email
        )
        print(f"   ✅ Task queued: {task2.id}")

        # Test payment success email
        print("\n3. Queuing payment success email...")
        payment_data = {
            "payment_intent_id": "pi_test_123",
            "amount": 300.00,
            "currency": "EUR",
            "status": "succeeded"
        }
        task3 = send_payment_success_email_task.delay(
            booking_data=test_booking_data,
            payment_data=payment_data,
            to_email=test_email
        )
        print(f"   ✅ Task queued: {task3.id}")

        # Test refund email
        print("\n4. Queuing refund confirmation email...")
        task4 = send_refund_confirmation_email_task.delay(
            booking_data=test_booking_data,
            to_email=test_email
        )
        print(f"   ✅ Task queued: {task4.id}")

        print("\n✅ All email tasks queued successfully!")
        print("\n   Note: Check Celery worker logs to see task execution:")
        print("   docker logs maritime-celery-dev -f")

        return True

    except Exception as e:
        print(f"❌ Email task error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests."""
    print("\n" + "="*60)
    print("ASYNC ARCHITECTURE INTEGRATION TEST")
    print("="*60)
    print("\nTesting async email workers, Redis caching, and task queuing...")

    results = {
        "Redis Connection": test_redis_connection(),
        "Ferry Search Cache": test_ferry_search_cache(),
        "Availability Cache": test_availability_cache(),
        "Email Tasks": test_email_tasks()
    }

    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)

    total_tests = len(results)
    passed_tests = sum(1 for passed in results.values() if passed)

    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name:.<40} {status}")

    print("\n" + "-"*60)
    print(f"Total: {passed_tests}/{total_tests} tests passed")
    print("="*60)

    if passed_tests == total_tests:
        print("\n🎉 All tests passed! Async architecture is working correctly.")
    else:
        print(f"\n⚠️ {total_tests - passed_tests} test(s) failed. Check the errors above.")

    return passed_tests == total_tests


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
