# Google OAuth & Apple Pay Implementation

## ✅ Completed Features

### 1. Google OAuth Login

Users can now sign in with their Google account in addition to email/password authentication.

#### Backend Implementation

**Files Modified:**
- `backend/requirements.txt` - Added Google auth libraries
- `backend/app/models/user.py` - Added `google_user_id` field
- `backend/app/api/v1/auth.py` - Added `/google` endpoint
- `backend/alembic/versions/20251123_0000-add_google_oauth_support.py` - Database migration
- `backend/.env.development` - Added `GOOGLE_CLIENT_ID`

**New Endpoint:**
```
POST /api/v1/auth/google
Body: { "credential": "google-id-token" }
Response: { "access_token", "user", "is_new_user" }
```

**Features:**
- ✅ Verifies Google ID token server-side
- ✅ Auto-creates account for new users
- ✅ Auto-links guest bookings on Google login
- ✅ Trusts Google's email verification
- ✅ Updates existing users with Google ID

#### Frontend Implementation

**Files Modified:**
- `frontend/public/index.html` - Added Google Sign-In script
- `frontend/src/pages/LoginPage.tsx` - Added Google Sign-In button
- `frontend/.env` - Added `REACT_APP_GOOGLE_CLIENT_ID`
- `frontend/.env.example` - Documentation

**Features:**
- ✅ Official Google Sign-In button with branding
- ✅ One-click authentication
- ✅ Automatic token verification
- ✅ Seamless redirect after login
- ✅ Maintains booking context

---

### 2. Apple Pay Integration

Users can now pay with Apple Pay (and Google Pay) using Stripe's Payment Request API.

#### Backend Implementation

**Files Modified:**
- `backend/app/api/v1/payments.py` - Already configured with `automatic_payment_methods`

The backend was already set up to accept Apple Pay through Stripe's automatic payment methods:
```python
stripe.PaymentIntent.create(
    automatic_payment_methods={"enabled": True}
)
```

#### Frontend Implementation

**Files Modified:**
- `frontend/src/components/Payment/StripePaymentForm.tsx` - Added Payment Request Button

**Features:**
- ✅ Shows Apple Pay button on Safari/iOS
- ✅ Shows Google Pay button on Chrome/Android
- ✅ Falls back to card input if not available
- ✅ Seamless one-touch payment
- ✅ Handles 3D Secure authentication

**UI Flow:**
1. If Apple Pay/Google Pay available → Show payment button
2. User clicks → Native payment sheet appears
3. User authenticates (Face ID/Touch ID/PIN)
4. Payment processed instantly
5. Falls back to card form if needed

---

## 🔧 Setup Instructions

### 1. Google OAuth Setup

1. **Create Google OAuth Credentials:**
   - Go to https://console.cloud.google.com/
   - Create a new project (or select existing)
   - Enable "Google+ API"
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Authorized JavaScript origins: `http://localhost:3001`
   - Authorized redirect URIs: `http://localhost:3001`
   - Copy the Client ID

2. **Update Environment Variables:**

Backend (`backend/.env.development`):
```bash
GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
```

Frontend (`frontend/.env`):
```bash
REACT_APP_GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
```

3. **Run Database Migration:**
```bash
cd backend
docker exec maritime-backend-dev python -m alembic upgrade head
```

4. **Install Dependencies:**
```bash
cd backend
docker exec maritime-backend-dev pip install -r requirements.txt
```

### 2. Apple Pay Setup

Apple Pay works automatically through Stripe! No additional setup needed.

**Requirements:**
- Valid Stripe account
- HTTPS domain (for production)
- Safari browser or iOS device (for testing)

**Testing:**
1. Use Safari or iOS device
2. Have an Apple Pay-enabled card in Wallet
3. Navigate to payment page
4. Apple Pay button will appear automatically

---

## 🧪 Testing

### Test Google OAuth Login

1. **Without Google Credentials:**
   - Google button won't render
   - Regular email/password login still works

2. **With Google Credentials:**
   - Start frontend: `npm start`
   - Go to http://localhost:3001/login
   - Click "Sign in with Google" button
   - Authenticate with Google account
   - Redirected to home page as logged-in user
   - Check database - new user created with `google_user_id`

