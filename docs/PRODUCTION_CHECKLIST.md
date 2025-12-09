# Production Deployment Checklist

Use this checklist to ensure all critical steps are completed before and after deployment.

## Pre-Deployment

### Environment Setup
- [ ] Server provisioned with minimum requirements (2 CPU, 4GB RAM, 40GB storage)
- [ ] Docker and Docker Compose installed
- [ ] Domain DNS configured and propagated (A records for domain and www subdomain)
- [ ] Firewall configured (ports 80, 443, SSH only)
- [ ] SSH access secured (key-based authentication, disable root login)

### Configuration Files
- [ ] `.env` file created and configured from `.env.example`
- [ ] `backend/.env.production` created from template
- [ ] Strong SECRET_KEY generated (min 32 chars): `openssl rand -hex 32`
- [ ] POSTGRES_PASSWORD set to strong password
- [ ] REDIS_PASSWORD set to strong password
- [ ] ALLOWED_ORIGINS updated with production domain(s)
- [ ] Domain name updated in `nginx/conf.d/maritime.conf`

### API Keys & Credentials
- [ ] Stripe production keys configured (sk_live_*, pk_live_*)
- [ ] Stripe webhook secret configured
- [ ] SMTP credentials configured for email delivery
- [ ] CTN API production credentials
- [ ] GNV API production credentials
- [ ] Corsica Lines API production credentials
- [ ] Danel API production credentials

### SSL Certificates
- [ ] SSL certificates obtained (Let's Encrypt or commercial)
- [ ] Certificates placed in `nginx/ssl/` directory
- [ ] Certificate auto-renewal configured (cron job)

### Database
- [ ] Database backup strategy planned
- [ ] Initial migration files reviewed
- [ ] Database connection tested

### Application Code
- [ ] Latest code pulled from main branch
- [ ] All dependencies up to date
- [ ] No DEBUG mode in production
- [ ] No development/test API keys in .env files

## Deployment

### Build & Deploy
- [ ] Docker images built successfully: `docker-compose build`
- [ ] Database and Redis started: `docker-compose up -d postgres redis`
- [ ] Database migrations run: `docker-compose run --rm backend alembic upgrade head`
- [ ] All services started: `docker-compose up -d`
- [ ] All containers running: `docker-compose ps`

### Initial Data
- [ ] Admin user created
- [ ] Test user created
- [ ] Sample data loaded (if applicable)

## Post-Deployment Verification

### Health Checks
- [ ] Backend health endpoint responds: `curl https://yourdomain.com/health`
- [ ] Frontend loads: `https://yourdomain.com`
- [ ] API accessible: `https://yourdomain.com/api/v1/`
- [ ] All containers healthy: `docker-compose ps`

### Functionality Tests
- [ ] User registration works
- [ ] User login works
- [ ] Password reset email delivered
- [ ] Ferry search returns results
- [ ] Booking creation works
- [ ] Payment processing works (test with Stripe test card)
- [ ] Email notifications sent
- [ ] Multi-language support works
- [ ] Mobile responsive design verified

### Security Tests
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] SSL certificate valid (check with ssllabs.com)
- [ ] Security headers present (X-Frame-Options, CSP, etc.)
- [ ] Rate limiting functional
- [ ] Admin endpoints protected
- [ ] No sensitive data in logs
- [ ] Database not publicly accessible
- [ ] API documentation disabled in production (/docs, /redoc)

### Performance Tests
- [ ] Page load time acceptable (< 3 seconds)
- [ ] API response time acceptable (< 500ms)
- [ ] Database queries optimized
- [ ] Static assets cached
- [ ] Gzip compression enabled

### Monitoring Setup
- [ ] Log rotation configured
- [ ] Application logs accessible
- [ ] Error tracking set up (Sentry, etc.)
- [ ] Uptime monitoring configured (UptimeRobot, etc.)
- [ ] SSL expiry monitoring enabled
- [ ] Disk space monitoring enabled

### Backup & Recovery
- [ ] Automated backup script working: `./scripts/backup.sh`
- [ ] Backup cron job configured
- [ ] Backup restoration tested: `./scripts/restore.sh`
- [ ] Off-site backup configured (S3, etc.)
- [ ] Disaster recovery plan documented

## Ongoing Maintenance

### Daily
- [ ] Check uptime monitoring alerts
- [ ] Review error logs
- [ ] Monitor disk space

### Weekly
- [ ] Review application logs
- [ ] Check backup completion
- [ ] Test restore procedure (monthly)
- [ ] Review security alerts

### Monthly
- [ ] Update dependencies
- [ ] Review and rotate API keys
- [ ] Check SSL certificate expiry
- [ ] Performance optimization review
- [ ] Security audit

### Quarterly
- [ ] Full disaster recovery test
- [ ] Security penetration testing
- [ ] Database optimization
- [ ] Infrastructure cost review

## Emergency Contacts

Document your emergency contacts and escalation procedures:

- **Infrastructure Provider**: ________________
- **Domain Registrar**: ________________
- **SSL Certificate Provider**: ________________
- **On-call Engineer**: ________________
- **Backup Engineer**: ________________

## Rollback Plan

If deployment fails:

1. Stop new services: `docker-compose down`
2. Restore database from backup: `./scripts/restore.sh`
3. Revert to previous Docker images
4. Start previous version: `docker-compose up -d`
5. Verify functionality
6. Investigate issues in staging environment

## Notes

Document any production-specific configurations or issues:

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Git Commit**: _______________
**Issues Encountered**: _______________
