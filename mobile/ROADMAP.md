# Mobile App Feature Roadmap

## Completed Features
- [x] Search & booking flow
- [x] Payment integration (Stripe)
- [x] User authentication (Email, Google, Apple)
- [x] Booking management
- [x] Unit tests (237 tests)
- [x] CI/CD integration
- [x] Auto-fill contact info for logged-in users
- [x] E-Ticket with QR code, where to find it?
- [x] Push Notifications
- [x] Biometric Authentication, 
- [x] Offline Support

## Upcoming Features

### 1. E-Ticket / QR Code (Priority: High) - COMPLETED
- [x] Generate QR code for confirmed bookings
- [x] Display downloadable e-ticket
- [x] Share e-ticket via device share
- [x] Save e-ticket to device
- [ ] Add to Apple Wallet (future)
- [ ] Add to Google Wallet (future)

### 2. Push Notifications (Priority: High) - COMPLETED
- [x] Setup Expo Push Notifications
- [x] Booking confirmation notifications
- [x] Departure reminders (24h before) did an email sent?
- [x] Departure reminders (2h before)
- [x] Price alerts for saved routes
- [x] Promotional notifications
- [x] Notification settings screen

### 3. Biometric Authentication (Priority: Medium) - COMPLETED
- [x] Face ID / Touch ID login option
- [x] Secure token storage with biometrics
- [x] Settings toggle for biometric login
- [x] Fallback to password

### 4. Offline Support (Priority: Medium) - COMPLETED
- [x] Cache user bookings locally
- [x] View bookings when offline
- [x] Queue booking modifications offline
- [x] Sync when connection restored
- [x] Offline indicator UI

## Technical Debt
- [ ] Increase test coverage to 90%
- [ ] Add E2E tests with Detox
- [ ] Performance optimization
- [ ] Accessibility improvements (a11y)
