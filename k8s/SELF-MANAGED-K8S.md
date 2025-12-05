# Self-Managed Kubernetes Setup Guide

This guide covers deploying the Maritime Reservation Platform on self-managed Kubernetes clusters using **k3s**, **kubeadm**, or **microk8s**.

## Table of Contents
1. [Option 1: k3s (Recommended for VPS/Single Server)](#option-1-k3s)
2. [Option 2: kubeadm (Production Multi-Node)](#option-2-kubeadm)
3. [Option 3: microk8s (Ubuntu/Development)](#option-3-microk8s)
4. [Post-Installation Setup](#post-installation-setup)
5. [Deploy Maritime Platform](#deploy-maritime-platform)
6. [PostgreSQL Setup](#postgresql-setup)
7. [SSL/TLS with Let's Encrypt](#ssltls-with-lets-encrypt)
8. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Option 1: k3s

**Best for**: Single server, VPS, edge deployments, resource-constrained environments.

### Requirements
- Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- Minimum 2 CPU, 4GB RAM (8GB recommended)
- 20GB disk space
- Open ports: 6443, 80, 443

### Installation (Single Node)

```bash
# Install k3s
curl -sfL https://get.k3s.io | sh -

# Wait for k3s to start
sudo systemctl status k3s

# Copy kubeconfig for kubectl access
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config
chmod 600 ~/.kube/config

# Verify installation
kubectl get nodes
kubectl get pods -A
```

### Multi-Node k3s Cluster

```bash
# On MASTER node - get token
sudo cat /var/lib/rancher/k3s/server/node-token

# On WORKER nodes - join cluster
curl -sfL https://get.k3s.io | K3S_URL=https://<MASTER_IP>:6443 K3S_TOKEN=<NODE_TOKEN> sh -
```

### k3s with External Database (Production)

```bash
# Use external PostgreSQL for HA
curl -sfL https://get.k3s.io | sh -s - server \
  --datastore-endpoint="postgres://user:pass@postgres-host:5432/k3s"
```

---

## Option 2: kubeadm

**Best for**: Multi-node production clusters with full control.

### Requirements
- 3+ nodes (1 master, 2+ workers)
- Ubuntu 20.04+ / CentOS 8+
- Minimum 2 CPU, 4GB RAM per node
- Static IPs for all nodes
- Open ports: 6443, 2379-2380, 10250-10252

### Prerequisites (All Nodes)

```bash
# Disable swap
sudo swapoff -a
sudo sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab

# Load kernel modules
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

# Sysctl params
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

sudo sysctl --system

# Install containerd
sudo apt-get update
sudo apt-get install -y containerd
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/g' /etc/containerd/config.toml
sudo systemctl restart containerd

# Install kubeadm, kubelet, kubectl
sudo apt-get install -y apt-transport-https ca-certificates curl
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.29/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.29/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list

sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl
```

### Initialize Master Node

```bash
# Initialize cluster
sudo kubeadm init --pod-network-cidr=10.244.0.0/16

# Setup kubectl
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# Install Flannel CNI
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml

# Get join command for workers
kubeadm token create --print-join-command
```

### Join Worker Nodes

```bash
# Run on each worker (command from master)
sudo kubeadm join <MASTER_IP>:6443 --token <TOKEN> \
  --discovery-token-ca-cert-hash sha256:<HASH>
```

---

## Option 3: microk8s

**Best for**: Ubuntu environments, development, quick setup.

### Installation

```bash
# Install microk8s
sudo snap install microk8s --classic --channel=1.29

# Add user to microk8s group
sudo usermod -a -G microk8s $USER
sudo chown -R $USER ~/.kube
newgrp microk8s

# Enable required addons
microk8s enable dns storage ingress cert-manager

# Alias kubectl
alias kubectl='microk8s kubectl'
echo "alias kubectl='microk8s kubectl'" >> ~/.bashrc

# Check status
microk8s status
```

### Multi-Node microk8s

```bash
# On master - get join token
microk8s add-node

# On worker - join (use command from master output)
microk8s join <MASTER_IP>:25000/<TOKEN>
```

---

## Post-Installation Setup

### 1. Install NGINX Ingress Controller

```bash
# For k3s (Traefik is default, but you can use nginx)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/cloud/deploy.yaml

# For kubeadm
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/baremetal/deploy.yaml

# For microk8s - already enabled with 'microk8s enable ingress'
```

### 2. Install cert-manager

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager
```

### 3. Create Let's Encrypt ClusterIssuer

```bash
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com  # Change this!
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: your-email@example.com  # Change this!
    privateKeySecretRef:
      name: letsencrypt-staging
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
```

### 4. Install Metrics Server (for HPA)

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# For self-signed certs (common in self-managed), patch metrics-server
kubectl patch deployment metrics-server -n kube-system --type='json' -p='[
  {"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}
]'
```

---

## Deploy Maritime Platform

### 1. Create Secrets (IMPORTANT - Do this first!)

```bash
# Generate secure keys
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))")
JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))")

# Create secrets from command line (recommended - not stored in git)
kubectl create namespace maritime-reservations

kubectl create secret generic maritime-secrets \
  --namespace=maritime-reservations \
  --from-literal=DATABASE_URL="postgresql://maritime:YOUR_DB_PASS@postgres-service:5432/maritime_db" \
  --from-literal=SECRET_KEY="$SECRET_KEY" \
  --from-literal=JWT_SECRET_KEY="$JWT_SECRET" \
  --from-literal=STRIPE_SECRET_KEY="sk_test_YOUR_KEY" \
  --from-literal=STRIPE_PUBLISHABLE_KEY="pk_test_YOUR_KEY" \
  --from-literal=STRIPE_WEBHOOK_SECRET="whsec_YOUR_SECRET" \
  --from-literal=SMTP_USERNAME="your-email@gmail.com" \
  --from-literal=SMTP_PASSWORD="your-app-password" \
  --from-literal=FROM_EMAIL="your-email@gmail.com" \
  --from-literal=GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID" \
  --from-literal=GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_SECRET" \
  --from-literal=OPENAI_API_KEY="sk-proj-YOUR_KEY" \
  --from-literal=SENTRY_DSN="https://YOUR_DSN@sentry.io/PROJECT"
```

### 2. Build and Push Docker Images

```bash
# Option A: Use a container registry (Docker Hub, GitHub Container Registry, etc.)
docker build -t yourusername/maritime-backend:latest ./backend
docker build -t yourusername/maritime-frontend:latest ./frontend
docker push yourusername/maritime-backend:latest
docker push yourusername/maritime-frontend:latest

# Option B: For single-node k3s, import directly
docker save maritime-backend:latest | sudo k3s ctr images import -
docker save maritime-frontend:latest | sudo k3s ctr images import -

# Option C: For microk8s
docker save maritime-backend:latest > backend.tar
microk8s ctr image import backend.tar
```

### 3. Update Image References

Edit `k8s/base/backend-deployment.yaml` and `k8s/base/frontend-deployment.yaml`:

```yaml
# Change from:
image: maritime-reservations/backend:latest

# To your registry:
image: yourusername/maritime-backend:latest
# Or for local images:
image: maritime-backend:latest
imagePullPolicy: Never  # For local images
```

### 4. Deploy Application

```bash
# Deploy to production
kubectl apply -k k8s/overlays/production

# Or deploy to staging
kubectl apply -k k8s/overlays/staging

# Watch deployment progress
kubectl -n maritime-reservations get pods -w

# Check all resources
kubectl -n maritime-reservations get all
```

### 5. Update DNS

Point your domain to the server's public IP:

```
A    maritime-reservations.com      -> YOUR_SERVER_IP
A    www.maritime-reservations.com  -> YOUR_SERVER_IP
A    api.maritime-reservations.com  -> YOUR_SERVER_IP
```

---

## PostgreSQL Setup

### Option A: PostgreSQL in Kubernetes (Simple)

```bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: maritime-reservations
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: maritime-reservations
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:15
          env:
            - name: POSTGRES_DB
              value: maritime_db
            - name: POSTGRES_USER
              value: maritime
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password
          ports:
            - containerPort: 5432
          volumeMounts:
            - name: postgres-storage
              mountPath: /var/lib/postgresql/data
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
      volumes:
        - name: postgres-storage
          persistentVolumeClaim:
            claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: maritime-reservations
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
---
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
  namespace: maritime-reservations
type: Opaque
stringData:
  password: "YOUR_SECURE_DB_PASSWORD"
EOF
```

### Option B: External PostgreSQL (Production Recommended)

Use a managed PostgreSQL service or run PostgreSQL outside Kubernetes:

```bash
# Install PostgreSQL on a separate server
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE maritime_db;
CREATE USER maritime WITH ENCRYPTED PASSWORD 'YOUR_SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE maritime_db TO maritime;

# Update DATABASE_URL in secrets
kubectl -n maritime-reservations delete secret maritime-secrets
kubectl create secret generic maritime-secrets ... \
  --from-literal=DATABASE_URL="postgresql://maritime:PASSWORD@POSTGRES_HOST:5432/maritime_db"
```

---

## SSL/TLS with Let's Encrypt

TLS is automatically provisioned via cert-manager. Verify:

```bash
# Check certificate status
kubectl -n maritime-reservations get certificate

# Check certificate details
kubectl -n maritime-reservations describe certificate maritime-tls-secret

# Troubleshoot if pending
kubectl -n maritime-reservations get certificaterequest
kubectl -n maritime-reservations describe certificaterequest <name>

# Check cert-manager logs
kubectl -n cert-manager logs deployment/cert-manager
```

---

## Monitoring & Maintenance

### Health Checks

```bash
# Check pod health
kubectl -n maritime-reservations get pods

# Check backend health endpoint
kubectl -n maritime-reservations exec -it deployment/backend -- curl localhost:8010/health/detailed

# View logs
kubectl -n maritime-reservations logs -f deployment/backend
kubectl -n maritime-reservations logs -f deployment/celery-worker
```

### Scaling

```bash
# Manual scaling
kubectl -n maritime-reservations scale deployment backend --replicas=5

# Check HPA status
kubectl -n maritime-reservations get hpa

# Describe HPA for details
kubectl -n maritime-reservations describe hpa backend-hpa
```

### Updates & Rollbacks

```bash
# Update image
kubectl -n maritime-reservations set image deployment/backend backend=yourusername/maritime-backend:v2.0.0

# Watch rollout
kubectl -n maritime-reservations rollout status deployment/backend

# Rollback if needed
kubectl -n maritime-reservations rollout undo deployment/backend
```

### Database Backups

```bash
# Create backup
kubectl -n maritime-reservations exec deployment/postgres -- \
  pg_dump -U maritime maritime_db > backup_$(date +%Y%m%d).sql

# Restore backup
kubectl -n maritime-reservations exec -i deployment/postgres -- \
  psql -U maritime maritime_db < backup_20240101.sql
```

### Resource Monitoring

```bash
# Install k9s (terminal UI)
curl -sS https://webinstall.dev/k9s | bash

# Or use kubectl top
kubectl top nodes
kubectl top pods -n maritime-reservations
```

---

## Troubleshooting

### Pod Not Starting

```bash
kubectl -n maritime-reservations describe pod <pod-name>
kubectl -n maritime-reservations logs <pod-name> --previous
```

### Database Connection Issues

```bash
# Test connection from backend pod
kubectl -n maritime-reservations exec -it deployment/backend -- \
  python -c "from app.database import engine; engine.connect(); print('OK')"
```

### Ingress Not Working

```bash
# Check ingress
kubectl -n maritime-reservations describe ingress

# Check nginx-ingress logs
kubectl -n ingress-nginx logs deployment/ingress-nginx-controller

# Verify service endpoints
kubectl -n maritime-reservations get endpoints
```

### Certificate Issues

```bash
# Force certificate renewal
kubectl -n maritime-reservations delete certificate maritime-tls-secret
kubectl -n maritime-reservations delete secret maritime-tls-secret
# Ingress will trigger new certificate request
```

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Use strong SECRET_KEY and JWT_SECRET_KEY
- [ ] Enable network policies
- [ ] Restrict pod security (already configured)
- [ ] Regular security updates (`apt update && apt upgrade`)
- [ ] Enable firewall (only allow 80, 443, 6443)
- [ ] Set up log aggregation
- [ ] Configure backup automation
- [ ] Enable Sentry for error tracking