3. **Auto-Link Bookings:**
   - Make a guest booking with email@example.com
   - Sign in with Google using email@example.com
   - Booking automatically linked to new account

### Test Apple Pay

1. **On Safari/iOS:**
   - Add test card to Apple Wallet
   - Go to payment page
   - See Apple Pay button appear
   - Click → Face ID/Touch ID prompt
   - Payment processed

2. **On Chrome/Android:**
   - Set up Google Pay
   - See Google Pay button
   - One-click payment

3. **Fallback:**
   - On other browsers → No payment request button
   - Card form still available
   - Everything works as before

---

## 📊 Database Changes

### New Field: `users.google_user_id`

```sql
ALTER TABLE users ADD COLUMN google_user_id VARCHAR(255) UNIQUE;
CREATE INDEX ix_users_google_user_id ON users(google_user_id);
```

**Purpose:**
- Links Google account to user
- Prevents duplicate accounts
- Enables "Continue with Google" for returning users

---

## 🔐 Security Features

### Google OAuth
- ✅ Server-side token verification
- ✅ No client secrets exposed
- ✅ Validates email from Google
- ✅ Prevents token reuse
- ✅ Secure JWT generation

### Apple Pay
- ✅ Stripe handles PCI compliance
- ✅ Tokenized payments (no card storage)
- ✅ Biometric authentication required
- ✅ 3D Secure support
- ✅ Encrypted payment data

---

## 📝 Next Steps (Optional)

### Production Deployment

1. **Update Google OAuth:**
   - Add production domain to authorized origins
   - Use production Google Client ID

2. **Apple Pay Domain Verification:**
   - Register domain with Stripe
   - Add verification file to `.well-known/`
   - Enable Apple Pay in Stripe Dashboard

3. **Environment Variables:**
   - Set production `GOOGLE_CLIENT_ID`
   - Keep Stripe keys secure
   - Use HTTPS for all requests

### Future Enhancements

- [ ] Add "Sign in with Apple" (separate from Apple Pay)
- [ ] Add Facebook/Twitter OAuth
- [ ] Remember device for Google Sign-In
- [ ] Add Google Pay for in-app payments
- [ ] Support payment in 3 installments
- [ ] Add biometric authentication for web

---

## 🐛 Troubleshooting

### Google Sign-In Button Not Showing

**Problem:** Button doesn't render on login page

**Solutions:**
1. Check `REACT_APP_GOOGLE_CLIENT_ID` is set in `.env`
2. Verify Google script loaded: Open dev console → Check for errors
3. Client ID must match Google Console configuration
4. Clear browser cache and reload

### Apple Pay Button Not Showing

**Problem:** No Apple Pay option on payment page

**Expected Behavior:** Apple Pay only shows on:
- Safari browser (macOS/iOS)
- Devices with Apple Pay set up
- HTTPS domains (production)

**For Testing:**
- Use Safari
- Add a card to Apple Wallet
- Visit payment page

### Google OAuth Error: "Invalid Client"

**Problem:** Error when clicking Google Sign-In

**Solutions:**
1. Verify `GOOGLE_CLIENT_ID` matches Console
2. Check authorized origins include your domain
3. Ensure Google+ API is enabled

### Payment Request Error

**Problem:** Apple Pay fails to process

**Solutions:**
1. Check Stripe keys are correct
2. Verify payment intent created successfully
3. Check browser console for errors
4. Ensure card is valid in test mode

---

## 📚 Documentation Links

- [Google Sign-In Guide](https://developers.google.com/identity/gsi/web/guides/overview)
- [Stripe Payment Request API](https://stripe.com/docs/stripe-js/elements/payment-request-button)
- [Apple Pay Web Guide](https://developer.apple.com/documentation/apple_pay_on_the_web)
- [Stripe Test Cards](https://stripe.com/docs/testing)

---

## ✨ Summary

**What Users Can Now Do:**
1. ✅ Sign in with Google (one click, no password)
2. ✅ Pay with Apple Pay (Touch ID/Face ID)
3. ✅ Pay with Google Pay (Android)
4. ✅ Auto-link bookings when creating account

**Benefits:**
- Faster authentication
- Better user experience
- Higher conversion rates
- More secure payments
- Reduced friction

**Build Status:** ✅ Compiled successfully (118.25 kB)
