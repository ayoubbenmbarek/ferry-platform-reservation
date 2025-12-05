# Maritime Reservation Platform - Production Deployment Guide

This guide covers deploying the Maritime Reservation Platform to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Requirements](#infrastructure-requirements)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [SSL Certificate Setup](#ssl-certificate-setup)
7. [Deployment Steps](#deployment-steps)
8. [Post-Deployment Verification](#post-deployment-verification)
9. [Monitoring and Maintenance](#monitoring-and-maintenance)
10. [Troubleshooting](#troubleshooting)
11. [Backup and Recovery](#backup-and-recovery)

---

## Prerequisites

### Server Requirements

- **OS**: Ubuntu 20.04 LTS or later (recommended)
- **CPU**: Minimum 2 cores (4+ recommended)
- **RAM**: Minimum 4GB (8GB+ recommended)
- **Storage**: Minimum 40GB SSD
- **Network**: Static IP address with open ports 80, 443

### Required Software

```bash
# Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Git
sudo apt update
sudo apt install -y git

# Certbot (for SSL)
sudo apt install -y certbot
```

### Domain and DNS

- Domain name pointed to your server IP
- DNS A record: `yourdomain.com` → `your-server-ip`
- DNS A record: `www.yourdomain.com` → `your-server-ip`

---

## Infrastructure Requirements

### Required External Services

1. **PostgreSQL Database** (or use included Docker container)
2. **Redis** (or use included Docker container)
3. **SMTP Server** (for emails)
4. **Stripe Account** (for payments)
5. **Ferry Operator API Credentials**:
   - CTN API Key
   - GNV Client ID & Secret
   - Corsica API Key & Secret
   - Danel Username & Password

---

## Pre-Deployment Checklist

- [ ] Server provisioned with required specifications
- [ ] Domain DNS configured and propagated
- [ ] All required API keys and credentials obtained
- [ ] SMTP server configured for email delivery
- [ ] Stripe account set up in production mode
- [ ] Backup strategy planned
- [ ] Monitoring tools ready (optional but recommended)

---

## Environment Configuration

### 1. Clone the Repository

```bash
cd /opt
sudo git clone https://github.com/yourusername/maritime-reservation-website.git
cd maritime-reservation-website
sudo chown -R $USER:$USER .
```

### 2. Configure Environment Variables

#### Root .env File

```bash
cp .env.example .env
nano .env
```

**Update these values:**

```env
POSTGRES_DB=maritime_reservations
POSTGRES_USER=maritime_user
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD_HERE
REDIS_PASSWORD=YOUR_SECURE_REDIS_PASSWORD
ENVIRONMENT=production
DEBUG=False
```

#### Backend .env.production File

```bash
cd backend
cp .env.production.example .env.production
nano .env.production
```

**Critical values to update:**

1. **Security**:
   ```env
   SECRET_KEY=GENERATE_RANDOM_32_CHAR_STRING_HERE
   ```
   Generate with: `openssl rand -hex 32`

2. **CORS Origins**:
   ```env
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

3. **Email Configuration**:
   ```env
   SMTP_HOST=smtp.yourdomain.com
   SMTP_PORT=587
   SMTP_USERNAME=your-email@yourdomain.com
   SMTP_PASSWORD=your-smtp-password
   FROM_EMAIL=noreply@yourdomain.com
   ```

4. **Stripe** (Production keys):
   ```env
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

5. **Ferry Operator APIs**:
   ```env
   CTN_API_KEY=your_production_ctn_key
   GNV_CLIENT_ID=your_production_gnv_id
   GNV_CLIENT_SECRET=your_production_gnv_secret
   CORSICA_API_KEY=your_production_corsica_key
   CORSICA_SECRET=your_production_corsica_secret
   DANEL_USERNAME=your_production_danel_username
   DANEL_PASSWORD=your_production_danel_password
   ```

### 3. Update Nginx Configuration

```bash
nano nginx/conf.d/maritime.conf
```

Replace `yourdomain.com` with your actual domain name.

---

## Database Setup

### Option 1: Use Docker PostgreSQL (Recommended for Getting Started)

The docker-compose.yml includes PostgreSQL. Data is persisted in a Docker volume.

### Option 2: Use External PostgreSQL

Update `docker-compose.yml` to remove the postgres service and update the `DATABASE_URL` in backend environment.

---

## SSL Certificate Setup

### Automated SSL with Let's Encrypt

```bash
# Run the SSL setup script
sudo ./scripts/setup-ssl.sh
```

When prompted:
- Enter your domain name (e.g., `yourdomain.com`)
- Enter your email address

The script will:
1. Obtain SSL certificates from Let's Encrypt
2. Copy them to the nginx/ssl directory
3. Update nginx configuration

### Manual SSL Certificate

If you have your own SSL certificates:

```bash
# Copy your certificates
sudo cp /path/to/fullchain.pem nginx/ssl/
sudo cp /path/to/privkey.pem nginx/ssl/
sudo chmod 644 nginx/ssl/fullchain.pem
sudo chmod 600 nginx/ssl/privkey.pem
```

### SSL Auto-Renewal

Add to crontab for automatic renewal:

```bash
sudo crontab -e
```

Add this line:
```
0 0 * * 0 certbot renew --quiet --post-hook "docker restart maritime-nginx"
```

---

## Deployment Steps

### 1. Initial Deployment

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run deployment script
./scripts/deploy.sh
```

The deployment script will:
1. Build Docker images
2. Start database and redis
3. Run database migrations
4. Start all services
5. Verify health

### 2. Manual Deployment Steps (if not using script)

```bash
# Build images
docker-compose build --no-cache

# Start infrastructure services
docker-compose up -d postgres redis

# Wait for services to be ready
sleep 10

# Run database migrations
docker-compose run --rm backend alembic upgrade head

# Start all services
docker-compose up -d

# Check status
docker-compose ps
```

### 3. Create Initial Database Data

```bash
# Access the backend container
docker-compose exec backend bash

# Create admin user (example)
python -c "
from app.database import SessionLocal
from app.models.user import User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
db = SessionLocal()

admin = User(
    email='admin@yourdomain.com',
    hashed_password=pwd_context.hash('your_secure_password'),
    first_name='Admin',
    last_name='User',
    is_admin=True,
    is_verified=True,
    is_active=True
)
db.add(admin)
db.commit()
print('Admin user created')
"
```

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# Check all services are running
docker-compose ps

# Check backend health
curl https://yourdomain.com/health

# Check frontend
curl -I https://yourdomain.com

# Check API
curl https://yourdomain.com/api/v1/ferries/routes
```

### 2. Test Key Functionality

1. **Frontend**: Visit `https://yourdomain.com`
2. **User Registration**: Create a test account
3. **Ferry Search**: Search for available ferries
4. **Booking Flow**: Test the booking process
5. **Payment**: Test with Stripe test card (in test mode)

### 3. Monitor Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx

# View last 100 lines
docker-compose logs --tail=100 backend
```

---

## Monitoring and Maintenance

### Application Logs

Logs are written to:
- **Backend**: `backend/logs/`
- **Nginx**: `nginx/logs/`

View logs:
```bash
# Real-time backend logs
docker-compose logs -f backend

# Real-time nginx access logs
tail -f nginx/logs/maritime-access.log

# Real-time nginx error logs
tail -f nginx/logs/maritime-error.log
```

### Database Monitoring

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U maritime_user -d maritime_reservations

# Check database size
SELECT pg_size_pretty(pg_database_size('maritime_reservations'));

# Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Resource Monitoring

```bash
# Container resource usage
docker stats

# Disk usage
docker system df

# Clean up unused resources
docker system prune -f
```

### Application Health Monitoring

Set up monitoring for:
- `/health` endpoint (should return 200)
- SSL certificate expiry
- Disk space
- Database connections
- API response times

**Recommended tools**:
- Uptime monitoring: UptimeRobot, Pingdom
- Application monitoring: Sentry, New Relic
- Log aggregation: ELK Stack, Grafana Loki

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Check specific service
docker-compose logs backend

# Restart services
docker-compose restart

# Force recreate
docker-compose up -d --force-recreate
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Test connection
docker-compose exec backend python -c "from app.database import engine; engine.connect()"
```

### SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in nginx/ssl/fullchain.pem -text -noout

# Test SSL configuration
docker-compose exec nginx nginx -t

# Reload nginx
docker-compose restart nginx
```

### High Memory Usage

```bash
# Check container memory
docker stats --no-stream

# Restart specific service
docker-compose restart backend

# Clear Redis cache
docker-compose exec redis redis-cli FLUSHDB
```

### API Errors

```bash
# Check backend logs
docker-compose logs backend | grep ERROR

# Check ferry operator API connectivity
docker-compose exec backend curl -I https://api.ctn.com.tn/

# Restart backend
docker-compose restart backend celery-worker
```

---

## Backup and Recovery

### Automated Backups

```bash
# Set up daily backups
crontab -e
```

Add:
```
0 2 * * * cd /opt/maritime-reservation-website && ./scripts/backup.sh >> /var/log/maritime-backup.log 2>&1
```

### Manual Backup

```bash
# Create database backup
./scripts/backup.sh
```

Backups are stored in `./backups/` directory.

### Restore from Backup

```bash
# List available backups
ls -lh backups/

# Restore backup
./scripts/restore.sh
```

### Backup External Services

Don't forget to backup:
- SSL certificates
- Configuration files (.env files)
- Upload directory (`backend/uploads/`)
- Log files (if needed for compliance)

### Backup to External Storage

```bash
# Example: Backup to S3
aws s3 sync ./backups/ s3://your-bucket/maritime-backups/

# Example: Backup to remote server
rsync -avz ./backups/ user@backup-server:/backups/maritime/
```

---

## Updating the Application

### Pull Latest Changes

```bash
cd /opt/maritime-reservation-website
git pull origin main
```

### Apply Updates

```bash
# Run deployment script
./scripts/deploy.sh
```

Or manually:

```bash
# Rebuild images
docker-compose build

# Run migrations
docker-compose run --rm backend alembic upgrade head

# Restart services
docker-compose up -d
```

### Zero-Downtime Deployment (Advanced)

For production environments requiring zero downtime:

1. Set up a blue-green deployment
2. Use a load balancer
3. Deploy to the inactive environment
4. Switch traffic after verification

---

## Security Best Practices

1. **Keep secrets secure**: Never commit .env files
2. **Use strong passwords**: Generate with `openssl rand -hex 32`
3. **Enable firewall**: Only open ports 80, 443, and SSH
4. **Regular updates**: Keep Docker, OS, and dependencies updated
5. **Monitor logs**: Check for suspicious activity
6. **Rate limiting**: Nginx configuration includes rate limiting
7. **HTTPS only**: Redirect all HTTP to HTTPS
8. **Database backups**: Automate and encrypt backups
9. **API key rotation**: Regularly rotate API keys
10. **Security scanning**: Use GitHub Actions security workflow

---

## Support and Resources

- **Project Documentation**: `/docs` directory
- **API Documentation**: `https://yourdomain.com/docs` (if DEBUG=True)
- **Health Check**: `https://yourdomain.com/health`
- **GitHub Issues**: Report issues on GitHub repository

---

## Quick Reference Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Restart a service
docker-compose restart backend

# Run migrations
docker-compose run --rm backend alembic upgrade head

# Create backup
./scripts/backup.sh

# Deploy updates
./scripts/deploy.sh

# Check service status
docker-compose ps

# Access backend shell
docker-compose exec backend bash

# Access database
docker-compose exec postgres psql -U maritime_user -d maritime_reservations
```

---

**Last Updated**: 2024
**Version**: 1.0.0
