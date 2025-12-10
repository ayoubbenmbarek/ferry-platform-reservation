# Cloudflare Security Configuration

## Overview

This document outlines the Cloudflare security settings for voilaferry.com.

## 1. SSL/TLS Settings

**Location**: SSL/TLS → Overview

| Setting | Value |
|---------|-------|
| SSL Mode | **Full (strict)** |
| Always Use HTTPS | **On** |
| Automatic HTTPS Rewrites | **On** |
| Minimum TLS Version | **TLS 1.2** |

**SSL/TLS → Edge Certificates**:
- Enable **TLS 1.3**
- Enable **HSTS** (HTTP Strict Transport Security)
  - Max Age: 6 months
  - Include subdomains: Yes
  - Preload: Yes (after testing)

## 2. WAF Custom Rules (5 free rules)

**Location**: Security → WAF → Custom Rules

### Rule 1: Block Common Attack Paths
```
Name: Block WordPress & Admin Scanners
Expression:
(http.request.uri.path contains "/wp-admin") or
(http.request.uri.path contains "/wp-login") or
(http.request.uri.path contains "/wp-content") or
(http.request.uri.path contains "/phpmyadmin") or
(http.request.uri.path contains "/admin.php") or
(http.request.uri.path contains "/.env") or
(http.request.uri.path contains "/.git") or
(http.request.uri.path contains "/config.php")

Action: Block
```

### Rule 2: Block SQL Injection Attempts
```
Name: Block SQL Injection
Expression:
(http.request.uri.query contains "UNION SELECT") or
(http.request.uri.query contains "OR 1=1") or
(http.request.uri.query contains "' OR '") or
(http.request.uri.query contains "DROP TABLE") or
(http.request.uri.query contains "<script>") or
(http.request.uri.query contains "javascript:")

Action: Block
```

### Rule 3: Protect Auth Endpoints (Rate Limit)
```
Name: Auth Rate Limit
Expression:
(http.request.uri.path contains "/api/v1/auth/login") or
(http.request.uri.path contains "/api/v1/auth/register") or
(http.request.uri.path contains "/api/v1/auth/forgot-password")

Action: Managed Challenge
Rate Limit: Enable in Security → WAF → Rate Limiting Rules
```

### Rule 4: Block Bad Bots (User-Agent)
```
Name: Block Malicious Bots
Expression:
(http.user_agent contains "sqlmap") or
(http.user_agent contains "nikto") or
(http.user_agent contains "nmap") or
(http.user_agent contains "masscan") or
(http.user_agent contains "python-requests") or
(http.user_agent eq "")

Action: Block
```

### Rule 5: Geo-Blocking (Optional)
```
Name: Block High-Risk Countries
Expression:
(ip.geoip.country in {"RU" "CN" "KP" "IR"}) and
not (http.request.uri.path contains "/api/v1/ferries")

Action: Managed Challenge
```
*Note: Adjust based on your customer base*

## 3. Rate Limiting Rules

**Location**: Security → WAF → Rate Limiting Rules

### API Rate Limit
```
Name: API Rate Limit
Expression: (http.request.uri.path contains "/api/")
Characteristics: IP
Period: 1 minute
Requests: 100
Action: Block for 1 minute
```

### Login Rate Limit
```
Name: Login Brute Force Protection
Expression: (http.request.uri.path eq "/api/v1/auth/login-email")
Characteristics: IP
Period: 1 minute
Requests: 5
Action: Block for 10 minutes
```

### Registration Rate Limit
```
Name: Registration Spam Protection
Expression: (http.request.uri.path eq "/api/v1/auth/register")
Characteristics: IP
Period: 1 hour
Requests: 3
Action: Block for 1 hour
```

## 4. Bot Fight Mode

**Location**: Security → Bots

| Setting | Value |
|---------|-------|
| Bot Fight Mode | **On** |
| Block AI Scrapers | **On** (optional) |

## 5. Security Settings

**Location**: Security → Settings

| Setting | Value |
|---------|-------|
| Security Level | **Medium** (or High for sensitive periods) |
| Challenge Passage | **30 minutes** |
| Browser Integrity Check | **On** |

## 6. DDoS Protection

**Location**: Security → DDoS

- **HTTP DDoS Attack Protection**: On (automatic)
- **Sensitivity Level**: Medium
- Cloudflare automatically protects against L3/L4/L7 attacks

## 7. Page Rules (3 free rules)

**Location**: Rules → Page Rules

### Rule 1: Cache Static Assets
```
URL: *voilaferry.com/static/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Browser Cache TTL: 1 week
```

### Rule 2: Bypass Cache for API
```
URL: *api-staging.voilaferry.com/api/*
Settings:
  - Cache Level: Bypass
  - Disable Performance
```

### Rule 3: Security for Admin
```
URL: *voilaferry.com/admin/*
Settings:
  - Security Level: High
  - Browser Integrity Check: On
```

## 8. Firewall Events Monitoring

**Location**: Security → Events

Monitor for:
- Blocked requests patterns
- Geographic anomalies
- User-agent anomalies
- Rate limit triggers

**Set up notifications**:
- Security → Notifications → Create
- Alert on: High volume of blocked requests

## 9. Quick Setup Checklist

- [ ] SSL/TLS set to Full (strict)
- [ ] Always Use HTTPS enabled
- [ ] HSTS enabled
- [ ] TLS 1.3 enabled
- [ ] Bot Fight Mode enabled
- [ ] Custom Rule 1: Block attack paths
- [ ] Custom Rule 2: Block SQL injection
- [ ] Custom Rule 3: Protect auth endpoints
- [ ] Custom Rule 4: Block bad bots
- [ ] Custom Rule 5: Geo-blocking (optional)
- [ ] Rate limiting for API
- [ ] Rate limiting for login
- [ ] Page rules configured
- [ ] Security notifications enabled

## 10. Testing

After configuration, test with:

```bash
# Test blocked paths (should return 403)
curl -I https://staging.voilaferry.com/.env
curl -I https://staging.voilaferry.com/wp-admin

# Test rate limiting (should block after threshold)
for i in {1..10}; do curl -s -o /dev/null -w "%{http_code}\n" https://api-staging.voilaferry.com/api/v1/auth/login-email; done

# Test SQL injection block
curl "https://api-staging.voilaferry.com/api/v1/ferries?id=1' OR '1'='1"
```

## 11. Production vs Staging

Apply same rules to both:
- `staging.voilaferry.com` / `api-staging.voilaferry.com`
- `voilaferry.com` / `api.voilaferry.com`

Consider stricter settings for production:
- Security Level: High
- More aggressive rate limiting
