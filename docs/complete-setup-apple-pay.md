Complete Setup for Apple Pay on 
  Localhost

  Method 1: Using HTTPS Environment
   Variable (Easiest)

  Step 1: Generate SSL Certificate

  cd
  /Users/ayoubmbarek/Projects/marit
  ime-reservation-website/frontend

  # Create ssl directory
  mkdir -p ssl

  # Generate self-signed 
  certificate
  openssl req -x509 -newkey
  rsa:2048 -keyout
  ssl/localhost-key.pem -out
  ssl/localhost-cert.pem -days 365
  -nodes -subj "/CN=localhost"

  Step 2: Create .env file with 
  HTTPS settings

⏺ Bash(cat > /Users/ayoubmbarek/Project
      s/maritime-reservation-website/fr
      ontend/.env.local << 'EOF'
      HTTPS=true…)
  ⎿  Created .env.local file

⏺ Step 3: Generate the SSL 
  Certificate

⏺ Bash(cd
      /Users/ayoubmbarek/Projects/marit
      ime-reservation-website/frontend
      && mkdir -p ssl && openssl req
      -x509 -newkey rsa:2048 -keyout
      ssl/localhost-key.pem -out ss…)
  ⎿ .....+...+..+...+.............
    ++++++++++++++++++++++++++++++
    +++++++++*..+.+.....+.........
    … +81 lines (ctrl+o to expand)





⏺ Bash(ls -lh /Users/ayoubmbarek/Projec
      ts/maritime-reservation-website/f
      rontend/ssl/)
  ⎿ total 16                      
    -rw-r--r--@ 1 ayoubmbarek  sta
    ff   1.1K Nov 25 15:41 localho
    … +4 lines (ctrl+o to expand)



⏺ Perfect! ✅ SSL certificates
  created successfully. Now follow
  these steps:

  Step 4: Trust the Certificate on 
  macOS

  Option A: Trust via Keychain 
  (macOS)

  # Add certificate to macOS 
  Keychain
  sudo security add-trusted-cert -d
   -r trustRoot -k /Library/Keychai
  ns/System.keychain
  /Users/ayoubmbarek/Projects/marit
  ime-reservation-website/frontend/
  ssl/localhost-cert.pem

  Option B: Manual Trust (if 
  command doesn't work)

  1. Open Keychain Access app
  2. File → Import Items
  3. Select: /Users/ayoubmbarek/Pro
  jects/maritime-reservation-websit
  e/frontend/ssl/localhost-cert.pem
  4. Double-click the certificate
  named "localhost"
  5. Expand "Trust" section
  6. Set "When using this
  certificate" to: Always Trust
  7. Close (you'll need to enter
  your password)

  Step 5: Restart Frontend with 
  HTTPS

  Now restart your frontend to use
  HTTPS:

  # The frontend will now run on 
  https://localhost:3001
  # Your .env.local file is already
   configured

  When you restart npm start, it
  will automatically use HTTPS.

  Step 6: Test Apple Pay

  1. Open Safari (Apple Pay only
  works in Safari on macOS/iOS)
  2. Navigate to:
  https://localhost:3001
  3. You may see a warning: Click
  "Show Details" → "Visit this
  website"
  4. Create a booking and go to 
  payment
  5. Apple Pay should appear if:
    - You're using Safari
    - You have Apple Pay configured
   on your Mac/iPhone
    - You have a card added to
  Wallet

  Expected Result:

  You should see the Apple Pay
  button appear alongside Google
  Pay and Link:

  ┌────────────────────────────────
  ─────┐
  │  🍎 Pay with Apple Pay
       │  ← Should appear
  ├────────────────────────────────
  ─────┤
  │  G  Pay with Google Pay
       │
  ├────────────────────────────────
  ─────┤
  │  🔗 Pay with Link
       │
  └────────────────────────────────
  ─────┘

  Troubleshooting:

  ❌ "Certificate not trusted" 
  warning in Safari
  - Go to Safari → Settings →
  Advanced → Show Develop menu
  - Develop → Allow Invalid
  Certificates for Resources loaded
   from localhost
  - Or complete Step 4 above to
  trust the certificate

  ❌ "Apple Pay not available"
  - Make sure you're using Safari
  (not Chrome/Firefox)
  - Check if Apple Pay is set up on
   your Mac: System Settings →
  Wallet & Apple Pay
  - Make sure you have at least one
   card added

  ❌ "ERR_SSL_PROTOCOL_ERROR"
  - Make sure .env.local file
  exists with HTTPS=true
  - Restart the dev server

  Quick Check:

  After restarting the frontend,
  verify HTTPS is working:
  # Should show 
  https://localhost:3001
  curl -k https://localhost:3001

  Ready to test? Restart your
  frontend now and try accessing
  https://localhost:3001 in Safari!









