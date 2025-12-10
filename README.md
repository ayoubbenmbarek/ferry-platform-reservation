# Maritime Reservation Platform

A comprehensive ferry booking platform for Tunisia routes, built with FastAPI backend and React frontend.

## 🚀 Quick Start

**Local Development (Recommended):**
```bash
# Start backend with Docker
./scripts/dev-start.sh

# Start frontend (in new terminal)
cd frontend && npm install && npm start

# Open http://localhost:3010
```

**See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed local development guide.**

**Production Deployment:**
```bash
# Configure environment
cp .env.example .env
cp backend/.env.production.example backend/.env.production
# Edit both files with your values

# Deploy
./scripts/deploy.sh
```

**See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete production deployment guide.**

---

## Project Structure

```
maritime-reservation-website/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   │   ├── v1/
│   │   │   │   ├── auth.py         # Authentication endpoints
│   │   │   │   ├── bookings.py     # Booking endpoints
│   │   │   │   └── ferries.py      # Ferry search endpoints
│   │   │   └── deps.py             # API dependencies
│   │   ├── models/         # Database models
│   │   │   ├── user.py
│   │   │   ├── booking.py
│   │   │   └── ferry.py
│   │   ├── schemas/        # Pydantic schemas
│   │   │   ├── user.py
│   │   │   ├── booking.py
│   │   │   └── ferry.py
│   │   ├── services/       # Business logic
│   │   │   ├── ferry_service.py
│   │   │   └── ferry_integrations/
│   │   ├── config.py       # Configuration
│   │   ├── database.py     # Database setup
│   │   └── main.py         # FastAPI app
│   ├── alembic/           # Database migrations
│   ├── requirements.txt   # Python dependencies
│   └── .env.example       # Environment variables template
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── store/         # Redux store
│   │   └── App.tsx        # Main app component
│   ├── package.json       # Node dependencies
│   └── tailwind.config.js # Tailwind CSS config
└── README.md
```

## Features

### Backend Features
- **Authentication System**: JWT-based authentication with registration, login, password management
- **Booking Management**: Complete booking lifecycle with multiple ferry operators
- **Ferry Integration**: Modular system for integrating with different ferry operators (CTN, GNV, Corsica Lines, etc.)
- **API Documentation**: Auto-generated OpenAPI/Swagger documentation
- **Database Models**: Comprehensive models for users, bookings, ferries, passengers, and vehicles
- **Security**: Input validation, rate limiting, and secure password handling

### Frontend Features
- **Modern React App**: Built with TypeScript, Redux Toolkit, and React Router
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Internationalization**: Multi-language support (English, French, Arabic, Italian)
- **Ferry Search**: Advanced search with filters for routes, dates, passengers, and vehicles
- **Booking Flow**: Step-by-step booking process with passenger and vehicle details
- **User Dashboard**: Account management and booking history
- **Real-time Updates**: Live ferry schedules and booking status

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- PostgreSQL (for production) or SQLite (for development)

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Initialize database**:
   ```bash
   alembic upgrade head
   ```

6. **Run the development server**:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

The API will be available at `http://localhost:8000` with documentation at `http://localhost:8000/docs`.

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install additional Tailwind CSS plugins**:
   ```bash
   npm install -D @tailwindcss/forms @tailwindcss/typography @tailwindcss/aspect-ratio
   ```

4. **Start the development server**:
   ```bash
   npm start
   ```

