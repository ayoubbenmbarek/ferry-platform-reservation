# Quick Start Guide - New Frontend

## 🚀 Getting Started in 5 Minutes

### Step 1: Start Backend Services

```bash
# From project root
./scripts/dev-start.sh
```

Wait for all services to start (PostgreSQL, Redis, FastAPI, Celery).
You should see: "Development environment is ready!"

**Backend will be available at:**
- API: http://localhost:8010
- API Docs: http://localhost:8010/docs
- Health Check: http://localhost:8010/health

### Step 2: Install Frontend Dependencies

```bash
# Open a NEW terminal window
cd frontend
npm install
```

This will install all required packages.

### Step 3: Start Frontend

```bash
# From frontend directory
npm start
```

The React app will automatically open in your browser at:
**http://localhost:3000**

## ✨ What You'll See

### New Homepage
- **Modern gradient design** with ocean/maritime theme
- **Smart search form** with:
  - Port selection (🇮🇹 Italy, 🇫🇷 France → 🇹🇳 Tunisia)
  - Date picker with validation
  - Passenger counter (adults, children, infants)
  - Vehicle toggle option
  - Large "Search Ferries" button

### Search & Booking Flow

**Step 1: Passenger Details**
- Add information for each passenger
- Choose passenger type (Adult/Child/Infant)
- Optional travel documents
- Add vehicles (7 types available)

**Step 2: Ferry Selection**
- View all available ferries
- Compare prices across operators
- See departure/arrival times
- Select preferred ferry

**Step 3: Review & Payment**
- Summary of all details
- Final price
- Proceed to payment

## 🎯 Try These Features

### 1. Search for a Ferry

1. Go to http://localhost:3000
2. Select:
   - **From:** Genoa, Italy
   - **To:** La Goulette (Tunis), Tunisia
   - **Departure Date:** Tomorrow or later
   - **Passengers:** 2 adults, 1 child
3. Check "I'm traveling with a vehicle"
4. Click **"Search Ferries"**

### 2. Add Passengers

You'll be taken to Step 1 - Passenger Details:

1. Click **"Add Passenger 1"**
2. Choose passenger type (Adult/Child/Infant)
3. Fill in name: "John Doe"
4. Click **"Save Passenger"**
5. Repeat for all passengers

### 3. Add Vehicle

Still on Step 1:

1. Click **"Add Vehicle"**
2. Choose vehicle type:
   - 🚗 **Car** - Standard vehicle
   - 🚙 **SUV** - Larger vehicle
   - 🚐 **Van** - Minibus
   - 🏍️ **Motorcycle** - Two-wheeler
   - 🚚 **Camper** - Motorhome
   - 🚐 **Caravan** - Trailer
   - 🚛 **Truck** - Large vehicle
3. Dimensions auto-fill based on type
4. Customize if needed
5. Add optional details (registration, make, model)
6. Click **"Add Vehicle"**

### 4. Select Ferry

Step 2 - Ferry Selection:

1. View available ferries from all operators
2. Compare:
   - Departure/arrival times
   - Duration
   - Price
   - Operator (CTN, GNV, Corsica Lines, Danel)
3. Click **"Select"** on preferred ferry

### 5. Review Booking

Step 3 - Review:

1. Check all details are correct
2. See final price
3. Click **"Proceed to Payment"**

## 🎨 Design Features You'll Notice

### Visual Elements
- **Gradient backgrounds** (blue to cyan)
- **Ocean wave patterns** in header
- **Large, clickable cards** for selections
- **Icons and emojis** for visual appeal
- **Smooth animations** on hover/click

### User Experience
- **Progress bar** showing current step
- **Validation messages** for errors
- **Loading spinners** during API calls
- **Collapsible cards** for saved data
- **Edit/Remove buttons** on all items

### Responsive Design
- Works on **mobile phones** (320px+)
- Optimized for **tablets** (768px+)
- Beautiful on **desktops** (1024px+)
- **Touch-friendly** buttons and inputs

## 🔧 Troubleshooting

### Backend Not Starting

**Issue:** Backend services won't start

**Solution:**
```bash
# Check Docker is running
docker ps

# Rebuild services
docker-compose -f docker-compose.dev.yml build
docker-compose -f docker-compose.dev.yml up -d
```

### Frontend Port Conflict

**Issue:** Port 3000 already in use

**Solution:**
```bash
# Use different port
PORT=3001 npm start

# Or stop other app using port 3000
lsof -i :3000
kill -9 <PID>
```

### Search Button Not Working

**Issue:** Clicking search does nothing

**Check:**
1. **Browser console** (F12) for errors
2. **Form validation** - are all required fields filled?
3. **Backend health** - visit http://localhost:8010/health
4. **Network tab** - is API request being made?

**Common Fixes:**
```bash
# Clear browser cache
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)

# Restart frontend
npm start

# Check backend logs
./scripts/dev-logs.sh backend
```

### Styling Issues

**Issue:** Layout broken or styles missing

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Clear cache
npm start -- --reset-cache
```

### API Errors

**Issue:** Getting 404 or 500 errors from API

**Check:**
1. Backend is running: http://localhost:8010/health
2. Correct API URL in proxy setting
3. Backend logs for errors

**Solutions:**
```bash
# Check backend logs
./scripts/dev-logs.sh backend

# Restart backend
docker-compose -f docker-compose.dev.yml restart backend

