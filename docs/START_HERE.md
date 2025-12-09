# 🚢 Maritime Reservation Platform - START HERE

Welcome! This document will help you get started with the Maritime Reservation Platform.

## 📚 Choose Your Path

### 👨‍💻 For Developers (Local Development)

**Want to run and test the app locally?**

➡️ **Read [DEVELOPMENT.md](DEVELOPMENT.md)** - Complete local development guide

**Quick command to start:**
```bash
./scripts/dev-start.sh
```

Then open:
- Frontend: http://localhost:3010
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

### 🚀 For Deployment (Production)

**Ready to deploy to production?**

➡️ **Read [DEPLOYMENT.md](DEPLOYMENT.md)** - Complete production deployment guide

➡️ **Use [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)** - Step-by-step checklist

➡️ **Quick reference: [QUICKSTART_PRODUCTION.md](QUICKSTART_PRODUCTION.md)** - 5-minute guide

**Quick command to deploy:**
```bash
./scripts/deploy.sh
```

---

## 🗂️ Documentation Overview

| Document | Purpose | Audience |
|----------|---------|----------|
| [README.md](README.md) | Project overview and features | Everyone |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Local development setup | Developers |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deployment guide | DevOps/Deployment |
| [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) | Pre/post-deployment checklist | DevOps |
| [QUICKSTART_PRODUCTION.md](QUICKSTART_PRODUCTION.md) | 5-minute production guide | Quick reference |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture | Technical team |
| [docs/API_INTEGRATIONS.md](docs/API_INTEGRATIONS.md) | Ferry operator APIs | Backend developers |

---

## 🎯 Common Tasks

### First Time Setup (Local Development)

```bash
# 1. Make scripts executable
chmod +x scripts/*.sh

# 2. Start backend services with Docker
./scripts/dev-start.sh

# 3. In a new terminal, start frontend
cd frontend
npm install
npm start

# 4. Open your browser
# http://localhost:3010
```

### Daily Development Workflow

```bash
# Start services
./scripts/dev-start.sh

# View logs
./scripts/dev-logs.sh

# Stop services
./scripts/dev-stop.sh
```

### Testing Before Production

1. Run all tests locally
2. Test with production-like data
3. Review security checklist
4. Configure production environment variables
5. Deploy to staging first (if available)

### Production Deployment

```bash
# 1. Configure environment
cp .env.example .env
cp backend/.env.production.example backend/.env.production
# Edit both files!

# 2. Set up SSL
sudo ./scripts/setup-ssl.sh

# 3. Deploy
./scripts/deploy.sh

# 4. Verify
curl https://yourdomain.com/health
```

---

## 🛠️ Technology Stack

**Backend:**
- FastAPI (Python)
- PostgreSQL
- Redis
- Celery
- Stripe (payments)

**Frontend:**
- React 18 + TypeScript
- Redux Toolkit
- Tailwind CSS
- i18next (multi-language)

**Infrastructure:**
- Docker & Docker Compose
- Nginx (reverse proxy)
- Let's Encrypt SSL
- GitHub Actions (CI/CD)

---

## 📋 Available Scripts

### Development Scripts

| Script | Purpose |
|--------|---------|
| `./scripts/dev-start.sh` | Start all development services |
| `./scripts/dev-stop.sh` | Stop all development services |
| `./scripts/dev-reset.sh` | Reset dev environment (deletes data) |
| `./scripts/dev-logs.sh` | View service logs |

### Production Scripts

| Script | Purpose |
|--------|---------|
| `./scripts/deploy.sh` | Deploy to production |
| `./scripts/setup-ssl.sh` | Set up SSL certificates |
| `./scripts/backup.sh` | Backup database |
| `./scripts/restore.sh` | Restore database from backup |

---

## 🔑 Key Features

- ✅ Multi-operator ferry search (CTN, GNV, Corsica, Danel)
- ✅ Complete booking flow (passengers + vehicles + cabins)
- ✅ Stripe payment processing
- ✅ Multi-language support (EN, FR, AR, IT)
- ✅ User authentication & profiles
- ✅ Booking management & history
- ✅ Email notifications
- ✅ Admin dashboard (planned)
- ✅ Responsive mobile design

---

## 🆘 Getting Help

### Documentation Not Clear?

1. Check the specific guide for your task
2. Look at the code examples
3. Review the troubleshooting sections
4. Create an issue on GitHub

### Common Issues

**Services won't start:**
```bash
./scripts/dev-logs.sh  # Check what's wrong
docker ps              # Check Docker is running
```

**Port already in use:**
```bash
lsof -i :8000  # Backend port
lsof -i :3010  # Frontend port
```

**Need fresh start:**
```bash
./scripts/dev-reset.sh  # WARNING: Deletes data
./scripts/dev-start.sh
```

---

## 🎓 Learning Path

If you're new to the project:

1. **Day 1**: Set up local development ([DEVELOPMENT.md](DEVELOPMENT.md))
2. **Day 2**: Explore the codebase and documentation
3. **Day 3**: Make a small change and test it
4. **Day 4**: Review production deployment guide
5. **Day 5**: Deploy to staging/production

---

## 📞 Support

- **Documentation**: You're reading it! 📖
- **API Docs**: http://localhost:8000/docs (when running)
- **Issues**: Create a GitHub issue
- **Architecture**: See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## ⚡ Quick Links

- [Project Overview](README.md)
- [Local Development Guide](DEVELOPMENT.md)
- [Production Deployment](DEPLOYMENT.md)
- [Deployment Checklist](PRODUCTION_CHECKLIST.md)
- [Architecture Documentation](docs/ARCHITECTURE.md)
- [API Integrations](docs/API_INTEGRATIONS.md)

---

**Ready to get started? Pick your path above! 🚀**

*Last updated: 2024*