The frontend will be available at `http://localhost:3010`.

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/change-password` - Change password
- `POST /api/v1/auth/forgot-password` - Request password reset

### Ferry Search
- `GET /api/v1/ferries/search` - Search available ferries
- `GET /api/v1/ferries/routes` - Get available routes
- `GET /api/v1/ferries/operators` - Get ferry operators

### Bookings
- `POST /api/v1/bookings` - Create new booking
- `GET /api/v1/bookings` - List user bookings
- `GET /api/v1/bookings/{id}` - Get booking details
- `PUT /api/v1/bookings/{id}` - Update booking
- `POST /api/v1/bookings/{id}/cancel` - Cancel booking
- `GET /api/v1/bookings/reference/{ref}` - Get booking by reference

## Ferry Operators Integration

The platform supports integration with multiple ferry operators:

- **CTN (Compagnie Tunisienne de Navigation)**: Primary Tunisian operator
- **GNV (Grandi Navi Veloci)**: Italian operator
- **Corsica Lines**: French operator
- **Danel Casanova**: Specialized Tunisia routes
- **Moby Lines**: Additional Italian routes
- **Grimaldi Lines**: Mediterranean routes

Each operator integration is modular and can be easily extended.

## Supported Routes

### Italy to Tunisia
- Genoa ↔ Tunis (24h journey)
- Civitavecchia ↔ Tunis (22h journey)
- Palermo ↔ Tunis (11h journey)
- Salerno ↔ Tunis (16h journey)

### France to Tunisia
- Marseille ↔ Tunis (21h journey)
- Nice ↔ Tunis (19h journey)

## Development

### Backend Development
- **Framework**: FastAPI with async support
- **Database**: SQLAlchemy ORM with Alembic migrations
- **Authentication**: JWT tokens with bcrypt password hashing
- **Validation**: Pydantic models for request/response validation
- **Testing**: pytest with test database

### Frontend Development
- **Framework**: React 18 with TypeScript
- **State Management**: Redux Toolkit
- **Styling**: Tailwind CSS with custom components
- **Routing**: React Router v6
- **API Calls**: Axios with React Query for caching
- **Forms**: React Hook Form with validation

### Code Quality
- **Backend**: Black formatting, flake8 linting, mypy type checking
- **Frontend**: ESLint, Prettier, TypeScript strict mode
- **Testing**: Comprehensive test coverage for critical paths

## Deployment

### Production Environment Variables

**Backend (.env)**:
```
DATABASE_URL=postgresql://user:password@localhost/maritime_db
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=["http://localhost:3010", "https://yourdomain.com"]
```

**Frontend (.env)**:
```
REACT_APP_API_URL=https://api.yourdomain.com/api/v1
```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Manual Deployment
1. Set up PostgreSQL database
2. Configure environment variables
3. Run database migrations
4. Build frontend assets
5. Deploy with reverse proxy (nginx)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Email: support@voilaferry.com
- Documentation: [API Docs](http://localhost:8000/docs)
- Issues: GitHub Issues

## Documentation

All documentation files are located in the `/docs` directory:

| Document | Description |
|----------|-------------|
| [IMPLEMENTATION_COMPLETE.md](docs/IMPLEMENTATION_COMPLETE.md) | Full implementation status and feature list |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture overview |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local development guide |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment guide |
| [API_INTEGRATIONS.md](docs/API_INTEGRATIONS.md) | Ferry operator API integrations |
| [FERRY_INTEGRATIONS.md](docs/FERRY_INTEGRATIONS.md) | Ferry operator details |
| [AUTHENTICATION_AND_ADMIN_SYSTEM.md](docs/AUTHENTICATION_AND_ADMIN_SYSTEM.md) | Auth system documentation |
| [BOOKING_SYSTEM_COMPLETE.md](docs/BOOKING_SYSTEM_COMPLETE.md) | Booking flow documentation |
| [MULTILINGUAL_IMPLEMENTATION.md](docs/MULTILINGUAL_IMPLEMENTATION.md) | i18n implementation |
| [STRIPE_WEBHOOK_SETUP.md](docs/STRIPE_WEBHOOK_SETUP.md) | Payment webhook configuration |
| [SENTRY_SETUP.md](docs/SENTRY_SETUP.md) | Error monitoring setup |
| [SMART_PRICING_PLAN.md](docs/SMART_PRICING_PLAN.md) | Smart pricing feature design |

## Roadmap

- [x] Mobile app (React Native)
- [x] Real-time notifications
- [ ] Advanced analytics dashboard
- [ ] Multi-currency support
- [ ] Loyalty program
- [ ] Group booking discounts
- [ ] Weather integration
- [ ] Live chat support