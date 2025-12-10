# Maritime Reservation Platform - Deployment Guide

Complete guide for deploying the Maritime Reservation Platform to staging and production environments.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [VPS Setup](#vps-setup)
3. [Domain & DNS Configuration](#domain--dns-configuration)
4. [GitHub Secrets Configuration](#github-secrets-configuration)
5. [Deployment](#deployment)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, you'll need:

- [ ] A VPS provider account (Hetzner, DigitalOcean, Vultr, etc.)
- [ ] A domain name
- [ ] GitHub repository access
- [ ] Stripe account (test mode for staging)
- [ ] Google Cloud Console project (for OAuth)
- [ ] Gmail account with App Password enabled

### Recommended VPS Specifications

| Environment | CPU | RAM | Storage | Monthly Cost |
|-------------|-----|-----|---------|--------------|
| Staging | 2 vCPU | 4 GB | 40 GB SSD | ~$6-12 |
| Production | 4 vCPU | 8 GB | 80 GB SSD | ~$24-48 |

### Recommended VPS Providers

| Provider | Staging Plan | Price | Link |
|----------|-------------|-------|------|
| **Hetzner** | CX22 | €4.35/mo | [hetzner.com/cloud](https://www.hetzner.com/cloud) |
| **DigitalOcean** | Basic $6 | $6/mo | [digitalocean.com](https://www.digitalocean.com) |
| **Vultr** | Cloud Compute | $6/mo | [vultr.com](https://www.vultr.com) |
| **Linode** | Shared 2GB | $10/mo | [linode.com](https://www.linode.com) |

---

## VPS Setup

### Step 1: Create VPS

1. Sign up/login to your VPS provider
2. Create a new server with:
   - **OS**: Ubuntu 22.04 LTS
   - **Region**: Choose closest to your users (EU recommended)
   - **Size**: 2 vCPU, 4GB RAM minimum
   - **SSH Key**: Add your public SSH key

3. Note the server's IP address

### Step 2: Initial Server Setup

SSH into your server:
```bash
ssh root@YOUR_SERVER_IP
```

Update system and create a non-root user:
```bash
# Update system
apt update && apt upgrade -y

# Create deploy user
adduser deploy
usermod -aG sudo deploy

# Copy SSH key to deploy user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh

# Setup firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 6443/tcp  # Kubernetes API
ufw enable

# Switch to deploy user
su - deploy
```

### Step 3: Run Setup Script

```bash
# Download and run the setup script
curl -sSL https://raw.githubusercontent.com/ayoubmbarek/maritime-reservation-website/main/scripts/setup-staging-vps.sh -o setup.sh
chmod +x setup.sh
./setup.sh
```

The script will:
- Install k3s (lightweight Kubernetes)
- Install cert-manager for SSL certificates
- Create Let's Encrypt ClusterIssuers
- Prompt for your secrets (Stripe, Google, etc.)
- Deploy the application

---

## Domain & DNS Configuration

### Step 1: Purchase Domain

Purchase a domain from:
- [Namecheap](https://www.namecheap.com) (~$10/year for .com)
- [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) (at-cost pricing)
- [Google Domains](https://domains.google)

### Step 2: Configure DNS Records

Add the following DNS records pointing to your VPS IP:

#### Staging Environment
| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | staging | YOUR_VPS_IP | 3600 |
| A | api-staging | YOUR_VPS_IP | 3600 |
| A | chatbot-staging | YOUR_VPS_IP | 3600 |

#### Production Environment
| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | YOUR_VPS_IP | 3600 |
| A | www | YOUR_VPS_IP | 3600 |
| A | api | YOUR_VPS_IP | 3600 |
| A | chatbot | YOUR_VPS_IP | 3600 |

### Step 3: Verify DNS Propagation

```bash
# Check DNS resolution (may take 5-30 minutes)
dig staging.voilaferry.com +short
dig api-staging.voilaferry.com +short
```

Or use [dnschecker.org](https://dnschecker.org)

---

## GitHub Secrets Configuration

Navigate to your GitHub repository → Settings → Secrets and variables → Actions

### Required Secrets

#### For Staging Deployment (deploy-staging.yml)

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `STAGING_HOST` | VPS IP address | From VPS provider |
| `STAGING_USER` | SSH user (e.g., `deploy`) | Created during setup |
| `STAGING_SSH_KEY` | Private SSH key | `cat ~/.ssh/id_rsa` |
| `STAGING_SSH_PORT` | SSH port (default: `22`) | Usually 22 |
| `KUBE_CONFIG_STAGING` | Base64 kubeconfig | Run `./scripts/generate-github-kubeconfig.sh` on VPS |

#### For Stripe Integration

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `STAGING_STRIPE_PUBLISHABLE_KEY` | Stripe public key | [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) |
| `STRIPE_SECRET_KEY` | Stripe secret key | Same dashboard |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | Stripe → Developers → Webhooks |

#### For Google OAuth

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `STAGING_GOOGLE_CLIENT_ID` | Google OAuth client ID | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | Same console |

#### For Mobile App (EAS)

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `EXPO_TOKEN` | Expo access token | [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens) |
| `GOOGLE_IOS_CLIENT_ID` | iOS Google Sign-In | Google Cloud Console |
| `GOOGLE_ANDROID_CLIENT_ID` | Android Google Sign-In | Google Cloud Console |

#### For Error Tracking

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `SENTRY_DSN_FRONTEND` | Sentry DSN for frontend | [sentry.io](https://sentry.io) |
| `SENTRY_DSN_BACKEND` | Sentry DSN for backend | Same project or separate |

### Generate SSH Key (if needed)

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy"

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/id_ed25519.pub deploy@YOUR_VPS_IP

# The private key content goes in STAGING_SSH_KEY secret
cat ~/.ssh/id_ed25519
```

### Generate Kubeconfig for CI/CD

On your VPS:
```bash
cd /opt/maritime-reservation-website
./scripts/generate-github-kubeconfig.sh
```

Copy the base64-encoded output to `KUBE_CONFIG_STAGING` secret.

---

## Deployment

### Automatic Deployment (via GitHub Actions)

Push to the staging branch triggers automatic deployment:

```bash
git checkout staging
git merge features  # or your development branch
git push origin staging
```

Monitor the deployment:
- Go to GitHub → Actions tab
- Watch the "Deploy to Staging" workflow

### Manual Deployment

SSH into your VPS and run:

```bash
cd /opt/maritime-reservation-website
git pull origin staging
kubectl apply -k k8s/overlays/staging
kubectl -n maritime-reservations-staging rollout status deployment --all
```

---

## Verification

### Check Kubernetes Resources

```bash
# All resources
kubectl -n maritime-reservations-staging get all

# Pods status
kubectl -n maritime-reservations-staging get pods

# Services
kubectl -n maritime-reservations-staging get svc

# Ingress
kubectl -n maritime-reservations-staging get ingress

# Certificates
kubectl -n maritime-reservations-staging get certificate
```

### Check Application Health

```bash
# Backend health
curl https://api-staging.voilaferry.com/health

# Frontend
curl -I https://staging.voilaferry.com

# View logs
kubectl -n maritime-reservations-staging logs -f deployment/staging-backend
```

### Check SSL Certificates

```bash
# Certificate status
kubectl -n maritime-reservations-staging describe certificate

# Test SSL
curl -vI https://staging.voilaferry.com 2>&1 | grep -A 5 "SSL certificate"
```

---

## Troubleshooting

### Pod Not Starting

```bash
# Check pod events
kubectl -n maritime-reservations-staging describe pod <pod-name>

# Check previous logs
kubectl -n maritime-reservations-staging logs <pod-name> --previous
```

### Database Connection Issues

```bash
# Check postgres pod
kubectl -n maritime-reservations-staging get pods -l app=postgres

# Test connection from backend
kubectl -n maritime-reservations-staging exec -it deployment/staging-backend -- \
  python -c "from app.database import engine; print(engine.connect())"
```

### SSL Certificate Issues

```bash
# Check certificate request
kubectl -n maritime-reservations-staging get certificaterequest

# Check cert-manager logs
kubectl -n cert-manager logs deployment/cert-manager

# Force renewal
kubectl -n maritime-reservations-staging delete certificate staging-maritime-tls-secret
```

### Ingress Not Working

```bash
# Check ingress controller
kubectl -n kube-system get pods | grep traefik

# Check traefik logs
kubectl -n kube-system logs deployment/traefik
```

### View All Logs

```bash
# Install k9s for easier management
curl -sS https://webinstall.dev/k9s | bash
k9s -n maritime-reservations-staging
```

---

## Quick Reference

### Useful Commands

```bash
# Scale deployment
kubectl -n maritime-reservations-staging scale deployment/staging-backend --replicas=2

# Restart deployment
kubectl -n maritime-reservations-staging rollout restart deployment/staging-backend

# Get shell in pod
kubectl -n maritime-reservations-staging exec -it deployment/staging-backend -- /bin/sh

# Port forward for debugging
kubectl -n maritime-reservations-staging port-forward svc/staging-backend-service 8010:8010
```

### Update Deployment

```bash
# Update image tag
kubectl -n maritime-reservations-staging set image deployment/staging-backend \
  backend=ghcr.io/ayoubmbarek/maritime-reservation-website/backend:new-tag

# Or use kustomize
cd k8s/overlays/staging
kustomize edit set image ghcr.io/ayoubmbarek/maritime-reservation-website/backend:new-tag
kubectl apply -k .
```

---

## Support

- Check existing issues: [GitHub Issues](https://github.com/ayoubmbarek/maritime-reservation-website/issues)
- k3s documentation: [k3s.io](https://k3s.io)
- cert-manager docs: [cert-manager.io](https://cert-manager.io)
