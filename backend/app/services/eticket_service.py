"""
E-Ticket PDF generation service with QR code.
"""
import io
import os
import qrcode
from datetime import datetime
from typing import Dict, Any, Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, Flowable, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.graphics.shapes import Drawing, Rect, Line
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics import renderPDF
import logging
import json

logger = logging.getLogger(__name__)


class QRCodeFlowable(Flowable):
    """Custom flowable for QR codes."""

    def __init__(self, data: str, size: float = 4*cm):
        Flowable.__init__(self)
        self.data = data
        self.size = size

    def draw(self):
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2,
        )
        qr.add_data(self.data)
        qr.make(fit=True)

        # Create QR code image
        img = qr.make_image(fill_color="black", back_color="white")

        # Save to bytes
        img_buffer = io.BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)

        # Draw the image
        from reportlab.lib.utils import ImageReader
        img_reader = ImageReader(img_buffer)
        self.canv.drawImage(img_reader, 0, 0, width=self.size, height=self.size)

    def wrap(self, available_width, available_height):
        return (self.size, self.size)


class ETicketService:
    """Service for generating E-Ticket PDFs with QR codes."""

    def __init__(self):
        self.company_name = os.getenv("COMPANY_NAME", "Maritime Booking System")
        self.company_phone = os.getenv("COMPANY_PHONE", "+216 71 123 456")
        self.company_email = os.getenv("COMPANY_EMAIL", "support@maritime-booking.com")

        # Brand colors
        self.primary_color = colors.HexColor('#0066CC')
        self.secondary_color = colors.HexColor('#004499')
        self.success_color = colors.HexColor('#059669')
        self.warning_color = colors.HexColor('#D97706')
        self.text_color = colors.HexColor('#1F2937')
        self.light_gray = colors.HexColor('#F3F4F6')

    def generate_eticket(
        self,
        booking: Dict[str, Any],
        passengers: list = None,
        vehicles: list = None,
    ) -> bytes:
        """
        Generate an E-Ticket PDF with QR code for a booking.

        Args:
            booking: Booking data dictionary
            passengers: List of passenger dictionaries
            vehicles: List of vehicle dictionaries

        Returns:
            bytes: PDF file content
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=1.5*cm,
            leftMargin=1.5*cm,
            topMargin=1.5*cm,
            bottomMargin=1.5*cm
        )

        # Get styles
        styles = getSampleStyleSheet()

        # Custom styles
        title_style = ParagraphStyle(
            'ETicketTitle',
            parent=styles['Heading1'],
            fontSize=28,
            spaceAfter=5,
            alignment=TA_CENTER,
            textColor=self.primary_color,
            fontName='Helvetica-Bold'
        )

        subtitle_style = ParagraphStyle(
            'ETicketSubtitle',
            parent=styles['Normal'],
            fontSize=12,
            spaceAfter=20,
            alignment=TA_CENTER,
            textColor=colors.gray
        )

        heading_style = ParagraphStyle(
            'ETicketHeading',
            parent=styles['Heading2'],
            fontSize=14,
            spaceBefore=15,
            spaceAfter=10,
            textColor=self.primary_color,
            fontName='Helvetica-Bold'
        )

        normal_style = ParagraphStyle(
            'ETicketNormal',
            parent=styles['Normal'],
            fontSize=10,
            spaceAfter=3,
            textColor=self.text_color
        )

        bold_style = ParagraphStyle(
            'ETicketBold',
            parent=styles['Normal'],
            fontSize=10,
            fontName='Helvetica-Bold',
            textColor=self.text_color
        )

        center_style = ParagraphStyle(
            'ETicketCenter',
            parent=styles['Normal'],
            fontSize=10,
            alignment=TA_CENTER,
            textColor=self.text_color
        )

        elements = []

        # Header
        elements.append(self._create_header(booking, title_style, subtitle_style))
        elements.append(Spacer(1, 10))

        # QR Code section
        elements.append(self._create_qr_section(booking, center_style))
        elements.append(Spacer(1, 15))

        # Journey details
        elements.append(self._create_journey_section(booking, heading_style, normal_style, bold_style))

        # Return journey if round trip
        if booking.get('is_round_trip') and booking.get('return_departure_time'):
            elements.append(Spacer(1, 10))
            elements.append(self._create_return_journey_section(booking, heading_style, normal_style, bold_style))

        elements.append(Spacer(1, 15))

        # Passenger details
        if passengers:
            elements.append(self._create_passengers_section(passengers, heading_style, normal_style))
            elements.append(Spacer(1, 10))

        # Vehicle details
        if vehicles:
            elements.append(self._create_vehicles_section(vehicles, heading_style, normal_style))
            elements.append(Spacer(1, 10))

        # Important information
        elements.append(self._create_info_section(booking, heading_style, normal_style))

        # Footer
        elements.append(Spacer(1, 20))
        elements.append(self._create_footer(center_style))

        # Build PDF
        doc.build(elements)
        pdf_content = buffer.getvalue()
        buffer.close()

        return pdf_content

    def _create_header(self, booking: Dict, title_style, subtitle_style):
        """Create the ticket header."""
        elements = []

        # Company name and E-TICKET label
        elements.append(Paragraph(self.company_name, title_style))
        elements.append(Paragraph("E-TICKET / BOARDING PASS", subtitle_style))

        # Status badge
        status = booking.get('status', 'confirmed').upper()
        status_color = self.success_color if status == 'CONFIRMED' else self.warning_color

        status_style = ParagraphStyle(
            'StatusBadge',
            fontSize=12,
            alignment=TA_CENTER,
            textColor=colors.white,
            fontName='Helvetica-Bold',
            backColor=status_color,
            borderPadding=5,
        )

        # Create status table for better styling
        status_table = Table(
            [[Paragraph(f"<b>{status}</b>", ParagraphStyle('Status', fontSize=11, textColor=colors.white, alignment=TA_CENTER))]],
            colWidths=[3*cm],
            rowHeights=[0.7*cm]
        )
        status_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), status_color),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ROUNDEDCORNERS', [5, 5, 5, 5]),
        ]))

        # Wrap in a centered table
        wrapper = Table([[status_table]], colWidths=[18*cm])
        wrapper.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
        elements.append(wrapper)

        return KeepTogether(elements)

    def _create_qr_section(self, booking: Dict, center_style):
        """Create the QR code section."""
        # Generate QR data
        qr_data = json.dumps({
            'ref': booking.get('booking_reference'),
            'id': booking.get('id'),
            'dep': booking.get('departure_port'),
            'arr': booking.get('arrival_port'),
            'date': booking.get('departure_time', '')[:10] if booking.get('departure_time') else '',
            'pax': booking.get('total_passengers', 1),
            'op': booking.get('operator', ''),
        })

        # QR code
        qr_flowable = QRCodeFlowable(qr_data, size=5*cm)

        # Booking reference
        ref_style = ParagraphStyle(
            'BookingRef',
            fontSize=18,
            alignment=TA_CENTER,
            textColor=self.text_color,
            fontName='Helvetica-Bold',
            spaceBefore=10,
            spaceAfter=5
        )

        # Create centered table with QR
        qr_table = Table(
            [
                [qr_flowable],
                [Paragraph(f"<b>{booking.get('booking_reference', 'N/A')}</b>", ref_style)],
                [Paragraph("Scan at check-in", center_style)]
            ],
            colWidths=[18*cm]
        )
        qr_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        return qr_table

    def _create_journey_section(self, booking: Dict, heading_style, normal_style, bold_style):
        """Create the outbound journey section."""
        elements = []
        elements.append(Paragraph("OUTBOUND JOURNEY", heading_style))

        # Format times
        dep_time = self._format_datetime(booking.get('departure_time'))
        arr_time = self._format_datetime(booking.get('arrival_time'))
        dep_date = self._format_date(booking.get('departure_time'))

        # Journey details table
        data = [
            [
                Paragraph(f"<b>{booking.get('departure_port', 'N/A')}</b>",
                         ParagraphStyle('Port', fontSize=16, fontName='Helvetica-Bold', alignment=TA_CENTER)),
                Paragraph("→", ParagraphStyle('Arrow', fontSize=20, alignment=TA_CENTER, textColor=self.primary_color)),
                Paragraph(f"<b>{booking.get('arrival_port', 'N/A')}</b>",
                         ParagraphStyle('Port', fontSize=16, fontName='Helvetica-Bold', alignment=TA_CENTER))
            ],
            [
                Paragraph(f"Departure: {dep_time}", ParagraphStyle('Time', fontSize=11, alignment=TA_CENTER)),
                Paragraph("", normal_style),
                Paragraph(f"Arrival: {arr_time}", ParagraphStyle('Time', fontSize=11, alignment=TA_CENTER))
            ],
        ]

        journey_table = Table(data, colWidths=[6*cm, 6*cm, 6*cm])
        journey_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(journey_table)

        # Additional info table
        info_data = [
            ['Date:', dep_date, 'Operator:', booking.get('operator', 'N/A')],
            ['Vessel:', booking.get('vessel_name', 'N/A'), 'Passengers:', str(booking.get('total_passengers', 1))],
        ]

        info_table = Table(info_data, colWidths=[2.5*cm, 6*cm, 2.5*cm, 6*cm])
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TEXTCOLOR', (0, 0), (-1, -1), self.text_color),
            ('BACKGROUND', (0, 0), (-1, -1), self.light_gray),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ]))

        elements.append(Spacer(1, 10))
        elements.append(info_table)

        return KeepTogether(elements)

    def _create_return_journey_section(self, booking: Dict, heading_style, normal_style, bold_style):
        """Create the return journey section."""
        elements = []
        elements.append(Paragraph("RETURN JOURNEY", heading_style))

        # Format times
        dep_time = self._format_datetime(booking.get('return_departure_time'))
        arr_time = self._format_datetime(booking.get('return_arrival_time'))
        dep_date = self._format_date(booking.get('return_departure_time'))

        # Journey details table
        data = [
            [
                Paragraph(f"<b>{booking.get('return_departure_port', booking.get('arrival_port', 'N/A'))}</b>",
                         ParagraphStyle('Port', fontSize=16, fontName='Helvetica-Bold', alignment=TA_CENTER)),
                Paragraph("→", ParagraphStyle('Arrow', fontSize=20, alignment=TA_CENTER, textColor=colors.HexColor('#7c3aed'))),
                Paragraph(f"<b>{booking.get('return_arrival_port', booking.get('departure_port', 'N/A'))}</b>",
                         ParagraphStyle('Port', fontSize=16, fontName='Helvetica-Bold', alignment=TA_CENTER))
            ],
            [
                Paragraph(f"Departure: {dep_time}", ParagraphStyle('Time', fontSize=11, alignment=TA_CENTER)),
                Paragraph("", normal_style),
                Paragraph(f"Arrival: {arr_time}", ParagraphStyle('Time', fontSize=11, alignment=TA_CENTER))
            ],
        ]

        journey_table = Table(data, colWidths=[6*cm, 6*cm, 6*cm])
        journey_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(journey_table)

        # Additional info table
        info_data = [
            ['Date:', dep_date, 'Vessel:', booking.get('return_vessel_name', 'TBC')],
        ]

        info_table = Table(info_data, colWidths=[2.5*cm, 6*cm, 2.5*cm, 6*cm])
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TEXTCOLOR', (0, 0), (-1, -1), self.text_color),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F5F3FF')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ]))

        elements.append(Spacer(1, 10))
        elements.append(info_table)

        return KeepTogether(elements)

    def _create_passengers_section(self, passengers: list, heading_style, normal_style):
        """Create the passengers section."""
        elements = []
        elements.append(Paragraph("PASSENGERS", heading_style))

        # Table header
        header = ['#', 'Name', 'Type', 'Date of Birth', 'Nationality']
        data = [header]

        for i, pax in enumerate(passengers, 1):
            pax_type = pax.get('passenger_type', 'adult').capitalize()
            name = f"{pax.get('first_name', '')} {pax.get('last_name', '')}".strip()
            dob = pax.get('date_of_birth', 'N/A')
            nationality = pax.get('nationality', 'N/A')
            data.append([str(i), name, pax_type, dob, nationality])

        table = Table(data, colWidths=[1*cm, 6*cm, 3*cm, 3.5*cm, 3.5*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.primary_color),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, self.light_gray]),
        ]))

        elements.append(table)
        return KeepTogether(elements)

    def _create_vehicles_section(self, vehicles: list, heading_style, normal_style):
        """Create the vehicles section."""
        elements = []
        elements.append(Paragraph("VEHICLES", heading_style))

        # Table header
        header = ['#', 'Type', 'Make/Model', 'License Plate']
        data = [header]

        for i, vehicle in enumerate(vehicles, 1):
            v_type = vehicle.get('vehicle_type', 'car').replace('_', ' ').title()
            make_model = f"{vehicle.get('make', '')} {vehicle.get('model', '')}".strip() or 'N/A'
            plate = vehicle.get('license_plate', 'N/A')
            data.append([str(i), v_type, make_model, plate])

        table = Table(data, colWidths=[1*cm, 4*cm, 7*cm, 5*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), self.primary_color),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, self.light_gray]),
        ]))

        elements.append(table)
        return KeepTogether(elements)

    def _create_info_section(self, booking: Dict, heading_style, normal_style):
        """Create the important information section."""
        elements = []
        elements.append(Paragraph("IMPORTANT INFORMATION", heading_style))

        info_items = [
            "• Please arrive at the port at least 90 minutes before departure",
            "• Present this e-ticket (printed or on mobile) at the check-in counter",
            "• Have your valid ID/passport ready for verification",
            "• Vehicle check-in opens 2 hours before departure",
            "• Boarding closes 30 minutes before departure",
        ]

        info_style = ParagraphStyle(
            'InfoItem',
            fontSize=10,
            textColor=self.text_color,
            spaceAfter=3,
            leftIndent=10
        )

        for item in info_items:
            elements.append(Paragraph(item, info_style))

        # Contact info box
        elements.append(Spacer(1, 10))

        contact_data = [[
            Paragraph(f"<b>Need Help?</b><br/>"
                     f"Phone: {self.company_phone}<br/>"
                     f"Email: {self.company_email}",
                     ParagraphStyle('Contact', fontSize=9, textColor=self.text_color))
        ]]

        contact_table = Table(contact_data, colWidths=[18*cm])
        contact_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), self.light_gray),
            ('BOX', (0, 0), (-1, -1), 1, self.primary_color),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ]))

        elements.append(contact_table)
        return KeepTogether(elements)

    def _create_footer(self, center_style):
        """Create the footer."""
        footer_style = ParagraphStyle(
            'Footer',
            fontSize=8,
            alignment=TA_CENTER,
            textColor=colors.gray
        )

        elements = []
        elements.append(Paragraph(
            f"This e-ticket was generated on {datetime.now().strftime('%d %B %Y at %H:%M')}",
            footer_style
        ))
        elements.append(Paragraph(
            f"© {datetime.now().year} {self.company_name}. All rights reserved.",
            footer_style
        ))

        return KeepTogether(elements)

    def _format_datetime(self, dt_string: Optional[str]) -> str:
        """Format datetime string to time."""
        if not dt_string:
            return '--:--'
        try:
            dt = datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
            return dt.strftime('%H:%M')
        except:
            return '--:--'

    def _format_date(self, dt_string: Optional[str]) -> str:
        """Format datetime string to date."""
        if not dt_string:
            return 'N/A'
        try:
            dt = datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
            return dt.strftime('%A, %d %B %Y')
        except:
            return 'N/A'


# Singleton instance
eticket_service = ETicketService()
