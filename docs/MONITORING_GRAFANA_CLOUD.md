# VoilaFerry Monitoring with Grafana Cloud

## Overview

This document describes setting up monitoring for staging/production using **Grafana Cloud Free Tier** instead of self-hosted Grafana/Prometheus.

### Current State (Localhost)
- Self-hosted Prometheus + Grafana via docker-compose.monitoring.yml
- PostgreSQL Exporter + Redis Exporter running

### Target State (Staging/Production)
- **Metrics**: Prometheus → Grafana Cloud (via remote_write)
- **Logs**: FluentBit → Loki (Grafana Cloud)
- **Dashboards**: Grafana Cloud (free tier: 10k metrics, 50GB logs)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         K3s Cluster                              │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Backend    │  │   Postgres   │  │    Redis     │           │
│  │   /metrics   │  │              │  │              │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                  │                  │                  │
│         ▼                  ▼                  ▼                  │
│  ┌────────────────────────────────────────────────────┐         │
│  │              Prometheus (in-cluster)                │         │
│  │  - Scrapes all exporters                           │         │
│  │  - remote_write to Grafana Cloud                   │         │
│  └────────────────────────┬───────────────────────────┘         │
│                           │                                      │
│  ┌──────────────┐  ┌──────┴───────┐                             │
│  │  Postgres    │  │    Redis     │                             │
│  │  Exporter    │  │   Exporter   │                             │
│  │  :9187       │  │   :9121      │                             │
│  └──────────────┘  └──────────────┘                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────┐         │
│  │              FluentBit (DaemonSet)                  │         │
│  │  - Collects container logs                         │         │
│  │  - Ships to Grafana Cloud Loki                     │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Grafana Cloud      │
                    │   (Free Tier)        │
                    │  - Prometheus        │
                    │  - Loki              │
                    │  - Dashboards        │
                    │  - Alerting          │
                    └──────────────────────┘
```

---

## Grafana Cloud Free Tier Limits

| Resource | Free Tier Limit |
|----------|-----------------|
| Metrics | 10,000 series |
| Logs | 50 GB/month |
| Traces | 50 GB/month |
| Users | 3 |
| Retention | 14 days |
| Alerts | 100 alert rules |

**This is sufficient for staging and small production workloads.**

---

## Implementation Steps

### Step 1: Create Grafana Cloud Account

1. Go to https://grafana.com/products/cloud/
2. Sign up for free account
3. Create a new stack (e.g., "voilaferry-staging")
4. Note down:
   - **Prometheus Remote Write URL**: `https://prometheus-prod-XX-prod-XX.grafana.net/api/prom/push`
   - **Loki Push URL**: `https://logs-prod-XX.grafana.net/loki/api/v1/push`
   - **Username**: Your Grafana Cloud instance ID
   - **API Key**: Generate from Security → API Keys

### Step 2: Create Kubernetes Secrets

```bash
# Create namespace if not exists
kubectl create namespace monitoring

# Create secret for Grafana Cloud credentials
kubectl create secret generic grafana-cloud-credentials \
  --namespace=monitoring \
  --from-literal=prometheus-username=<YOUR_INSTANCE_ID> \
  --from-literal=prometheus-password=<YOUR_API_KEY> \
  --from-literal=loki-username=<YOUR_INSTANCE_ID> \
  --from-literal=loki-password=<YOUR_API_KEY>
```

### Step 3: Update Prometheus with Remote Write

Update prometheus-config.yaml to add remote_write:

```yaml
global:
  scrape_interval: 30s  # Increased to reduce metrics volume
  evaluation_interval: 30s

remote_write:
  - url: https://prometheus-prod-XX-prod-XX.grafana.net/api/prom/push
    basic_auth:
      username: <INSTANCE_ID>
      password_file: /etc/prometheus/secrets/api-key
    write_relabel_configs:
      # Drop high-cardinality metrics to stay within limits
      - source_labels: [__name__]
        regex: 'go_.*'
        action: drop
```

### Step 4: Deploy FluentBit for Logs