# Check API docs
open http://localhost:8010/docs
```

## 📝 Common Scenarios

### Scenario 1: Family Trip with Car

**Use Case:** Family of 4 traveling from Marseille to Tunis with a car

**Steps:**
1. Select Marseille → Tunis
2. Set departure date: July 15, 2024
3. Set passengers: 2 adults, 2 children
4. Check "traveling with vehicle"
5. Search
6. Add 2 adult passengers (parents)
7. Add 2 child passengers (kids)
8. Add vehicle: Car (standard preset)
9. Continue to ferry selection
10. Choose ferry
11. Review and proceed

### Scenario 2: Solo Traveler with Motorcycle

**Use Case:** One person traveling from Genoa to Tunis with motorcycle

**Steps:**
1. Select Genoa → Tunis
2. Set departure date: August 1, 2024
3. Set passengers: 1 adult
4. Check "traveling with vehicle"
5. Search
6. Add 1 adult passenger
7. Add vehicle: Motorcycle
8. Continue to ferry selection
9. Choose ferry
10. Review and proceed

### Scenario 3: Group Travel in Camper Van

**Use Case:** 6 people traveling in a camper from Nice to Tunis

**Steps:**
1. Select Nice → Tunis
2. Set departure date: September 10, 2024
3. Set passengers: 5 adults, 1 child
4. Check "traveling with vehicle"
5. Search
6. Add 5 adult passengers
7. Add 1 child passenger
8. Add vehicle: Camper (7m length)
9. Customize dimensions if needed
10. Continue to ferry selection
11. Choose ferry
12. Review and proceed

### Scenario 4: Commercial Truck Transport

**Use Case:** Truck driver transporting goods

**Steps:**
1. Select Civitavecchia → Tunis
2. Set departure date: June 20, 2024
3. Set passengers: 1 adult
4. Check "traveling with vehicle"
5. Search
6. Add 1 adult passenger (driver)
7. Add vehicle: Truck
8. Set dimensions: 10m × 2.5m × 3.8m
9. Add registration and details
10. Continue to ferry selection
11. Choose ferry
12. Review and proceed

## 🎯 Testing Checklist

Before deploying to production, test:

### Search Functionality
- [ ] All ports are selectable
- [ ] Date validation works
- [ ] Can't select past dates
- [ ] Return date must be after departure
- [ ] Passenger counts adjust correctly
- [ ] Vehicle toggle works
- [ ] Search button submits form
- [ ] Redirects to search page

### Passenger Management
- [ ] Can add adult passengers
- [ ] Can add child passengers
- [ ] Can add infant passengers
- [ ] Name validation works
- [ ] Age validation works for each type
- [ ] Can edit saved passengers
- [ ] Can remove passengers (except first)
- [ ] Collapsed cards show correct info

### Vehicle Management
- [ ] Can add all 7 vehicle types
- [ ] Preset dimensions load correctly
- [ ] Can customize dimensions
- [ ] Can add optional details
- [ ] Can edit saved vehicles
- [ ] Can remove vehicles
- [ ] Can add multiple vehicles
- [ ] Collapsed cards show correct info

### Ferry Selection
- [ ] API call is made
- [ ] Loading spinner appears
- [ ] Results display correctly
- [ ] Can select ferry
- [ ] Price displays correctly
- [ ] Operator name shows
- [ ] Departure/arrival times formatted
- [ ] Duration calculated

### Review & Proceed
- [ ] All details display correctly
- [ ] Total price is accurate
- [ ] Can go back to edit
- [ ] Proceed button works

### Responsive Design
- [ ] Mobile (320px) works
- [ ] Tablet (768px) works
- [ ] Desktop (1024px+) works
- [ ] Touch inputs work on mobile
- [ ] Navigation is easy on all devices

## 📚 Next Steps

### For Development

1. **Add more features:**
   - Date picker component
   - Cabin selection
   - Price filters
   - Operator preferences

2. **Improve UX:**
   - Add animations
   - Implement skeleton loaders
   - Add success notifications
   - Implement auto-save

3. **Add tests:**
   - Unit tests for components
   - Integration tests for flows
   - E2E tests with Cypress

### For Production

1. **Optimize performance:**
   - Code splitting
   - Image optimization
   - Bundle size reduction
   - CDN for static assets

2. **SEO & Analytics:**
   - Meta tags
   - Sitemap
   - Google Analytics
   - Tracking events

3. **Security:**
   - Input sanitization
   - XSS protection
   - CSRF tokens
   - Rate limiting

## 🆘 Need Help?

### Resources

- **Frontend Documentation:** [FRONTEND_REDESIGN.md](./FRONTEND_REDESIGN.md)
- **Development Guide:** [DEVELOPMENT.md](./DEVELOPMENT.md)
- **Backend API Docs:** http://localhost:8010/docs
- **Port Configuration:** [PORT_CONFIGURATION.md](./PORT_CONFIGURATION.md)

### Debug Commands

```bash
# Check all services
docker-compose -f docker-compose.dev.yml ps

# View backend logs
./scripts/dev-logs.sh backend

# View all logs
./scripts/dev-logs.sh

# Restart everything
./scripts/dev-stop.sh
./scripts/dev-start.sh

# Reset database (WARNING: deletes data)
./scripts/dev-reset.sh
```

### Common Commands

```bash
# Frontend
cd frontend
npm start          # Start dev server
npm test           # Run tests
npm run build      # Production build
npm run lint       # Check code quality

# Backend
./scripts/dev-start.sh    # Start services
./scripts/dev-stop.sh     # Stop services
./scripts/dev-logs.sh     # View logs
```

---

## 🎉 You're Ready!

Your modern ferry booking platform is now up and running with:

✅ **7 vehicle types** with full customization
✅ **Complete passenger management** with validation
✅ **Step-by-step booking flow**
✅ **Modern, responsive design**
✅ **Real-time search** across all ferry operators
✅ **Comprehensive error handling**

**Start Booking Ferries! ⚓️**

Visit: **http://localhost:3000**