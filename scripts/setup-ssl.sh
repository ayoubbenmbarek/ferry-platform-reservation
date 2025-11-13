#!/bin/bash

# SSL Certificate Setup Script using Let's Encrypt
# This script helps you set up SSL certificates for production

set -e

echo "========================================="
echo "SSL Certificate Setup"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}Certbot not found. Installing...${NC}"

    # Detect OS and install certbot
    if [ -f /etc/debian_version ]; then
        apt-get update
        apt-get install -y certbot
    elif [ -f /etc/redhat-release ]; then
        yum install -y certbot
    else
        echo -e "${RED}Unsupported OS. Please install certbot manually.${NC}"
        exit 1
    fi
fi

# Get domain name
read -p "Enter your domain name (e.g., yourdomain.com): " DOMAIN
read -p "Enter your email address for Let's Encrypt: " EMAIL

echo ""
echo -e "${GREEN}Obtaining SSL certificate for $DOMAIN${NC}"

# Stop nginx if running
docker stop maritime-nginx 2>/dev/null || true

# Obtain certificate
certbot certonly --standalone \
    --preferred-challenges http \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

# Copy certificates to nginx ssl directory
echo -e "${GREEN}Copying certificates to nginx/ssl/${NC}"
mkdir -p nginx/ssl
cp /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/"$DOMAIN"/privkey.pem nginx/ssl/
chmod 644 nginx/ssl/fullchain.pem
chmod 600 nginx/ssl/privkey.pem

# Update nginx configuration with domain name
echo -e "${GREEN}Updating nginx configuration${NC}"
sed -i "s/yourdomain.com/$DOMAIN/g" nginx/conf.d/maritime.conf

# Start nginx
docker start maritime-nginx 2>/dev/null || echo -e "${YELLOW}Nginx not running yet${NC}"

echo ""
echo "========================================="
echo -e "${GREEN}SSL Certificate installed successfully!${NC}"
echo "========================================="
echo ""
echo "Certificate location: /etc/letsencrypt/live/$DOMAIN/"
echo "Copied to: nginx/ssl/"
echo ""
echo "To renew certificates automatically, add this to crontab:"
echo "0 0 * * 0 certbot renew --quiet --post-hook \"docker restart maritime-nginx\""
echo ""
echo "Run: crontab -e"
echo "And add the above line"
echo ""
