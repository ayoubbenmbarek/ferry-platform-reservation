# Kubernetes Monitoring Stack for Maritime Platform

## Overview

This directory contains Kubernetes manifests for deploying a complete monitoring stack:
- **Prometheus** - Metrics collection and alerting
- **Grafana** - Visualization and dashboards
- **PostgreSQL Exporter** - Database metrics
- **Redis Exporter** - Cache metrics

## Deployment

### Prerequisites
- k3s cluster running
- `kubectl` configured to access your cluster
- Kustomize (included in kubectl v1.14+)

### Deploy Monitoring Stack

```bash
# Apply the monitoring namespace and all resources
kubectl apply -k k8s/base/monitoring/

# Verify deployment
kubectl get pods -n monitoring
kubectl get svc -n monitoring
```

### Quick Access (Development/Testing)

```bash
# Port forward Grafana
kubectl port-forward -n monitoring svc/grafana 3050:3000

# Port forward Prometheus
kubectl port-forward -n monitoring svc/prometheus 9090:9090
```

Then access:
- Grafana: http://localhost:3050 (admin / maritime_admin_2024)
- Prometheus: http://localhost:9090

### Production Access

Update `ingress.yaml` with your domain names, then access via:
- https://grafana.maritime.yourdomain.com
- https://prometheus.maritime.yourdomain.com

## Configuration

### Update Database Connection

Edit `exporters.yaml` and update the PostgreSQL connection string:
```yaml
datasource: "postgresql://user:password@postgres.maritime:5432/maritime_reservations?sslmode=disable"
```

### Update Redis Connection

If your Redis has a password, update `exporters.yaml`:
```yaml
password: "your-redis-password"
```

### Add Custom Dashboards

1. Add JSON dashboard files to `dashboards/`
2. Update `kustomization.yaml` to include them
3. Re-apply: `kubectl apply -k k8s/base/monitoring/`

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     k3s Cluster                              │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Backend    │    │  PostgreSQL  │    │    Redis     │   │
│  │   (metrics)  │    │              │    │              │   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘   │
│         │                    │                   │           │
│         │           ┌────────┴────────┐  ┌──────┴───────┐   │
│         │           │ postgres-exporter│  │redis-exporter│   │
│         │           └────────┬────────┘  └──────┬───────┘   │
│         │                    │                   │           │
│         └────────────────────┼───────────────────┘           │
│                              │                               │
│                     ┌────────┴────────┐                      │
│                     │   Prometheus    │                      │
│                     │   (scraping)    │                      │
│                     └────────┬────────┘                      │
│                              │                               │
│                     ┌────────┴────────┐                      │
│                     │    Grafana      │                      │
│                     │  (dashboards)   │                      │
│                     └─────────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Included Dashboards

1. **Maritime Backend** - API requests, latency, errors, business metrics
2. **PostgreSQL** - Connections, transactions, locks, cache hit ratio
3. **Redis** - Memory, commands, clients, cache hit rate

## Troubleshooting

```bash
# Check pod logs
kubectl logs -n monitoring -l app=prometheus
kubectl logs -n monitoring -l app=grafana
kubectl logs -n monitoring -l app=postgres-exporter

# Check if Prometheus is scraping targets
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# Then visit http://localhost:9090/targets
```
