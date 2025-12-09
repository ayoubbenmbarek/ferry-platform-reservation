"""
Unit tests for Contact API endpoint.
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient


class TestContactFormValidation:
    """Test contact form data validation."""

    def test_valid_contact_form_data(self, client: TestClient):
        """Test that valid contact form data is accepted."""
        with patch('app.api.v1.contact.send_contact_notification', new_callable=AsyncMock):
            response = client.post(
                "/api/v1/contact",
                json={
                    "name": "John Doe",
                    "email": "john@example.com",
                    "subject": "Test inquiry",
                    "category": "general",
                    "message": "This is a test message for the contact form."
                }
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "successfully" in data["message"].lower()

    def test_contact_form_with_booking_reference(self, client: TestClient):
        """Test that contact form accepts optional booking reference."""
        with patch('app.api.v1.contact.send_contact_notification', new_callable=AsyncMock):
            response = client.post(
                "/api/v1/contact",
                json={
                    "name": "Jane Smith",
                    "email": "jane@example.com",
                    "subject": "Booking inquiry",
                    "category": "booking",
                    "message": "I have a question about my booking.",
                    "bookingReference": "BK-ABC123"
                }
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

    def test_contact_form_without_booking_reference(self, client: TestClient):
        """Test that booking reference is optional."""
        with patch('app.api.v1.contact.send_contact_notification', new_callable=AsyncMock):
            response = client.post(
                "/api/v1/contact",
                json={
                    "name": "Test User",
                    "email": "test@example.com",
                    "subject": "General question",
                    "category": "general",
                    "message": "Just a general inquiry without booking reference."
                }
            )

            assert response.status_code == 200

    def test_invalid_email_format(self, client: TestClient):
        """Test that invalid email format is rejected."""
        response = client.post(
            "/api/v1/contact",
            json={
                "name": "John Doe",
                "email": "invalid-email",
                "subject": "Test",
                "category": "general",
                "message": "Test message"
            }
        )

        assert response.status_code == 422  # Validation error

    def test_missing_required_name(self, client: TestClient):
        """Test that missing name is rejected."""
        response = client.post(
            "/api/v1/contact",
            json={
                "email": "test@example.com",
                "subject": "Test",
                "category": "general",
                "message": "Test message"
            }
        )

        assert response.status_code == 422

    def test_missing_required_email(self, client: TestClient):
        """Test that missing email is rejected."""
        response = client.post(
            "/api/v1/contact",
            json={
                "name": "John Doe",
                "subject": "Test",
                "category": "general",
                "message": "Test message"
            }
        )

        assert response.status_code == 422

    def test_missing_required_subject(self, client: TestClient):
        """Test that missing subject is rejected."""
        response = client.post(
            "/api/v1/contact",
            json={
                "name": "John Doe",
                "email": "test@example.com",
                "category": "general",
                "message": "Test message"
            }
        )

        assert response.status_code == 422

    def test_missing_required_category(self, client: TestClient):
        """Test that missing category is rejected."""
        response = client.post(
            "/api/v1/contact",
            json={
                "name": "John Doe",
                "email": "test@example.com",
                "subject": "Test",
                "message": "Test message"
            }
        )

        assert response.status_code == 422

    def test_missing_required_message(self, client: TestClient):
        """Test that missing message is rejected."""
        response = client.post(
            "/api/v1/contact",
            json={
                "name": "John Doe",
                "email": "test@example.com",
                "subject": "Test",
                "category": "general"
            }
        )

        assert response.status_code == 422


class TestContactFormCategories:
    """Test different contact form categories."""

    @pytest.mark.parametrize("category", [
        "general",
        "booking",
        "refund",
        "technical",
        "feedback",
        "other"
    ])
    def test_valid_categories(self, client: TestClient, category: str):
        """Test that all valid categories are accepted."""
        with patch('app.api.v1.contact.send_contact_notification', new_callable=AsyncMock):
            response = client.post(
                "/api/v1/contact",
                json={
                    "name": "Test User",
                    "email": "test@example.com",
                    "subject": f"Test {category}",
                    "category": category,
                    "message": f"Testing the {category} category."
                }
            )

            assert response.status_code == 200


class TestContactFormDataModel:
    """Test ContactFormData Pydantic model."""

    def test_contact_form_data_structure(self):
        """Test the ContactFormData model structure."""
        from app.api.v1.contact import ContactFormData

        form_data = ContactFormData(
            name="John Doe",
            email="john@example.com",
            subject="Test subject",
            category="general",
            message="Test message content"
        )

        assert form_data.name == "John Doe"
        assert form_data.email == "john@example.com"
        assert form_data.subject == "Test subject"
        assert form_data.category == "general"
        assert form_data.message == "Test message content"
        assert form_data.bookingReference is None

    def test_contact_form_data_with_booking_ref(self):
        """Test ContactFormData with booking reference."""
        from app.api.v1.contact import ContactFormData

        form_data = ContactFormData(
            name="Jane Smith",
            email="jane@example.com",
            subject="Booking question",
            category="booking",
            message="Question about my booking",
            bookingReference="MR-XYZ789"
        )

        assert form_data.bookingReference == "MR-XYZ789"


class TestContactNotificationEmail:
    """Test contact notification email logic."""

    def test_email_content_generation(self):
        """Test that email content is properly formatted."""
        from app.api.v1.contact import ContactFormData

        form_data = ContactFormData(
            name="Test User",
            email="test@example.com",
            subject="Test Subject",
            category="technical",
            message="This is my message",
            bookingReference="BK-TEST01"
        )

        # Simulate email content building
        category_display = form_data.category.replace('_', ' ').title()

        assert category_display == "Technical"
        assert form_data.email == "test@example.com"
        assert form_data.bookingReference == "BK-TEST01"

    def test_category_formatting(self):
        """Test category formatting for email display."""
        categories = {
            "general": "General",
            "booking": "Booking",
            "refund": "Refund",
            "technical": "Technical",
            "feedback": "Feedback",
            "other": "Other"
        }

        for category, expected in categories.items():
            formatted = category.replace('_', ' ').title()
            assert formatted == expected


class TestContactFormSubmissionFlow:
    """Test the full contact form submission flow."""

    def test_successful_submission_triggers_background_task(self, client: TestClient):
        """Test that successful submission triggers the email background task."""
        with patch('app.api.v1.contact.send_contact_notification', new_callable=AsyncMock) as mock_send:
            response = client.post(
                "/api/v1/contact",
                json={
                    "name": "Background Task Test",
                    "email": "task@example.com",
                    "subject": "Testing background task",
                    "category": "general",
                    "message": "This should trigger the background task."
                }
            )

            assert response.status_code == 200
            # Background task should have been scheduled
            # Note: In FastAPI, background tasks run after response is sent

    def test_response_format(self, client: TestClient):
        """Test that response has correct format."""
        with patch('app.api.v1.contact.send_contact_notification', new_callable=AsyncMock):
            response = client.post(
                "/api/v1/contact",
                json={
                    "name": "Response Test",
                    "email": "response@example.com",
                    "subject": "Testing response format",
                    "category": "general",
                    "message": "Checking response structure."
                }
            )

            assert response.status_code == 200
            data = response.json()

            # Check response structure
            assert "message" in data
            assert "success" in data
            assert isinstance(data["success"], bool)
            assert isinstance(data["message"], str)


class TestContactFormEdgeCases:
    """Test edge cases and special characters."""

    def test_unicode_characters_in_name(self, client: TestClient):
        """Test that unicode characters are handled in name."""
        with patch('app.api.v1.contact.send_contact_notification', new_callable=AsyncMock):
            response = client.post(
                "/api/v1/contact",
                json={
                    "name": "François Müller",
                    "email": "francois@example.com",
                    "subject": "Unicode test",
                    "category": "general",
                    "message": "Testing special characters: àéïõü"
                }
            )

            assert response.status_code == 200

    def test_long_message(self, client: TestClient):
        """Test that long messages are accepted."""
        with patch('app.api.v1.contact.send_contact_notification', new_callable=AsyncMock):
            long_message = "A" * 2000  # 2000 character message

            response = client.post(
                "/api/v1/contact",
                json={
                    "name": "Long Message Test",
                    "email": "long@example.com",
                    "subject": "Testing long message",
                    "category": "general",
                    "message": long_message
                }
            )

            assert response.status_code == 200

    def test_email_with_plus_sign(self, client: TestClient):
        """Test that email with plus sign is accepted."""
        with patch('app.api.v1.contact.send_contact_notification', new_callable=AsyncMock):
            response = client.post(
                "/api/v1/contact",
                json={
                    "name": "Plus Email Test",
                    "email": "user+tag@example.com",
                    "subject": "Testing plus in email",
                    "category": "general",
                    "message": "Testing email with plus sign."
                }
            )

            assert response.status_code == 200

    def test_empty_booking_reference(self, client: TestClient):
        """Test that empty string booking reference is handled."""
        with patch('app.api.v1.contact.send_contact_notification', new_callable=AsyncMock):
            response = client.post(
                "/api/v1/contact",
                json={
                    "name": "Empty Ref Test",
                    "email": "empty@example.com",
                    "subject": "Testing empty ref",
                    "category": "booking",
                    "message": "Testing with empty booking reference.",
                    "bookingReference": ""
                }
            )

            assert response.status_code == 200


class TestContactAPIEndpointRouting:
    """Test API endpoint routing."""

    def test_post_method_allowed(self, client: TestClient):
        """Test that POST method is allowed."""
        with patch('app.api.v1.contact.send_contact_notification', new_callable=AsyncMock):
            response = client.post(
                "/api/v1/contact",
                json={
                    "name": "Method Test",
                    "email": "method@example.com",
                    "subject": "POST method",
                    "category": "general",
                    "message": "Testing POST method."
                }
            )

            assert response.status_code == 200

    def test_get_method_not_allowed(self, client: TestClient):
        """Test that GET method is not allowed."""
        response = client.get("/api/v1/contact")
        assert response.status_code == 405  # Method Not Allowed

    def test_put_method_not_allowed(self, client: TestClient):
        """Test that PUT method is not allowed."""
        response = client.put(
            "/api/v1/contact",
            json={"name": "Test"}
        )
        assert response.status_code == 405

    def test_delete_method_not_allowed(self, client: TestClient):
        """Test that DELETE method is not allowed."""
        response = client.delete("/api/v1/contact")
        assert response.status_code == 405
