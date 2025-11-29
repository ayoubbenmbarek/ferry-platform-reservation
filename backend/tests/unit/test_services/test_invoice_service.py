"""
Unit tests for Invoice Service.
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch, MagicMock
import os

from app.services.invoice_service import InvoiceService, invoice_service


class TestInvoiceServiceInit:
    """Tests for InvoiceService initialization."""

    def test_default_company_info(self):
        """Test default company information."""
        service = InvoiceService()
        assert service.company_name == "Maritime Booking System"
        assert "Port Street" in service.company_address or service.company_address
        assert service.company_email
        assert service.company_phone
        assert service.company_tax_id

    def test_custom_company_info_from_env(self):
        """Test company info can be set from environment variables."""
        with patch.dict(os.environ, {
            'COMPANY_NAME': 'Test Company',
            'COMPANY_ADDRESS': '456 Test Ave',
            'COMPANY_EMAIL': 'test@test.com',
            'COMPANY_PHONE': '+1234567890',
            'COMPANY_TAX_ID': 'TAX123'
        }):
            service = InvoiceService()
            assert service.company_name == 'Test Company'
            assert service.company_address == '456 Test Ave'
            assert service.company_email == 'test@test.com'
            assert service.company_phone == '+1234567890'
            assert service.company_tax_id == 'TAX123'

    def test_singleton_instance(self):
        """Test that invoice_service is a singleton."""
        assert invoice_service is not None
        assert isinstance(invoice_service, InvoiceService)


class TestGenerateInvoice:
    """Tests for generate_invoice method."""

    @pytest.fixture
    def basic_booking_data(self):
        """Basic booking data for testing."""
        return {
            'id': 1,
            'booking_reference': 'MR-TEST001',
            'operator': 'CTN',
            'departure_port': 'Tunis',
            'arrival_port': 'Marseille',
            'departure_time': datetime.now() + timedelta(days=7),
            'vessel_name': 'Carthage',
            'contact_first_name': 'John',
            'contact_last_name': 'Doe',
            'contact_email': 'john@example.com',
            'contact_phone': '+33612345678',
            'total_passengers': 2,
            'total_vehicles': 0,
            'subtotal': 300.00,
            'tax_amount': 30.00,
            'total_amount': 330.00,
            'currency': 'EUR',
            'is_round_trip': False,
            'cabin_supplement': 0
        }

    @pytest.fixture
    def basic_payment_data(self):
        """Basic payment data for testing."""
        return {
            'payment_method': 'credit_card',
            'stripe_payment_intent_id': 'pi_test_123',
            'stripe_charge_id': 'ch_test_123',
            'card_brand': 'visa',
            'card_last_four': '4242'
        }

    @pytest.fixture
    def passengers_data(self):
        """Sample passengers data."""
        return [
            {
                'passenger_type': 'ADULT',
                'first_name': 'John',
                'last_name': 'Doe',
                'final_price': 150.00
            },
            {
                'passenger_type': 'CHILD',
                'first_name': 'Jane',
                'last_name': 'Doe',
                'final_price': 75.00
            }
        ]

    @pytest.fixture
    def vehicles_data(self):
        """Sample vehicles data."""
        return [
            {
                'vehicle_type': 'CAR',
                'license_plate': 'AB-123-CD',
                'final_price': 200.00
            }
        ]

    @pytest.fixture
    def meals_data(self):
        """Sample meals data."""
        return [
            {
                'meal_name': 'Lunch Menu',
                'quantity': 2,
                'unit_price': 15.00,
                'total_price': 30.00
            }
        ]

    def test_generate_basic_invoice(self, basic_booking_data, basic_payment_data):
        """Test generating a basic invoice returns PDF bytes."""
        service = InvoiceService()
        pdf_content = service.generate_invoice(
            booking=basic_booking_data,
            payment=basic_payment_data
        )

        # Verify PDF content
        assert pdf_content is not None
        assert isinstance(pdf_content, bytes)
        assert len(pdf_content) > 0
        # PDF files start with %PDF
        assert pdf_content[:4] == b'%PDF'

    def test_generate_invoice_with_passengers(
        self, basic_booking_data, basic_payment_data, passengers_data
    ):
        """Test generating invoice with passenger details."""
        service = InvoiceService()
        pdf_content = service.generate_invoice(
            booking=basic_booking_data,
            payment=basic_payment_data,
            passengers=passengers_data
        )

        assert pdf_content is not None
        assert pdf_content[:4] == b'%PDF'

    def test_generate_invoice_with_vehicles(
        self, basic_booking_data, basic_payment_data, vehicles_data
    ):
        """Test generating invoice with vehicle details."""
        basic_booking_data['total_vehicles'] = 1
        service = InvoiceService()
        pdf_content = service.generate_invoice(
            booking=basic_booking_data,
            payment=basic_payment_data,
            vehicles=vehicles_data
        )

        assert pdf_content is not None
        assert pdf_content[:4] == b'%PDF'

    def test_generate_invoice_with_meals(
        self, basic_booking_data, basic_payment_data, meals_data
    ):
        """Test generating invoice with meal details."""
        service = InvoiceService()
        pdf_content = service.generate_invoice(
            booking=basic_booking_data,
            payment=basic_payment_data,
            meals=meals_data
        )

        assert pdf_content is not None
        assert pdf_content[:4] == b'%PDF'

    def test_generate_invoice_with_cabin(self, basic_booking_data, basic_payment_data):
        """Test generating invoice with cabin supplement."""
        basic_booking_data['cabin_supplement'] = 100.00
        basic_booking_data['subtotal'] = 400.00
        basic_booking_data['tax_amount'] = 40.00
        basic_booking_data['total_amount'] = 440.00

        service = InvoiceService()
        pdf_content = service.generate_invoice(
            booking=basic_booking_data,
            payment=basic_payment_data
        )

        assert pdf_content is not None
        assert pdf_content[:4] == b'%PDF'

    def test_generate_round_trip_invoice(self, basic_booking_data, basic_payment_data):
        """Test generating invoice for round trip booking."""
        basic_booking_data['is_round_trip'] = True
        basic_booking_data['return_sailing_id'] = 'CTN-RET-001'
        basic_booking_data['return_departure_port'] = 'Marseille'
        basic_booking_data['return_arrival_port'] = 'Tunis'
        basic_booking_data['return_departure_time'] = datetime.now() + timedelta(days=14)
        basic_booking_data['return_vessel_name'] = 'Carthage'
        basic_booking_data['return_operator'] = 'CTN'

        service = InvoiceService()
        pdf_content = service.generate_invoice(
            booking=basic_booking_data,
            payment=basic_payment_data
        )

        assert pdf_content is not None
        assert pdf_content[:4] == b'%PDF'

    def test_generate_round_trip_with_cabins(self, basic_booking_data, basic_payment_data):
        """Test generating round trip invoice with both cabin supplements."""
        basic_booking_data['is_round_trip'] = True
        basic_booking_data['return_sailing_id'] = 'CTN-RET-001'
        basic_booking_data['return_departure_port'] = 'Marseille'
        basic_booking_data['return_arrival_port'] = 'Tunis'
        basic_booking_data['return_departure_time'] = datetime.now() + timedelta(days=14)
        basic_booking_data['cabin_supplement'] = 100.00
        basic_booking_data['return_cabin_supplement'] = 100.00

        service = InvoiceService()
        pdf_content = service.generate_invoice(
            booking=basic_booking_data,
            payment=basic_payment_data
        )

        assert pdf_content is not None
        assert pdf_content[:4] == b'%PDF'

    def test_generate_invoice_all_details(
        self, basic_booking_data, basic_payment_data,
        passengers_data, vehicles_data, meals_data
    ):
        """Test generating invoice with all details."""
        basic_booking_data['total_vehicles'] = 1
        basic_booking_data['cabin_supplement'] = 50.00

        service = InvoiceService()
        pdf_content = service.generate_invoice(
            booking=basic_booking_data,
            payment=basic_payment_data,
            passengers=passengers_data,
            vehicles=vehicles_data,
            meals=meals_data
        )

        assert pdf_content is not None
        assert pdf_content[:4] == b'%PDF'
        # The PDF should be reasonably sized
        assert len(pdf_content) > 3000

    def test_generate_invoice_string_datetime(self, basic_booking_data, basic_payment_data):
        """Test generating invoice when datetime is string."""
        basic_booking_data['departure_time'] = '2024-06-15T10:00:00Z'

        service = InvoiceService()
        pdf_content = service.generate_invoice(
            booking=basic_booking_data,
            payment=basic_payment_data
        )

        assert pdf_content is not None
        assert pdf_content[:4] == b'%PDF'

    def test_generate_invoice_missing_optional_fields(self, basic_payment_data):
        """Test generating invoice with minimal booking data."""
        minimal_booking = {
            'booking_reference': 'MR-MIN001',
            'contact_first_name': 'Test',
            'contact_last_name': 'User',
            'contact_email': 'test@example.com',
            'total_amount': 100.00,
            'currency': 'EUR'
        }

        service = InvoiceService()
        pdf_content = service.generate_invoice(
            booking=minimal_booking,
            payment=basic_payment_data
        )

        assert pdf_content is not None
        assert pdf_content[:4] == b'%PDF'


class TestGenerateCabinUpgradeInvoice:
    """Tests for generate_cabin_upgrade_invoice method."""

    @pytest.fixture
    def booking_data(self):
        """Basic booking data for cabin upgrade."""
        return {
            'booking_reference': 'MR-CABIN001',
            'operator': 'CTN',
            'departure_port': 'Tunis',
            'arrival_port': 'Marseille',
            'departure_time': datetime.now() + timedelta(days=7),
            'contact_first_name': 'Marie',
            'contact_last_name': 'Dupont',
            'contact_email': 'marie@example.com',
            'currency': 'EUR'
        }

    @pytest.fixture
    def cabin_data(self):
        """Cabin upgrade data."""
        return {
            'cabin_name': 'Inside Twin',
            'cabin_type': 'INSIDE',
            'quantity': 1,
            'unit_price': 50.00,
            'total_price': 50.00,
            'journey_type': 'outbound'
        }

    @pytest.fixture
    def payment_data(self):
        """Payment data for cabin upgrade."""
        return {
            'payment_method': 'credit_card',
            'stripe_payment_intent_id': 'pi_cabin_123',
            'stripe_charge_id': 'ch_cabin_123',
            'card_brand': 'mastercard',
            'card_last_four': '5555'
        }

    def test_generate_cabin_upgrade_invoice(self, booking_data, cabin_data, payment_data):
        """Test generating cabin upgrade invoice."""
        service = InvoiceService()
        pdf_content = service.generate_cabin_upgrade_invoice(
            booking=booking_data,
            cabin_data=cabin_data,
            payment=payment_data
        )

        assert pdf_content is not None
        assert isinstance(pdf_content, bytes)
        assert pdf_content[:4] == b'%PDF'

    def test_cabin_upgrade_invoice_return_journey(self, booking_data, cabin_data, payment_data):
        """Test generating cabin upgrade invoice for return journey."""
        booking_data['return_departure_time'] = datetime.now() + timedelta(days=14)
        booking_data['return_departure_port'] = 'Marseille'
        booking_data['return_arrival_port'] = 'Tunis'
        cabin_data['journey_type'] = 'return'

        service = InvoiceService()
        pdf_content = service.generate_cabin_upgrade_invoice(
            booking=booking_data,
            cabin_data=cabin_data,
            payment=payment_data
        )

        assert pdf_content is not None
        assert pdf_content[:4] == b'%PDF'

    def test_cabin_upgrade_invoice_multiple_quantity(self, booking_data, cabin_data, payment_data):
        """Test cabin upgrade invoice with multiple cabins."""
        cabin_data['quantity'] = 3
        cabin_data['unit_price'] = 50.00
        cabin_data['total_price'] = 150.00

        service = InvoiceService()
        pdf_content = service.generate_cabin_upgrade_invoice(
            booking=booking_data,
            cabin_data=cabin_data,
            payment=payment_data
        )

        assert pdf_content is not None
        assert pdf_content[:4] == b'%PDF'

    def test_cabin_upgrade_invoice_string_datetime(self, booking_data, cabin_data, payment_data):
        """Test cabin upgrade invoice with string datetime."""
        booking_data['departure_time'] = '2024-06-15T10:00:00Z'

        service = InvoiceService()
        pdf_content = service.generate_cabin_upgrade_invoice(
            booking=booking_data,
            cabin_data=cabin_data,
            payment=payment_data
        )

        assert pdf_content is not None
        assert pdf_content[:4] == b'%PDF'


class TestInvoiceServiceHelpers:
    """Tests for helper methods."""

    def test_create_header(self):
        """Test header creation."""
        from reportlab.lib.styles import getSampleStyleSheet
        service = InvoiceService()
        styles = getSampleStyleSheet()

        header = service._create_header(styles)

        assert header is not None
        # Header is a Table object
        from reportlab.platypus import Table
        assert isinstance(header, Table)

    def test_create_footer(self):
        """Test footer creation."""
        from reportlab.lib.styles import getSampleStyleSheet
        service = InvoiceService()
        styles = getSampleStyleSheet()

        footer = service._create_footer(styles)

        assert footer is not None
        # Footer is a Paragraph object
        from reportlab.platypus import Paragraph
        assert isinstance(footer, Paragraph)


class TestInvoicePDFValidation:
    """Tests for PDF validation."""

    def test_pdf_file_structure(self):
        """Test that generated PDF has valid structure."""
        service = InvoiceService()
        booking = {
            'booking_reference': 'MR-VALID001',
            'contact_first_name': 'Test',
            'contact_last_name': 'User',
            'contact_email': 'test@example.com',
            'total_amount': 100.00,
            'currency': 'EUR'
        }
        payment = {
            'payment_method': 'credit_card',
            'stripe_payment_intent_id': 'pi_test'
        }

        pdf_content = service.generate_invoice(booking=booking, payment=payment)

        # Check PDF header
        assert pdf_content[:4] == b'%PDF'
        # Check PDF trailer (EOF marker)
        assert b'%%EOF' in pdf_content[-100:]

    def test_pdf_size_reasonable(self):
        """Test that generated PDF is of reasonable size."""
        service = InvoiceService()
        booking = {
            'booking_reference': 'MR-SIZE001',
            'contact_first_name': 'Test',
            'contact_last_name': 'User',
            'contact_email': 'test@example.com',
            'total_amount': 100.00,
            'currency': 'EUR',
            'operator': 'CTN',
            'departure_port': 'Tunis',
            'arrival_port': 'Marseille'
        }
        payment = {
            'payment_method': 'credit_card',
            'stripe_payment_intent_id': 'pi_test'
        }

        pdf_content = service.generate_invoice(booking=booking, payment=payment)

        # PDF should be at least 3KB and less than 1MB
        assert len(pdf_content) > 3000
        assert len(pdf_content) < 1000000

    def test_multiple_invoices_different_content(self):
        """Test that different bookings produce different PDFs."""
        service = InvoiceService()
        payment = {'payment_method': 'credit_card', 'stripe_payment_intent_id': 'pi_test'}

        booking1 = {
            'booking_reference': 'MR-DIFF001',
            'contact_first_name': 'User',
            'contact_last_name': 'One',
            'contact_email': 'one@example.com',
            'total_amount': 100.00,
            'currency': 'EUR'
        }
        booking2 = {
            'booking_reference': 'MR-DIFF002',
            'contact_first_name': 'User',
            'contact_last_name': 'Two',
            'contact_email': 'two@example.com',
            'total_amount': 200.00,
            'currency': 'EUR'
        }

        pdf1 = service.generate_invoice(booking=booking1, payment=payment)
        pdf2 = service.generate_invoice(booking=booking2, payment=payment)

        # PDFs should be different
        assert pdf1 != pdf2
