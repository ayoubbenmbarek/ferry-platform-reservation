#!/bin/bash

# Maritime Reservation Platform - k3s Deployment Script
# Usage: ./scripts/deploy-k3s.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}
NAMESPACE="maritime-reservations"

if [ "$ENVIRONMENT" == "staging" ]; then
    NAMESPACE="maritime-reservations-staging"
fi

echo "=============================================="
echo "Maritime Reservation Platform - k3s Deployment"
echo "Environment: $ENVIRONMENT"
echo "Namespace: $NAMESPACE"
echo "=============================================="

# Check if k3s is installed
if ! command -v kubectl &> /dev/null; then
    echo "kubectl not found. Installing k3s..."
    curl -sfL https://get.k3s.io | sh -

    # Setup kubeconfig
    mkdir -p ~/.kube
    sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
    sudo chown $(id -u):$(id -g) ~/.kube/config
    chmod 600 ~/.kube/config

    echo "k3s installed successfully!"
fi

# Verify cluster is running
echo ""
echo "Checking cluster status..."
kubectl get nodes

# Install cert-manager if not present
if ! kubectl get namespace cert-manager &> /dev/null; then
    echo ""
    echo "Installing cert-manager..."
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml

    echo "Waiting for cert-manager to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
    kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager
fi

# Create namespace if not exists
if ! kubectl get namespace $NAMESPACE &> /dev/null; then
    echo ""
    echo "Creating namespace $NAMESPACE..."
    kubectl create namespace $NAMESPACE
fi

# Check if secrets exist
if ! kubectl -n $NAMESPACE get secret maritime-secrets &> /dev/null; then
    echo ""
    echo "=============================================="
    echo "WARNING: Secrets not configured!"
    echo "=============================================="
    echo ""
    echo "Please create secrets before deploying:"
    echo ""
    echo "kubectl create secret generic maritime-secrets \\"
    echo "  --namespace=$NAMESPACE \\"
    echo "  --from-literal=DATABASE_URL=\"postgresql://...\" \\"
    echo "  --from-literal=SECRET_KEY=\"\$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')\" \\"
    echo "  --from-literal=JWT_SECRET_KEY=\"\$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')\" \\"
    echo "  --from-literal=STRIPE_SECRET_KEY=\"sk_test_...\" \\"
    echo "  --from-literal=STRIPE_PUBLISHABLE_KEY=\"pk_test_...\" \\"
    echo "  --from-literal=STRIPE_WEBHOOK_SECRET=\"whsec_...\" \\"
    echo "  --from-literal=SMTP_USERNAME=\"...\" \\"
    echo "  --from-literal=SMTP_PASSWORD=\"...\" \\"
    echo "  --from-literal=FROM_EMAIL=\"...\" \\"
    echo "  --from-literal=GOOGLE_CLIENT_ID=\"...\" \\"
    echo "  --from-literal=GOOGLE_CLIENT_SECRET=\"...\" \\"
    echo "  --from-literal=OPENAI_API_KEY=\"sk-proj-...\" \\"
    echo "  --from-literal=SENTRY_DSN=\"https://...@sentry.io/...\""
    echo ""
    read -p "Have you created the secrets? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborting deployment. Please create secrets first."
        exit 1
    fi
fi

# Build and import images (for local deployment without registry)
echo ""
read -p "Build and import Docker images locally? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Building Docker images..."

    # Backend
    echo "Building backend image..."
    docker build -t maritime-backend:latest ./backend
    docker save maritime-backend:latest | sudo k3s ctr images import -

    # Frontend
    echo "Building frontend image..."
    docker build -t maritime-frontend:latest ./frontend
    docker save maritime-frontend:latest | sudo k3s ctr images import -

    echo "Images imported successfully!"
fi

# Deploy application
echo ""
echo "Deploying application to $ENVIRONMENT..."
kubectl apply -k k8s/overlays/$ENVIRONMENT

# Wait for deployments
echo ""
echo "Waiting for deployments to be ready..."
kubectl -n $NAMESPACE rollout status deployment/backend --timeout=300s || true
kubectl -n $NAMESPACE rollout status deployment/frontend --timeout=300s || true
kubectl -n $NAMESPACE rollout status deployment/celery-worker --timeout=300s || true

# Show status
echo ""
echo "=============================================="
echo "Deployment Status"
echo "=============================================="
kubectl -n $NAMESPACE get pods
echo ""
kubectl -n $NAMESPACE get services
echo ""
kubectl -n $NAMESPACE get ingress

echo ""
echo "=============================================="
echo "Deployment Complete!"
echo "=============================================="
echo ""
echo "Next steps:"
echo "1. Configure DNS to point to this server's IP"
echo "2. Check certificate status: kubectl -n $NAMESPACE get certificate"
echo "3. View logs: kubectl -n $NAMESPACE logs -f deployment/backend"
echo "4. Health check: kubectl -n $NAMESPACE exec deployment/backend -- curl localhost:8010/health/detailed"
