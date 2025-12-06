# Quick Start - Production Deployment

This is a quick reference guide for deploying the Maritime Reservation Platform to production. For detailed instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Prerequisites

- Ubuntu 20.04+ server with 4GB RAM, 2+ CPU cores
- Docker & Docker Compose installed
- Domain name with DNS configured
- API credentials (Stripe, Ferry operators, SMTP)

## 5-Minute Deployment

### 1. Clone and Configure

```bash
# Clone repository
cd /opt
sudo git clone <your-repo-url> maritime-reservation-website
cd maritime-reservation-website
sudo chown -R $USER:$USER .

# Create environment files
cp .env.example .env
cp backend/.env.production.example backend/.env.production

# Edit configurations (REQUIRED!)
nano .env  # Set database passwords
nano backend/.env.production  # Set SECRET_KEY, API keys, domain
```

### 2. Generate Secrets

```bash
# Generate SECRET_KEY
openssl rand -hex 32

# Add to backend/.env.production
```

### 3. Configure Domain

```bash
# Update nginx configuration
nano nginx/conf.d/maritime.conf
# Replace "yourdomain.com" with your actual domain
```

### 4. Setup SSL

```bash
# Run SSL setup script
sudo ./scripts/setup-ssl.sh
# Enter your domain and email when prompted
```

### 5. Deploy

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Deploy application
./scripts/deploy.sh
```

## Verify Deployment

```bash
# Check services
docker-compose ps

# Test health endpoint
curl https://yourdomain.com/health

# View logs
docker-compose logs -f
```

## Essential Configuration

### Required .env Variables

**Root .env**:
```env
POSTGRES_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
```

**backend/.env.production**:
```env
SECRET_KEY=<32-char-random-string>
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
CTN_API_KEY=...
GNV_CLIENT_ID=...
GNV_CLIENT_SECRET=...
SMTP_HOST=...
SMTP_USERNAME=...
SMTP_PASSWORD=...
```

## Common Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart service
docker-compose restart backend

# Run migrations
docker-compose run --rm backend alembic upgrade head

# Create backup
./scripts/backup.sh

# Deploy updates
./scripts/deploy.sh
```

## Troubleshooting

### Services won't start
```bash
docker-compose logs
docker-compose up -d --force-recreate
```

### SSL issues
```bash
sudo ./scripts/setup-ssl.sh
docker-compose restart nginx
```

### Database issues
```bash
docker-compose logs postgres
docker-compose restart postgres
```

## Next Steps

1. ✅ Create admin user (see DEPLOYMENT.md)
2. ✅ Configure Stripe webhooks
3. ✅ Set up automated backups (see DEPLOYMENT.md)
4. ✅ Configure monitoring
5. ✅ Test all features

## Support

- Full guide: [DEPLOYMENT.md](DEPLOYMENT.md)
- Checklist: [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
