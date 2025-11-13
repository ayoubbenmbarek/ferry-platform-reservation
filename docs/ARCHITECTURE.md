# Maritime Reservation Website - Complete Project Guide

## Project Structure

```
maritime-reservation-platform/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI application entry point
│   │   ├── config.py               # Configuration settings
│   │   ├── database.py             # Database connection setup
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py             # User model
│   │   │   ├── booking.py          # Booking model
│   │   │   ├── ferry.py            # Ferry and route models
│   │   │   └── payment.py          # Payment model
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── user.py             # Pydantic schemas for users
│   │   │   ├── booking.py          # Booking schemas
│   │   │   ├── ferry.py            # Ferry schemas
│   │   │   └── payment.py          # Payment schemas
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py             # Dependencies (auth, database)
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── auth.py         # Authentication endpoints
│   │   │       ├── users.py        # User management endpoints
│   │   │       ├── ferries.py      # Ferry search endpoints
│   │   │       ├── bookings.py     # Booking endpoints
│   │   │       └── payments.py     # Payment endpoints
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── ferry_integrations/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── base.py         # Base integration class
│   │   │   │   ├── ctn.py          # CTN API integration
│   │   │   │   ├── gnv.py          # GNV API integration
│   │   │   │   ├── corsica.py      # Corsica Lines integration
│   │   │   │   └── danel.py        # Danel Casanova integration
│   │   │   ├── booking_service.py  # Booking business logic
│   │   │   ├── payment_service.py  # Payment processing
│   │   │   ├── email_service.py    # Email notifications
│   │   │   └── auth_service.py     # Authentication logic
│   │   ├── utils/
│   │   │   ├── __init__.py
│   │   │   ├── security.py         # Password hashing, JWT
│   │   │   ├── email.py            # Email utilities
│   │   │   └── helpers.py          # General helper functions
│   │   └── tests/
│   │       ├── __init__.py
│   │       ├── conftest.py         # Test configuration
│   │       ├── test_auth.py        # Authentication tests
│   │       ├── test_bookings.py    # Booking tests
│   │       └── test_integrations.py # API integration tests
│   ├── alembic/                    # Database migrations
│   │   ├── versions/
│   │   ├── env.py
│   │   └── alembic.ini
│   ├── requirements.txt            # Python dependencies
│   ├── requirements-dev.txt        # Development dependencies
│   ├── Dockerfile                 # Docker configuration
│   └── .env.example               # Environment variables template
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   ├── favicon.ico
│   │   └── locales/               # Translation files
│   │       ├── en/
│   │       ├── fr/
│   │       ├── ar/
│   │       └── it/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/            # Reusable components
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   ├── Loading.tsx
│   │   │   │   └── ErrorBoundary.tsx
│   │   │   ├── ferry/             # Ferry-related components
│   │   │   │   ├── SearchForm.tsx
│   │   │   │   ├── ResultsList.tsx
│   │   │   │   ├── RouteCard.tsx
│   │   │   │   └── PriceComparison.tsx
│   │   │   ├── booking/           # Booking components
│   │   │   │   ├── BookingForm.tsx
│   │   │   │   ├── PassengerDetails.tsx
│   │   │   │   ├── VehicleDetails.tsx
│   │   │   │   ├── CabinSelection.tsx
│   │   │   │   └── BookingSummary.tsx
│   │   │   ├── payment/           # Payment components
│   │   │   │   ├── PaymentForm.tsx
│   │   │   │   ├── PaymentMethods.tsx
│   │   │   │   └── PaymentConfirmation.tsx
│   │   │   └── user/              # User account components
│   │   │       ├── LoginForm.tsx
│   │   │       ├── RegisterForm.tsx
│   │   │       ├── Profile.tsx
│   │   │       └── BookingHistory.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── Search.tsx
│   │   │   ├── Booking.tsx
│   │   │   ├── Payment.tsx
│   │   │   ├── Confirmation.tsx
│   │   │   ├── Profile.tsx
│   │   │   └── Admin/
│   │   │       ├── Dashboard.tsx
│   │   │       ├── Bookings.tsx
│   │   │       └── Analytics.tsx
│   │   ├── hooks/                 # Custom React hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useBooking.ts
│   │   │   ├── useFerrySearch.ts
│   │   │   └── usePayment.ts
│   │   ├── services/              # API service functions
│   │   │   ├── api.ts             # Axios configuration
│   │   │   ├── authService.ts
│   │   │   ├── ferryService.ts
│   │   │   ├── bookingService.ts
│   │   │   └── paymentService.ts
│   │   ├── store/                 # Redux store (if using Redux)
│   │   │   ├── index.ts
│   │   │   ├── authSlice.ts
│   │   │   ├── bookingSlice.ts
│   │   │   └── ferrySlice.ts
│   │   ├── types/                 # TypeScript type definitions
│   │   │   ├── auth.ts
│   │   │   ├── booking.ts
│   │   │   ├── ferry.ts
│   │   │   └── payment.ts
│   │   ├── utils/
│   │   │   ├── constants.ts
│   │   │   ├── helpers.ts
│   │   │   ├── validators.ts
│   │   │   └── formatters.ts
│   │   ├── styles/
│   │   │   ├── globals.css
│   │   │   └── components/
│   │   ├── App.tsx
│   │   ├── index.tsx
│   │   └── i18n.ts               # Internationalization setup
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── .env.example
├── docs/
│   ├── API.md                    # API documentation
│   ├── DEPLOYMENT.md             # Deployment guide
│   ├── ARCHITECTURE.md           # System architecture
│   └── USER_GUIDE.md             # User manual
├── docker-compose.yml            # Local development setup
├── .gitignore
└── README.md
```

