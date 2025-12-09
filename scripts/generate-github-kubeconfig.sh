#!/bin/bash
# ============================================================
# Generate kubeconfig for GitHub Actions CI/CD
# ============================================================
# Run this on your VPS after k3s installation
# The output should be saved as KUBE_CONFIG_STAGING secret
# ============================================================

set -euo pipefail

# Get the server's external IP
EXTERNAL_IP=$(curl -s ifconfig.me)

# Create a copy of kubeconfig with external IP
KUBECONFIG_CONTENT=$(cat /etc/rancher/k3s/k3s.yaml | sed "s/127.0.0.1/${EXTERNAL_IP}/g")

echo "=============================================="
echo "Add this as KUBE_CONFIG_STAGING GitHub secret"
echo "(base64 encoded)"
echo "=============================================="
echo ""
echo "${KUBECONFIG_CONTENT}" | base64 -w 0
echo ""
echo ""
echo "=============================================="
echo "Alternatively, raw kubeconfig:"
echo "=============================================="
echo ""
echo "${KUBECONFIG_CONTENT}"
echo ""
echo "=============================================="
echo "IMPORTANT: Also ensure port 6443 is open"
echo "Run: sudo ufw allow 6443/tcp"
echo "=============================================="
