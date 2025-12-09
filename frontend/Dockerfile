# Multi-stage build for production
FROM node:18-alpine as build

# Build arguments for environment configuration
ARG REACT_APP_API_URL=http://localhost:8010
ARG REACT_APP_STRIPE_PUBLISHABLE_KEY
ARG REACT_APP_ENVIRONMENT=production
ARG REACT_APP_GOOGLE_CLIENT_ID
ARG REACT_APP_SENTRY_DSN
ARG REACT_APP_VERSION=1.0.0

# Set environment variables for build
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_STRIPE_PUBLISHABLE_KEY=$REACT_APP_STRIPE_PUBLISHABLE_KEY
ENV REACT_APP_ENVIRONMENT=$REACT_APP_ENVIRONMENT
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID
ENV REACT_APP_SENTRY_DSN=$REACT_APP_SENTRY_DSN
ENV REACT_APP_VERSION=$REACT_APP_VERSION

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY . .

# Cache buster - forces rebuild when ARG changes
ARG CACHE_BUST=1
RUN echo "Cache bust: $CACHE_BUST"

# Debug: Print the API URL being used
RUN echo "Building with REACT_APP_API_URL=$REACT_APP_API_URL"

# Build the application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine as production

# Create non-root user
RUN addgroup -g 101 -S nginx || true && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx || true

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Create necessary directories with correct permissions
RUN mkdir -p /var/cache/nginx /var/run && \
    chown -R nginx:nginx /var/cache/nginx /var/run /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