FluentBit will collect container logs and send to Grafana Cloud Loki.

### Step 5: Import Dashboards

Grafana Cloud has pre-built dashboards:
- PostgreSQL Dashboard (ID: 9628)
- Redis Dashboard (ID: 11835)
- Kubernetes Dashboard (ID: 15520)

---

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `k8s/base/monitoring/grafana-cloud-secret.yaml` | Credentials secret template |
| `k8s/base/monitoring/prometheus-config.yaml` | Add remote_write |
| `k8s/base/monitoring/fluentbit-daemonset.yaml` | Log collector |
| `k8s/base/monitoring/fluentbit-config.yaml` | FluentBit config |
| `k8s/overlays/staging/monitoring-patch.yaml` | Staging-specific URLs |

---

## Cost Optimization Tips

1. **Increase scrape_interval** to 30s or 60s (less metrics)
2. **Drop unnecessary metrics** via relabel_configs
3. **Filter logs** - only send ERROR/WARN levels
4. **Use metric aggregation** where possible

---

## Rollout Plan

| Phase | Task | Effort |
|-------|------|--------|
| 1 | Create Grafana Cloud account | 10 min |
| 2 | Create K8s secrets | 5 min |
| 3 | Update Prometheus config | 15 min |
| 4 | Deploy FluentBit | 20 min |
| 5 | Import dashboards | 10 min |
| 6 | Set up alerts | 15 min |
| **Total** | | ~1.5 hours |

---

## Files Created

| File | Description |
|------|-------------|
| `grafana-cloud-secret.yaml` | Placeholder secret (for deployments without Grafana Cloud) |
| `grafana-cloud-secret.yaml.template` | Template with instructions for your credentials |
| `fluentbit-config.yaml` | FluentBit configuration for log collection |
| `fluentbit-daemonset.yaml` | FluentBit DaemonSet deployment |
| `prometheus-config.yaml` | Updated with remote_write to Grafana Cloud |
| `prometheus-deployment.yaml` | Updated with init container for credential injection |

---

## Quick Start

### 1. Create Grafana Cloud Account (5 min)
```bash
# Go to https://grafana.com/products/cloud/
# Sign up for free -> Create stack "voilaferry"
```

### 2. Get Credentials (5 min)
From Grafana Cloud:
- Go to **Connections** → **Add new connection** → **Hosted Prometheus metrics**
- Note: Host, Username (Instance ID), and create an API Key
- Repeat for **Hosted logs** (Loki)

### 3. Apply Secret (2 min)
```bash
# Copy template
cp k8s/base/monitoring/grafana-cloud-secret.yaml.template \
   k8s/base/monitoring/grafana-cloud-secret.yaml

# Edit with your credentials
vim k8s/base/monitoring/grafana-cloud-secret.yaml

# Apply to cluster
kubectl apply -f k8s/base/monitoring/grafana-cloud-secret.yaml
```

### 4. Deploy Monitoring Stack (5 min)
```bash
kubectl apply -k k8s/base/monitoring/
```

### 5. Import Dashboards in Grafana Cloud (5 min)
- PostgreSQL: Dashboard ID `9628`
- Redis: Dashboard ID `11835`
- Kubernetes: Dashboard ID `15520`

---

## Verification

```bash
# Check Prometheus is sending metrics
kubectl logs -n monitoring deployment/prometheus | grep remote_write

# Check FluentBit is running
kubectl get pods -n monitoring -l app=fluentbit

# Check FluentBit logs
kubectl logs -n monitoring -l app=fluentbit --tail=50
```

---

## Next Steps

- [ ] Create Grafana Cloud account
- [ ] Get Prometheus remote_write URL
- [ ] Get Loki push URL
- [ ] Create API key
- [ ] Update grafana-cloud-secret.yaml with credentials
- [ ] Deploy to staging cluster
- [ ] Verify metrics in Grafana Cloud
- [ ] Verify logs in Grafana Cloud
- [ ] Import dashboards
- [ ] Configure alerts
