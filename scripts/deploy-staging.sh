#!/bin/bash
# =============================================================================
# Staging Deployment Script
# =============================================================================
# Usage: ./scripts/deploy-staging.sh [--build] [--k8s|--docker]
#
# Options:
#   --build    Build Docker images before deploying
#   --k8s      Deploy to Kubernetes (default)
#   --docker   Deploy with Docker Compose
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="${DOCKER_REGISTRY:-ghcr.io/ayoubbenmbarek}"  # Change to your registry
IMAGE_TAG="${IMAGE_TAG:-staging}"
NAMESPACE="maritime-reservations-staging"

# Parse arguments
BUILD=false
DEPLOY_METHOD="k8s"

while [[ $# -gt 0 ]]; do
    case $1 in
        --build)
            BUILD=true
            shift
            ;;
        --k8s)
            DEPLOY_METHOD="k8s"
            shift
            ;;
        --docker)
            DEPLOY_METHOD="docker"
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Maritime Reservations - Staging Deploy${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Build images if requested
if [ "$BUILD" = true ]; then
    echo -e "${YELLOW}Building Docker images...${NC}"

    # Build backend
    echo -e "${YELLOW}Building backend...${NC}"
    docker build -t ${REGISTRY}/maritime-backend:${IMAGE_TAG} \
        --target production \
        -f backend/Dockerfile \
        ./backend

    # Build frontend
    echo -e "${YELLOW}Building frontend...${NC}"
    docker build -t ${REGISTRY}/maritime-frontend:${IMAGE_TAG} \
        --build-arg REACT_APP_API_URL=https://api-staging.voilaferry.com \
        --build-arg REACT_APP_ENVIRONMENT=staging \
        -f frontend/Dockerfile \
        ./frontend

    # Push images
    echo -e "${YELLOW}Pushing images to registry...${NC}"
    docker push ${REGISTRY}/maritime-backend:${IMAGE_TAG}
    docker push ${REGISTRY}/maritime-frontend:${IMAGE_TAG}

    echo -e "${GREEN}Images built and pushed successfully!${NC}"
fi

# Deploy based on method
if [ "$DEPLOY_METHOD" = "k8s" ]; then
    echo -e "${YELLOW}Deploying to Kubernetes...${NC}"

    # Check kubectl is available
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}kubectl not found. Please install kubectl.${NC}"
        exit 1
    fi

    # Check if namespace exists
    if ! kubectl get namespace ${NAMESPACE} &> /dev/null; then
        echo -e "${YELLOW}Creating namespace ${NAMESPACE}...${NC}"
        kubectl create namespace ${NAMESPACE}
    fi

    # Check if secrets exist
    if ! kubectl get secret maritime-secrets -n ${NAMESPACE} &> /dev/null; then
        echo -e "${RED}Secrets not found!${NC}"
        echo -e "${YELLOW}Please create secrets first:${NC}"
        echo ""
        echo "kubectl create secret generic maritime-secrets -n ${NAMESPACE} \\"
        echo "  --from-literal=DATABASE_URL='postgresql://...' \\"
        echo "  --from-literal=SECRET_KEY='...' \\"
        echo "  # ... (see k8s/SELF-MANAGED-K8S.md for full list)"
        exit 1
    fi

    # Apply Kustomize configuration
    echo -e "${YELLOW}Applying Kubernetes manifests...${NC}"
    kubectl apply -k k8s/overlays/staging

    # Wait for deployments
    echo -e "${YELLOW}Waiting for deployments to be ready...${NC}"
    kubectl -n ${NAMESPACE} rollout status deployment/backend-staging --timeout=300s
    kubectl -n ${NAMESPACE} rollout status deployment/frontend-staging --timeout=300s
    kubectl -n ${NAMESPACE} rollout status deployment/celery-worker-staging --timeout=300s

    # Show status
    echo ""
    echo -e "${GREEN}Deployment complete!${NC}"
    echo ""
    kubectl -n ${NAMESPACE} get pods
    echo ""
    kubectl -n ${NAMESPACE} get ingress

elif [ "$DEPLOY_METHOD" = "docker" ]; then
    echo -e "${YELLOW}Deploying with Docker Compose...${NC}"

    # Check docker-compose is available
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}docker-compose not found.${NC}"
        exit 1
    fi

    # Check staging env file exists
    if [ ! -f "backend/.env.staging" ]; then
        echo -e "${RED}.env.staging not found!${NC}"
        echo -e "${YELLOW}Please create backend/.env.staging from backend/.env.staging.example${NC}"
        exit 1
    fi

    # Deploy with docker-compose
    docker-compose -f docker-compose.staging.yml up -d

    # Show status
    echo ""
    echo -e "${GREEN}Deployment complete!${NC}"
    echo ""
    docker-compose -f docker-compose.staging.yml ps
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Staging deployment finished!${NC}"
echo -e "${GREEN}========================================${NC}"
