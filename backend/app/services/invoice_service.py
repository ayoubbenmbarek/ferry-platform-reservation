"""
Invoice generation service for creating PDF invoices.
"""
import os
import io
from datetime import datetime
from typing import Dict, Any, Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
import logging

logger = logging.getLogger(__name__)


class InvoiceService:
    """Service for generating PDF invoices."""

    def __init__(self):
        self.company_name = os.getenv("COMPANY_NAME", "Maritime Booking System")
        self.company_address = os.getenv("COMPANY_ADDRESS", "123 Port Street, Tunis, Tunisia")
        self.company_email = os.getenv("COMPANY_EMAIL", "contact@maritime-booking.com")
        self.company_phone = os.getenv("COMPANY_PHONE", "+216 71 123 456")
        self.company_tax_id = os.getenv("COMPANY_TAX_ID", "TN123456789")

    def generate_invoice(
        self,
        booking: Dict[str, Any],
        payment: Dict[str, Any],
        passengers: list = None,
        vehicles: list = None,
        meals: list = None
    ) -> bytes:
        """
        Generate a PDF invoice for a booking.

        Args:
            booking: Booking data dictionary
            payment: Payment data dictionary
            passengers: List of passenger dictionaries
            vehicles: List of vehicle dictionaries
            meals: List of meal dictionaries

        Returns:
            bytes: PDF file content
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm
        )

        # Get styles
        styles = getSampleStyleSheet()

        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#1e40af')
        )

        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            spaceBefore=20,
            spaceAfter=10,
            textColor=colors.HexColor('#1e40af')
        )

        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=10,
            spaceAfter=5
        )

        right_style = ParagraphStyle(
            'RightAlign',
            parent=styles['Normal'],
            fontSize=10,
            alignment=TA_RIGHT
        )

        # Build the document
        elements = []

        # Header with company info
        elements.append(self._create_header(styles))
        elements.append(Spacer(1, 20))

        # Invoice title and reference
        elements.append(Paragraph("INVOICE", title_style))

        # Invoice details
        invoice_number = f"INV-{booking.get('booking_reference', 'N/A')}"
        invoice_date = datetime.utcnow().strftime("%d/%m/%Y")

        invoice_info = [
            [Paragraph(f"<b>Invoice Number:</b> {invoice_number}", normal_style),
             Paragraph(f"<b>Date:</b> {invoice_date}", right_style)],
            [Paragraph(f"<b>Booking Reference:</b> {booking.get('booking_reference', 'N/A')}", normal_style),
             Paragraph(f"<b>Status:</b> PAID", right_style)]
        ]

        invoice_table = Table(invoice_info, colWidths=[9*cm, 8*cm])
        invoice_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(invoice_table)
        elements.append(Spacer(1, 20))

        # Customer details
        elements.append(Paragraph("Customer Details", heading_style))
        customer_name = f"{booking.get('contact_first_name', '')} {booking.get('contact_last_name', '')}"
        customer_info = [
            [Paragraph(f"<b>Name:</b> {customer_name}", normal_style)],
            [Paragraph(f"<b>Email:</b> {booking.get('contact_email', 'N/A')}", normal_style)],
            [Paragraph(f"<b>Phone:</b> {booking.get('contact_phone', 'N/A')}", normal_style)]
        ]
        customer_table = Table(customer_info, colWidths=[17*cm])
        elements.append(customer_table)
        elements.append(Spacer(1, 10))

        # Journey details
        elements.append(Paragraph("Journey Details", heading_style))

        # Format departure time
        departure_time = booking.get('departure_time')
        if isinstance(departure_time, str):
            try:
                departure_time = datetime.fromisoformat(departure_time.replace('Z', '+00:00'))
                departure_str = departure_time.strftime("%d/%m/%Y at %H:%M")
            except:
                departure_str = departure_time
        elif hasattr(departure_time, 'strftime'):
            departure_str = departure_time.strftime("%d/%m/%Y at %H:%M")
        else:
            departure_str = str(departure_time) if departure_time else "N/A"

        # Check if it's a round trip for labeling
        is_round_trip = booking.get('is_round_trip', False)

        journey_data = [
            ['OUTBOUND JOURNEY' if is_round_trip else 'JOURNEY DETAILS', ''],
            ['Operator', booking.get('operator', 'N/A')],
            ['Route', f"{booking.get('departure_port', 'N/A')} → {booking.get('arrival_port', 'N/A')}"],
            ['Departure', departure_str],
            ['Vessel', booking.get('vessel_name', 'N/A')]
        ]

        # Add return journey if round trip
        if is_round_trip:
            # Determine return route (use return ports if set, otherwise reverse outbound)
            return_dep_port = booking.get('return_departure_port') or booking.get('arrival_port', 'N/A')
            return_arr_port = booking.get('return_arrival_port') or booking.get('departure_port', 'N/A')

            # Add return journey section
            journey_data.append(['', ''])  # Empty row separator
            journey_data.append(['RETURN JOURNEY', ''])
            journey_data.append(['Route', f"{return_dep_port} → {return_arr_port}"])

            # Only show operator/vessel/time if return ferry was actually selected
            if booking.get('return_sailing_id'):
                journey_data.append(['Operator', booking.get('return_operator') or booking.get('operator', 'N/A')])

                return_time = booking.get('return_departure_time')
                if isinstance(return_time, str):
                    try:
                        return_time = datetime.fromisoformat(return_time.replace('Z', '+00:00'))
                        return_str = return_time.strftime("%d/%m/%Y at %H:%M")
                    except:
                        return_str = return_time
                elif hasattr(return_time, 'strftime'):
                    return_str = return_time.strftime("%d/%m/%Y at %H:%M")
                else:
                    return_str = str(return_time) if return_time else "N/A"

                journey_data.append(['Departure', return_str])
                if booking.get('return_vessel_name'):
                    journey_data.append(['Vessel', booking.get('return_vessel_name', 'N/A')])
            else:
                journey_data.append(['Status', 'Return ferry not yet selected'])

        journey_table = Table(journey_data, colWidths=[5*cm, 12*cm])

        # Build table style
        table_style = [
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f4f6')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
            # Style for section headers (OUTBOUND/RETURN JOURNEY)
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('SPAN', (0, 0), (-1, 0)),
        ]

        # Style return journey header if present
        if is_round_trip:
            # Find the RETURN JOURNEY row (it's after outbound (5 rows) + empty separator)
            return_header_idx = 6
            table_style.extend([
                ('BACKGROUND', (0, return_header_idx), (-1, return_header_idx), colors.HexColor('#1e40af')),
                ('TEXTCOLOR', (0, return_header_idx), (-1, return_header_idx), colors.white),
                ('SPAN', (0, return_header_idx), (-1, return_header_idx)),
            ])

        journey_table.setStyle(TableStyle(table_style))
        elements.append(journey_table)
        elements.append(Spacer(1, 10))

        # Pricing breakdown
        elements.append(Paragraph("Pricing Details", heading_style))

        pricing_data = [
            ['Description', 'Quantity', 'Unit Price', 'Total']
        ]

        currency = booking.get('currency', 'EUR')
        is_round_trip = booking.get('is_round_trip', False)

        # Calculate multiplier for round trip (prices shown are per journey, need to double for total)
        journey_multiplier = 2 if is_round_trip else 1

        # Passengers
        if passengers:
            for p in passengers:
                p_type = p.get('passenger_type', 'Adult')
                p_price = float(p.get('final_price', 0))
                total_price = p_price * journey_multiplier
                if is_round_trip:
                    pricing_data.append([
                        f"Passenger ({p_type}) - Outbound",
                        '1',
                        f"{currency} {p_price:.2f}",
                        f"{currency} {p_price:.2f}"
                    ])
                    pricing_data.append([
                        f"Passenger ({p_type}) - Return",
                        '1',
                        f"{currency} {p_price:.2f}",
                        f"{currency} {p_price:.2f}"
                    ])
                else:
                    pricing_data.append([
                        f"Passenger ({p_type})",
                        '1',
                        f"{currency} {p_price:.2f}",
                        f"{currency} {p_price:.2f}"
                    ])
        else:
            # Fallback if no detailed passengers
            num_passengers = booking.get('total_passengers', 1)
            subtotal = float(booking.get('subtotal', 0))
            per_passenger = subtotal / num_passengers if num_passengers > 0 else subtotal
            pricing_data.append([
                'Passengers',
                str(num_passengers),
                f"{currency} {per_passenger:.2f}",
                f"{currency} {subtotal:.2f}"
            ])

        # Vehicles
        if vehicles:
            for v in vehicles:
                v_type = v.get('vehicle_type', 'Vehicle')
                v_price = float(v.get('final_price', 0))
                if is_round_trip:
                    pricing_data.append([
                        f"Vehicle ({v_type}) - Outbound",
                        '1',
                        f"{currency} {v_price:.2f}",
                        f"{currency} {v_price:.2f}"
                    ])
                    pricing_data.append([
                        f"Vehicle ({v_type}) - Return",
                        '1',
                        f"{currency} {v_price:.2f}",
                        f"{currency} {v_price:.2f}"
                    ])
                else:
                    pricing_data.append([
                        f"Vehicle ({v_type})",
                        '1',
                        f"{currency} {v_price:.2f}",
                        f"{currency} {v_price:.2f}"
                    ])
        elif booking.get('total_vehicles', 0) > 0:
            pricing_data.append([
                'Vehicles',
                str(booking.get('total_vehicles')),
                '-',
                'Included'
            ])

        # Cabin supplement
        cabin_supplement = float(booking.get('cabin_supplement', 0))
        if cabin_supplement > 0:
            label = 'Cabin - Outbound' if is_round_trip else 'Cabin Supplement'
            pricing_data.append([
                label,
                '1',
                f"{currency} {cabin_supplement:.2f}",
                f"{currency} {cabin_supplement:.2f}"
            ])

        # Return cabin supplement
        return_cabin_supplement = float(booking.get('return_cabin_supplement', 0))
        if return_cabin_supplement > 0:
            pricing_data.append([
                'Cabin - Return',
                '1',
                f"{currency} {return_cabin_supplement:.2f}",
                f"{currency} {return_cabin_supplement:.2f}"
            ])

        # Meals
        if meals:
            for meal in meals:
                meal_name = meal.get('meal_name', 'Meal')
                meal_qty = meal.get('quantity', 1)
                meal_price = float(meal.get('unit_price', 0))
                meal_total = float(meal.get('total_price', meal_price * meal_qty))
                pricing_data.append([
                    meal_name,
                    str(meal_qty),
                    f"{currency} {meal_price:.2f}",
                    f"{currency} {meal_total:.2f}"
                ])

        # Cancellation Protection
        extra_data = booking.get('extra_data', {}) or {}
        has_cancellation_protection = extra_data.get('has_cancellation_protection', False)
        if has_cancellation_protection:
            protection_price = 15.00  # Fixed price for cancellation protection
            pricing_data.append([
                'Cancellation Protection',
                '1',
                f"{currency} {protection_price:.2f}",
                f"{currency} {protection_price:.2f}"
            ])

        # Tax
        tax_amount = float(booking.get('tax_amount', 0))
        if tax_amount > 0:
            pricing_data.append([
                'Tax',
                '',
                '',
                f"{currency} {tax_amount:.2f}"
            ])

        # Total
        total_amount = float(booking.get('total_amount', 0))
        pricing_data.append([
            '',
            '',
            'TOTAL',
            f"{currency} {total_amount:.2f}"
        ])

        pricing_table = Table(pricing_data, colWidths=[8*cm, 3*cm, 3*cm, 3*cm])
        pricing_table.setStyle(TableStyle([
            # Header
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),

            # Body
            ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),

            # Total row
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f3f4f6')),
            ('FONTSIZE', (-1, -1), (-1, -1), 12),

            # Grid
            ('GRID', (0, 0), (-1, -2), 0.5, colors.HexColor('#e5e7eb')),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor('#1e40af')),
        ]))
        elements.append(pricing_table)
        elements.append(Spacer(1, 20))

        # Payment details
        elements.append(Paragraph("Payment Information", heading_style))

        payment_method = payment.get('payment_method', 'Credit Card')
        if hasattr(payment_method, 'value'):
            payment_method = payment_method.value

        transaction_id = payment.get('stripe_charge_id') or payment.get('stripe_payment_intent_id', 'N/A')

        payment_data = [
            ['Payment Method', str(payment_method)],
            ['Transaction ID', str(transaction_id)],
            ['Amount Paid', f"{currency} {total_amount:.2f}"],
            ['Payment Status', 'COMPLETED']
        ]

        # Card details if available
        if payment.get('card_brand') and payment.get('card_last_four'):
            payment_data.insert(1, [
                'Card',
                f"{payment.get('card_brand', '').upper()} •••• {payment.get('card_last_four', '')}"
            ])

        payment_table = Table(payment_data, colWidths=[5*cm, 12*cm])
        payment_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f4f6')),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb'))
        ]))
        elements.append(payment_table)
        elements.append(Spacer(1, 30))

        # Footer
        elements.append(self._create_footer(styles))

        # Build PDF
        doc.build(elements)

        pdf_content = buffer.getvalue()
        buffer.close()

        return pdf_content

    def _create_header(self, styles) -> Table:
        """Create the invoice header with company information."""
        normal_style = ParagraphStyle(
            'HeaderNormal',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#6b7280')
        )

        company_style = ParagraphStyle(
            'CompanyName',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1e40af')
        )

        header_data = [
            [
                Paragraph(self.company_name, company_style),
                ''
            ],
            [
                Paragraph(self.company_address, normal_style),
                ''
            ],
            [
                Paragraph(f"Email: {self.company_email}", normal_style),
                Paragraph(f"Tax ID: {self.company_tax_id}", normal_style)
            ],
            [
                Paragraph(f"Phone: {self.company_phone}", normal_style),
                ''
            ]
        ]

        header_table = Table(header_data, colWidths=[10*cm, 7*cm])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ]))

        return header_table

    def _create_footer(self, styles) -> Paragraph:
        """Create the invoice footer."""
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.HexColor('#9ca3af'),
            alignment=TA_CENTER
        )

        footer_text = f"""
        Thank you for choosing {self.company_name}!<br/>
        This invoice was generated automatically. For questions, please contact {self.company_email}<br/>
        <br/>
        {self.company_name} | {self.company_address} | {self.company_phone}
        """

        return Paragraph(footer_text, footer_style)


    def generate_cabin_upgrade_invoice(
        self,
        booking: Dict[str, Any],
        cabin_data: Dict[str, Any],
        payment: Dict[str, Any]
    ) -> bytes:
        """
        Generate a separate PDF invoice for a cabin upgrade.

        Args:
            booking: Original booking data dictionary
            cabin_data: Cabin upgrade details (cabin_name, cabin_type, price, quantity, journey_type)
            payment: Payment data dictionary

        Returns:
            bytes: PDF file content
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm
        )

        # Get styles
        styles = getSampleStyleSheet()

        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#7c3aed')  # Purple for cabin upgrades
        )

        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            spaceBefore=20,
            spaceAfter=10,
            textColor=colors.HexColor('#7c3aed')
        )

        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=10,
            spaceAfter=5
        )

        right_style = ParagraphStyle(
            'RightAlign',
            parent=styles['Normal'],
            fontSize=10,
            alignment=TA_RIGHT
        )

        # Build the document
        elements = []

        # Header with company info
        elements.append(self._create_header(styles))
        elements.append(Spacer(1, 20))

        # Invoice title - Cabin Upgrade
        elements.append(Paragraph("CABIN UPGRADE INVOICE", title_style))

        # Invoice details
        upgrade_number = f"CU-{booking.get('booking_reference', 'N/A')}-{datetime.utcnow().strftime('%H%M%S')}"
        invoice_date = datetime.utcnow().strftime("%d/%m/%Y")

        invoice_info = [
            [Paragraph(f"<b>Upgrade Invoice:</b> {upgrade_number}", normal_style),
             Paragraph(f"<b>Date:</b> {invoice_date}", right_style)],
            [Paragraph(f"<b>Original Booking:</b> {booking.get('booking_reference', 'N/A')}", normal_style),
             Paragraph(f"<b>Status:</b> PAID", right_style)]
        ]

        invoice_table = Table(invoice_info, colWidths=[9*cm, 8*cm])
        invoice_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(invoice_table)
        elements.append(Spacer(1, 20))

        # Customer details
        elements.append(Paragraph("Customer Details", heading_style))
        customer_name = f"{booking.get('contact_first_name', '')} {booking.get('contact_last_name', '')}"
        customer_info = [
            [Paragraph(f"<b>Name:</b> {customer_name}", normal_style)],
            [Paragraph(f"<b>Email:</b> {booking.get('contact_email', 'N/A')}", normal_style)],
        ]
        customer_table = Table(customer_info, colWidths=[17*cm])
        elements.append(customer_table)
        elements.append(Spacer(1, 10))

        # Linked Booking Info
        elements.append(Paragraph("Linked Booking Details", heading_style))

        journey_type = cabin_data.get('journey_type', 'outbound')
        journey_label = 'Return Journey' if journey_type == 'return' else 'Outbound Journey'

        # Format departure time
        if journey_type == 'return':
            departure_time = booking.get('return_departure_time')
            route = f"{booking.get('return_departure_port', booking.get('arrival_port', 'N/A'))} → {booking.get('return_arrival_port', booking.get('departure_port', 'N/A'))}"
        else:
            departure_time = booking.get('departure_time')
            route = f"{booking.get('departure_port', 'N/A')} → {booking.get('arrival_port', 'N/A')}"

        if isinstance(departure_time, str):
            try:
                departure_time = datetime.fromisoformat(departure_time.replace('Z', '+00:00'))
                departure_str = departure_time.strftime("%d/%m/%Y at %H:%M")
            except:
                departure_str = str(departure_time)
        elif hasattr(departure_time, 'strftime'):
            departure_str = departure_time.strftime("%d/%m/%Y at %H:%M")
        else:
            departure_str = str(departure_time) if departure_time else "N/A"

        booking_data = [
            ['Journey', journey_label],
            ['Route', route],
            ['Departure', departure_str],
            ['Operator', booking.get('operator', 'N/A')]
        ]

        booking_table = Table(booking_data, colWidths=[5*cm, 12*cm])
        booking_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f4f6')),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb'))
        ]))
        elements.append(booking_table)
        elements.append(Spacer(1, 20))

        # Cabin Upgrade Details
        elements.append(Paragraph("Cabin Upgrade Details", heading_style))

        currency = booking.get('currency', 'EUR')
        cabin_name = cabin_data.get('cabin_name', 'Cabin')
        cabin_type = cabin_data.get('cabin_type', 'Standard')
        quantity = cabin_data.get('quantity', 1)
        unit_price = float(cabin_data.get('unit_price', 0))
        total_price = float(cabin_data.get('total_price', unit_price * quantity))

        pricing_data = [
            ['Description', 'Quantity', 'Unit Price', 'Total'],
            [f"{cabin_name} ({cabin_type})", str(quantity), f"{currency} {unit_price:.2f}", f"{currency} {total_price:.2f}"],
            ['', '', 'TOTAL', f"{currency} {total_price:.2f}"]
        ]

        pricing_table = Table(pricing_data, colWidths=[8*cm, 3*cm, 3*cm, 3*cm])
        pricing_table.setStyle(TableStyle([
            # Header
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7c3aed')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),

            # Body
            ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),

            # Total row
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f3f4f6')),
            ('FONTSIZE', (-1, -1), (-1, -1), 12),

            # Grid
            ('GRID', (0, 0), (-1, -2), 0.5, colors.HexColor('#e5e7eb')),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor('#7c3aed')),
        ]))
        elements.append(pricing_table)
        elements.append(Spacer(1, 20))

        # Payment details
        elements.append(Paragraph("Payment Information", heading_style))

        payment_method = payment.get('payment_method', 'Credit Card')
        if hasattr(payment_method, 'value'):
            payment_method = payment_method.value

        transaction_id = payment.get('stripe_charge_id') or payment.get('stripe_payment_intent_id', 'N/A')

        payment_data = [
            ['Payment Method', str(payment_method)],
            ['Transaction ID', str(transaction_id)],
            ['Amount Paid', f"{currency} {total_price:.2f}"],
            ['Payment Status', 'COMPLETED']
        ]

        # Card details if available
        if payment.get('card_brand') and payment.get('card_last_four'):
            payment_data.insert(1, [
                'Card',
                f"{payment.get('card_brand', '').upper()} •••• {payment.get('card_last_four', '')}"
            ])

        payment_table = Table(payment_data, colWidths=[5*cm, 12*cm])
        payment_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f3f4f6')),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb'))
        ]))
        elements.append(payment_table)
        elements.append(Spacer(1, 30))

        # Note about original booking
        note_style = ParagraphStyle(
            'Note',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#6b7280'),
            alignment=TA_CENTER,
            spaceBefore=10
        )
        elements.append(Paragraph(
            f"This cabin upgrade is linked to booking reference: <b>{booking.get('booking_reference', 'N/A')}</b>",
            note_style
        ))
        elements.append(Spacer(1, 20))

        # Footer
        elements.append(self._create_footer(styles))

        # Build PDF
        doc.build(elements)

        pdf_content = buffer.getvalue()
        buffer.close()

        return pdf_content


# Singleton instance
invoice_service = InvoiceService()
