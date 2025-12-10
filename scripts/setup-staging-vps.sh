#!/bin/bash
# ============================================================
# Maritime Reservation Platform - VPS Staging Setup Script
# ============================================================
# Run this script on a fresh Ubuntu 22.04+ VPS
# Usage: curl -sSL <url> | bash
# Or: ./setup-staging-vps.sh
# ============================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ============================================================
# STEP 1: System Update
# ============================================================
log_info "Updating system packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git htop unzip jq

# ============================================================
# STEP 2: Install k3s
# ============================================================
log_info "Installing k3s..."
curl -sfL https://get.k3s.io | sh -s - --write-kubeconfig-mode 644

# Wait for k3s to be ready
sleep 10
sudo systemctl status k3s --no-pager

# Setup kubeconfig
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config
chmod 600 ~/.kube/config

# Verify installation
log_info "Verifying k3s installation..."
kubectl get nodes
kubectl get pods -A

log_success "k3s installed successfully!"

# ============================================================
# STEP 3: Install cert-manager
# ============================================================
log_info "Installing cert-manager..."
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml

# Wait for cert-manager
log_info "Waiting for cert-manager to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager

log_success "cert-manager installed!"

# ============================================================
# STEP 4: Create Let's Encrypt ClusterIssuers
# ============================================================
log_info "Creating Let's Encrypt ClusterIssuers..."

# Prompt for email
read -p "Enter your email for Let's Encrypt notifications: " LETSENCRYPT_EMAIL

kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: ${LETSENCRYPT_EMAIL}
    privateKeySecretRef:
      name: letsencrypt-staging
    solvers:
      - http01:
          ingress:
            class: traefik
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ${LETSENCRYPT_EMAIL}
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: traefik
EOF

log_success "ClusterIssuers created!"

# ============================================================
# STEP 5: Create staging namespace and secrets
# ============================================================
log_info "Creating staging namespace..."
kubectl create namespace maritime-reservations-staging --dry-run=client -o yaml | kubectl apply -f -

# Generate secure keys
SECRET_KEY=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)

log_info "Creating secrets..."
echo ""
log_warn "You will need to provide the following secrets:"
echo "  - Stripe API keys (from https://dashboard.stripe.com)"
echo "  - Google OAuth credentials (from https://console.cloud.google.com)"
echo "  - Gmail App Password (from https://myaccount.google.com/apppasswords)"
echo ""

read -p "STRIPE_SECRET_KEY (sk_test_...): " STRIPE_SECRET_KEY
read -p "STRIPE_PUBLISHABLE_KEY (pk_test_...): " STRIPE_PUBLISHABLE_KEY
read -p "STRIPE_WEBHOOK_SECRET (whsec_...): " STRIPE_WEBHOOK_SECRET
read -p "GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID
read -p "GOOGLE_CLIENT_SECRET: " GOOGLE_CLIENT_SECRET
read -p "SMTP_USERNAME (your email): " SMTP_USERNAME
read -p "SMTP_PASSWORD (app password): " SMTP_PASSWORD
read -p "OPENAI_API_KEY (optional, press Enter to skip): " OPENAI_API_KEY
read -p "SENTRY_DSN (optional, press Enter to skip): " SENTRY_DSN

kubectl create secret generic maritime-secrets \
  --namespace=maritime-reservations-staging \
  --from-literal=DATABASE_URL="postgresql://maritime:${DB_PASSWORD}@staging-postgres-service:5432/maritime_reservations" \
  --from-literal=SECRET_KEY="${SECRET_KEY}" \
  --from-literal=JWT_SECRET_KEY="${JWT_SECRET}" \
  --from-literal=STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY}" \
  --from-literal=STRIPE_PUBLISHABLE_KEY="${STRIPE_PUBLISHABLE_KEY}" \
  --from-literal=STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET}" \
  --from-literal=GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" \
  --from-literal=GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET}" \
  --from-literal=SMTP_USERNAME="${SMTP_USERNAME}" \
  --from-literal=SMTP_PASSWORD="${SMTP_PASSWORD}" \
  --from-literal=FROM_EMAIL="${SMTP_USERNAME}" \
  --from-literal=OPENAI_API_KEY="${OPENAI_API_KEY:-not-configured}" \
  --from-literal=SENTRY_DSN="${SENTRY_DSN:-not-configured}" \
  --dry-run=client -o yaml | kubectl apply -f -

# Create postgres secret
kubectl create secret generic postgres-secret \
  --namespace=maritime-reservations-staging \
  --from-literal=password="${DB_PASSWORD}" \
  --dry-run=client -o yaml | kubectl apply -f -

log_success "Secrets created!"

# Save DB password for reference
echo "${DB_PASSWORD}" > ~/.maritime-db-password
chmod 600 ~/.maritime-db-password
log_warn "Database password saved to ~/.maritime-db-password"

# ============================================================
# STEP 6: Setup GitHub Container Registry access
# ============================================================
log_info "Setting up GitHub Container Registry access..."
echo ""
echo "Create a GitHub Personal Access Token with 'read:packages' scope at:"
echo "https://github.com/settings/tokens/new?scopes=read:packages"
echo ""
read -p "GitHub Username: " GITHUB_USERNAME
read -sp "GitHub Token (PAT): " GITHUB_TOKEN
echo ""

kubectl create secret docker-registry ghcr-secret \
  --namespace=maritime-reservations-staging \
  --docker-server=ghcr.io \
  --docker-username="${GITHUB_USERNAME}" \
  --docker-password="${GITHUB_TOKEN}" \
  --dry-run=client -o yaml | kubectl apply -f -

log_success "Registry secret created!"

# ============================================================
# STEP 7: Install kustomize
# ============================================================
log_info "Installing kustomize..."
curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
sudo mv kustomize /usr/local/bin/

# ============================================================
# STEP 8: Clone repository
# ============================================================
log_info "Cloning repository..."
cd /opt
sudo git clone https://github.com/${GITHUB_USERNAME}/maritime-reservation-website.git || true
sudo chown -R $(id -u):$(id -g) /opt/maritime-reservation-website
cd /opt/maritime-reservation-website

# ============================================================
# STEP 9: Deploy the application
# ============================================================
log_info "Deploying Maritime Platform to staging..."
kubectl apply -k k8s/overlays/staging

# Wait for deployments
log_info "Waiting for deployments to be ready..."
kubectl -n maritime-reservations-staging wait --for=condition=available --timeout=300s deployment --all || true

# ============================================================
# STEP 10: Show status
# ============================================================
echo ""
log_success "=========================================="
log_success "  VPS STAGING SETUP COMPLETE!"
log_success "=========================================="
echo ""
echo "Deployed resources:"
kubectl -n maritime-reservations-staging get all
echo ""
echo "Next steps:"
echo "  1. Point your DNS records to this server's IP: $(curl -s ifconfig.me)"
echo "     - staging.voilaferry.com -> $(curl -s ifconfig.me)"
echo "     - api-staging.voilaferry.com -> $(curl -s ifconfig.me)"
echo "     - chatbot-staging.voilaferry.com -> $(curl -s ifconfig.me)"
echo ""
echo "  2. Wait for DNS propagation (5-30 minutes)"
echo ""
echo "  3. Verify SSL certificates:"
echo "     kubectl -n maritime-reservations-staging get certificate"
echo ""
echo "  4. Check application logs:"
echo "     kubectl -n maritime-reservations-staging logs -f deployment/staging-backend"
echo ""
echo "  5. Configure GitHub Actions secrets for CI/CD"
echo ""
log_info "Server IP: $(curl -s ifconfig.me)"