## Cursor IDE Setup Instructions

### 1. Essential Extensions for Cursor
```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.black-formatter",
    "ms-python.isort",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-python.pylint"
  ]
}
```

### 2. Cursor Settings Configuration
Create `.cursor/settings.json`:
```json
{
  "python.defaultInterpreterPath": "./backend/venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "python.formatting.provider": "black",
  "python.sortImports.args": ["--profile", "black"],
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.codeActionsOnSave": {
    "source.organizeImports": true,
    "source.fixAll": true
  },
  "files.associations": {
    "*.env.*": "dotenv"
  }
}
```

### 3. AI Context Files for Cursor

Create `.cursorrules` file in project root:
```markdown
# Maritime Reservation Platform Development Rules

## Project Context
This is a maritime reservation website for ferry bookings between Italy/France and Tunisia.
Main ferry operators: CTN, GNV, Corsica Lines, Danel Casanova.

## Technology Stack
- Backend: Python FastAPI with PostgreSQL
- Frontend: React TypeScript with Tailwind CSS
- Payment: Stripe integration
- Deployment: Docker containers

## Code Standards
- Use TypeScript for all React components
- Follow PEP 8 for Python code
- Use Pydantic models for API schemas
- Implement proper error handling
- Add comprehensive logging
- Write unit tests for critical functions

## API Integration Patterns
- Use abstract base classes for ferry operator integrations
- Implement retry logic with exponential backoff
- Cache API responses where appropriate
- Handle rate limiting gracefully

## Security Requirements
- Validate all user inputs
- Use parameterized queries
- Implement JWT authentication
- Encrypt sensitive data
- Follow OWASP guidelines

## UI/UX Guidelines
- Mobile-first responsive design
- Support RTL languages (Arabic)
- Implement loading states
- Show clear error messages
- Optimize for accessibility
```

### 4. Development Environment Setup

Create `docker-compose.dev.yml`:
```yaml
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: maritime_reservations
      POSTGRES_USER: dev_user
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    volumes:
      - ./backend:/app
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://dev_user:dev_password@db:5432/maritime_reservations
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  frontend:
    build: ./frontend
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "3010:3010"
    environment:
      - REACT_APP_API_URL=http://localhost:8000

volumes:
  postgres_data:
```

## Key Development Tips for Cursor

### 1. Use Claude Effectively
- Ask specific questions about ferry industry requirements
- Request code generation for API integrations
- Get help with complex booking logic
- Ask for debugging assistance with specific error messages

### 2. Leverage AI for Documentation
- Generate API documentation from code
- Create user stories for features
- Generate test cases
- Write deployment scripts

### 3. Code Generation Prompts
Use prompts like:
- "Generate a FastAPI endpoint for ferry search with CTN API integration"
- "Create a React component for multi-step booking form"
- "Write unit tests for payment processing service"
- "Generate database migration for booking tables"

### 4. Ferry Industry Specific Knowledge
- Understand cabin types (interior, exterior, suite)
- Vehicle categories (car, motorcycle, camper)
- Booking policies (cancellation, modification)
- Port codes and route mapping
- Seasonal schedule variations

## Essential Python Packages
```txt
# Backend requirements.txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
alembic==1.12.1
psycopg2-binary==2.9.9
pydantic==2.5.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
requests==2.31.0
celery==5.3.4
redis==5.0.1
stripe==7.8.0
jinja2==3.1.2
python-dotenv==1.0.0
pytest==7.4.3
httpx==0.25.2
```

## Essential Frontend Packages
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^4.9.5",
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "react-router-dom": "^6.20.1",
    "axios": "^1.6.2",
    "react-hook-form": "^7.48.2",
    "react-query": "^3.39.3",
    "@stripe/stripe-js": "^2.1.11",
    "@stripe/react-stripe-js": "^2.4.0",
    "i18next": "^23.7.6",
    "react-i18next": "^13.5.0",
    "date-fns": "^2.30.0",
    "react-datepicker": "^4.25.0",
    "tailwindcss": "^3.3.6",
    "headlessui": "^0.0.0",
    "heroicons": "^2.0.18"
  }
}
```

This structure will give you a solid foundation for developing your maritime reservation platform with Cursor and Claude's assistance.
