#!/usr/bin/env python3
"""
Test script to verify async architecture is working correctly.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

def test_redis_connection():
    """Test Redis cache service connection."""
    print("\n1️⃣ Testing Redis Cache Connection...")
    try:
        from app.services.cache_service import cache_service

        if cache_service.is_available():
            print("✅ Redis cache connected successfully")

            # Test cache operations
            test_data = {"test": "data", "timestamp": "2025-11-21"}
            cache_service.redis_client.setex("test_key", 10, "test_value")
            result = cache_service.redis_client.get("test_key")

            if result == "test_value":
                print("✅ Cache read/write operations working")
            else:
                print("❌ Cache operations failed")

            cache_service.redis_client.delete("test_key")
            return True
        else:
            print("❌ Redis cache not available")
            return False
    except Exception as e:
        print(f"❌ Redis cache error: {e}")
        return False


def test_celery_connection():
    """Test Celery worker connection."""
    print("\n2️⃣ Testing Celery Worker Connection...")
    try:
        from app.celery_app import celery_app

        # Check if workers are active
        result = celery_app.control.inspect().ping()

        if result:
            print(f"✅ Celery workers active: {list(result.keys())}")

            # Check registered tasks
            registered = celery_app.control.inspect().registered()
            if registered:
                task_count = sum(len(tasks) for tasks in registered.values())
                print(f"✅ {task_count} tasks registered")

                # List some tasks
                for worker, tasks in registered.items():
                    print(f"\n   Worker: {worker}")
                    for task in tasks[:5]:  # Show first 5
                        print(f"     • {task}")
                    if len(tasks) > 5:
                        print(f"     ... and {len(tasks) - 5} more")

            return True
        else:
            print("❌ No Celery workers found")
            print("   Start workers with: docker-compose -f docker-compose.dev.yml up celery-worker")
            return False

    except Exception as e:
        print(f"❌ Celery connection error: {e}")
        return False


def test_email_task():
    """Test queuing an email task."""
    print("\n3️⃣ Testing Email Task Queuing...")
    try:
        from app.tasks.email_tasks import send_cancellation_email_task

        # Queue a test task (won't actually send email in test)
        booking_data = {
            "booking_reference": "TEST123",
            "contact_email": "test@example.com",
            "operator": "CTN",
            "departure_port": "Tunis",
            "arrival_port": "Marseille",
        }

        # Use apply_async with countdown to delay execution
        task = send_cancellation_email_task.apply_async(
            kwargs={
                "booking_data": booking_data,
                "to_email": "test@example.com"
            },
            countdown=3600  # Delay 1 hour so it doesn't actually send
        )

        print(f"✅ Email task queued successfully")
        print(f"   Task ID: {task.id}")
        print(f"   Status: {task.status}")

        # Revoke the task so it doesn't execute
        task.revoke()
        print(f"✅ Test task revoked (won't execute)")

        return True

    except Exception as e:
        print(f"❌ Email task error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_queue_stats():
    """Test queue statistics."""
    print("\n4️⃣ Testing Queue Statistics...")
    try:
        from app.celery_app import celery_app

        # Get queue stats
        stats = celery_app.control.inspect().stats()

        if stats:
            for worker, worker_stats in stats.items():
                print(f"\n   Worker: {worker}")
                print(f"     Total tasks: {worker_stats.get('total', {})}")
                print(f"     Pool: {worker_stats.get('pool', {})}")

            # Check queue lengths
            try:
                import redis
                redis_client = redis.Redis(
                    host=os.getenv("REDIS_HOST", "localhost"),
                    port=int(os.getenv("REDIS_PORT", "6399")),
                    db=1,  # Celery uses DB 1
                    decode_responses=True
                )

                queues = ["emails", "payments", "bookings", "celery"]
                print(f"\n   Queue Lengths:")
                for queue in queues:
                    length = redis_client.llen(queue)
                    print(f"     • {queue}: {length} pending tasks")

            except Exception as e:
                print(f"     (Could not check queue lengths: {e})")

            return True
        else:
            print("❌ Could not get worker stats")
            return False

    except Exception as e:
        print(f"❌ Queue stats error: {e}")
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("🧪 Testing Async Architecture Setup")
    print("=" * 60)

    results = {
        "Redis Cache": test_redis_connection(),
        "Celery Workers": test_celery_connection(),
        "Email Tasks": test_email_task(),
        "Queue Stats": test_queue_stats(),
    }

    print("\n" + "=" * 60)
    print("📊 Test Results Summary")
    print("=" * 60)

    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")

    all_passed = all(results.values())

    if all_passed:
        print("\n🎉 All tests passed! Async architecture is ready.")
        print("\n📚 Next steps:")
        print("   1. Integrate caching into ferry search endpoint")
        print("   2. Replace direct email calls with async tasks")
        print("   3. Add Stripe webhook endpoint")
        return 0
    else:
        print("\n⚠️  Some tests failed. Check the output above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
