# Kubernetes Deployment Guide

This directory contains Kubernetes manifests for deploying the Maritime Reservation Platform.

## Directory Structure

```
k8s/
├── base/                    # Base configuration (common to all environments)
│   ├── namespace.yaml       # Namespace definition
│   ├── configmap.yaml       # Non-sensitive configuration
│   ├── secrets.yaml         # Sensitive configuration (template)
│   ├── service-account.yaml # Service account for pods
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   ├── celery-worker-deployment.yaml
│   ├── celery-beat-deployment.yaml
│   ├── redis-deployment.yaml
│   ├── ingress.yaml         # Ingress with TLS
│   ├── hpa.yaml             # Horizontal Pod Autoscaler
│   ├── pdb.yaml             # Pod Disruption Budget
│   └── kustomization.yaml
├── overlays/
│   ├── staging/             # Staging environment overrides
│   │   └── kustomization.yaml
│   └── production/          # Production environment overrides
│       └── kustomization.yaml
└── README.md
```

## Prerequisites

1. **Kubernetes Cluster** (v1.25+)
   - GKE, EKS, AKS, or self-managed

2. **kubectl** configured with cluster access

3. **NGINX Ingress Controller**
   ```bash
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
   ```

4. **cert-manager** (for automatic TLS certificates)
   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.2/cert-manager.yaml
   ```

5. **ClusterIssuer for Let's Encrypt**
   ```yaml
   apiVersion: cert-manager.io/v1
   kind: ClusterIssuer
   metadata:
     name: letsencrypt-prod
   spec:
     acme:
       server: https://acme-v02.api.letsencrypt.org/directory
       email: your-email@example.com
       privateKeySecretRef:
         name: letsencrypt-prod
       solvers:
         - http01:
             ingress:
               class: nginx
   ```

## Deployment

### Build and Push Docker Images

```bash
# Backend
docker build -t maritime-reservations/backend:latest ./backend
docker push maritime-reservations/backend:latest

# Frontend
docker build -t maritime-reservations/frontend:latest ./frontend
docker push maritime-reservations/frontend:latest
```

### Update Secrets

Before deploying, update `k8s/base/secrets.yaml` with actual values:

```bash
# Generate a secure secret key
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Or use sealed-secrets for production
kubeseal --format yaml < secrets.yaml > sealed-secrets.yaml
```

### Deploy to Staging

```bash
# Preview what will be deployed
kubectl kustomize k8s/overlays/staging

# Apply staging configuration
kubectl apply -k k8s/overlays/staging

# Check deployment status
kubectl -n maritime-reservations-staging get pods
kubectl -n maritime-reservations-staging get ingress
```

### Deploy to Production

```bash
# Preview what will be deployed
kubectl kustomize k8s/overlays/production

# Apply production configuration
kubectl apply -k k8s/overlays/production

# Check deployment status
kubectl -n maritime-reservations get pods
kubectl -n maritime-reservations get ingress
```

## Monitoring

### Check Pod Status
```bash
kubectl -n maritime-reservations get pods -w
```

### View Logs
```bash
# Backend logs
kubectl -n maritime-reservations logs -f deployment/backend

# Celery worker logs
kubectl -n maritime-reservations logs -f deployment/celery-worker
```

### Health Checks
```bash
# Check backend health
kubectl -n maritime-reservations exec -it deployment/backend -- curl localhost:8010/health/detailed
```

### Horizontal Pod Autoscaler Status
```bash
kubectl -n maritime-reservations get hpa
```

## Scaling

### Manual Scaling
```bash
kubectl -n maritime-reservations scale deployment backend --replicas=5
```

### Autoscaling Configuration
HPA is configured to scale based on:
- CPU utilization (target: 70%)
- Memory utilization (target: 80%)

## Troubleshooting

### Pod Not Starting
```bash
kubectl -n maritime-reservations describe pod <pod-name>
kubectl -n maritime-reservations logs <pod-name> --previous
```

### Database Connection Issues
```bash
# Check if secrets are mounted
kubectl -n maritime-reservations exec -it deployment/backend -- env | grep DATABASE
```

### Ingress Not Working
```bash
kubectl -n maritime-reservations describe ingress maritime-ingress
kubectl get events -n maritime-reservations
```

## Rollback

```bash
# View deployment history
kubectl -n maritime-reservations rollout history deployment/backend

# Rollback to previous version
kubectl -n maritime-reservations rollout undo deployment/backend

# Rollback to specific revision
kubectl -n maritime-reservations rollout undo deployment/backend --to-revision=2
```

## Security Best Practices

1. **Secrets Management**: Use Sealed Secrets or External Secrets Operator in production
2. **Network Policies**: Consider adding NetworkPolicy resources to restrict pod-to-pod traffic
3. **Pod Security**: All pods run as non-root with read-only filesystems
4. **Resource Limits**: All containers have resource requests and limits defined
5. **RBAC**: Service account has minimal permissions

## Database (PostgreSQL)

For production, use a managed PostgreSQL service:
- **AWS**: Amazon RDS
- **GCP**: Cloud SQL
- **Azure**: Azure Database for PostgreSQL

Update `DATABASE_URL` in secrets with the managed database connection string.

## Redis

For production with high availability, consider:
- **AWS**: Amazon ElastiCache
- **GCP**: Memorystore
- **Azure**: Azure Cache for Redis

Or deploy Redis with the [Bitnami Helm chart](https://github.com/bitnami/charts/tree/main/bitnami/redis) for HA setup.
