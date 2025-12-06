Key Questions for Integration

  1. API Endpoint: What is the FerryGateway
  test/production URL?
  2. Credentials: What AgentAccountNumber will
   we use?
  3. Tunisia Operators: Which operators serve
  Tunisia routes?
    - GNV (Grandi Navi Veloci)?
    - Corsica Ferries?
    - CTN (Compagnie Tunisienne de
  Navigation)?
  4. Port Codes: Need exact codes for:
    - Genoa → Tunis
    - Marseille → Tunis
    - Civitavecchia → Tunis
  5. Payment Flow: Does FerryGateway handle
  payment or do we use Stripe separately?
  6. Can you convert the .docx files to PDF or
   text? I need them for complete
  documentation.

  Technical Files:

  - ferrygateway.wadl - All API endpoints and
  operations
  - XML Examples - Complete booking flows
  (DFDS, StenaLine, VikingLine, etc.)

  ---
  Key Technical Insights

  API Flow (Standard Booking):

  1. GetSailings → Search for available
  ferries with prices
  2. GetServices → Get cabins, meals, pets,
  onboard services
  3. GetPrice → Get confirmed final price
  (optional Token for price guarantee)
  4. Book → Create confirmed booking (returns
  BookingReference)

  Optional Operations:

  - GetRoutes/GetTimeTables - Cache static
  data (recommended daily)
  - Reservation → ConfirmReservation -
  Temporary hold before payment
  - GetCancelCharge → CancelBooking -
  Cancellation with fees

  Key Technical Points:

  1. Stateless - Each request independent, no
  session
  2. Local Time - All times are local, no
  timezone handling
  3. XML-based - All requests/responses in XML
  4. Price Token - Optional mechanism to
  guarantee price for limited time
  5. Cost Categories: PackageCost, Vehicle,
  OnBoardService, OnBoardAccommodation, Tax

  ---
  Questions Before Integration

  1. Which FerryGateway operator serves
  Tunisia routes?
    - Is it through FerryGateway Association
  directly?
    - Or specific operators (GNV, CTN, Corsica
   Ferries)?
  2. API Credentials:
    - AgentAccountNumber?
    - Authentication method (Basic Auth, API
  Key)?
    - Test/Production endpoint URLs?
  3. Port Codes for your routes:
    - Genoa (ITGOA?) → Tunis (TNTN?)
    - Marseille → Tunis
    - Civitavecchia → Tunis
  4. Payment Flow:
    - Use Reservation → ConfirmReservation
  (you handle payment with Stripe)?
    - Or direct Book (operator handles
  payment)?
  5. Price Token:
    - Will the operator provide price
  guarantees?
    - How long is the guarantee window?

  ---
  Next Steps for Integration

  Phase 1: Backend Service Creation

  1. Create FerryGatewayService class to
  handle XML serialization
  2. Implement API client with proper
  authentication
  3. Map our models to FerryGateway XML format

  Phase 2: Core Operations

  1. GetRoutes - Cache available routes daily
  2. GetSailings - Replace mock search with
  real API
  3. GetServices - Get cabins/meals/pets
  options
  4. GetPrice - Calculate final prices

  Phase 3: Booking Flow

  1. Reservation - Hold booking during payment
  2. ConfirmReservation - After Stripe payment
   success
  3. RecallBooking - Display booking details
  4. CancelBooking - Handle cancellations with
   fees

  Phase 4: Advanced Features

  1. Round-trip (multi-leg) support
  2. Offer codes/discounts
  3. Invoice retrieval

  ---
  Technical Implementation Preview

  # 
  backend/app/services/ferrygateway_service.py

  class FerryGatewayService:
      def __init__(self):
          self.base_url =
  config.FERRYGATEWAY_API_URL
          self.agent_account =
  config.FERRYGATEWAY_AGENT_ACCOUNT

      def get_sailings(self, params: 
  SearchParams) -> List[FerryResult]:
          """Search for available sailings"""
          xml_request =
  self._build_get_sailings_request(params)
          response = self._send_request('/fgw/
  offers/getSailings', xml_request)
          return
  self._parse_sailings_response(response)

      def book(self, booking_data: 
  BookingCreate) -> BookingReference:
          """Create confirmed booking"""
          xml_request =
  self._build_book_request(booking_data)
          response =
  self._send_request('/fgw/bookings/book',
  xml_request)
          return
  self._parse_book_response(response)

  ---
  Please provide answers to questions 1-5 
  above so I can start the implementation with
   the correct configuration.