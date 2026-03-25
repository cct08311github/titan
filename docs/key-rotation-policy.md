# TITAN Key Rotation Policy

> Version: 1.0 | Effective: 2026-03-25 | Classification: Internal

## Purpose

This document defines the secrets inventory, rotation schedule, and procedures for all credentials used by TITAN. Timely rotation limits the blast radius of compromised credentials.

---

## Secrets Inventory

| # | Secret | Location | Owner | Rotation Period | Method |
|---|--------|----------|-------|-----------------|--------|
| 1 | `DATABASE_URL` (PostgreSQL password) | `.env` / Secrets Manager | DBA / Infra | 90 days | Manual — update pg password, rotate env |
| 2 | `NEXTAUTH_SECRET` (JWT signing key) | `.env` / Secrets Manager | App Owner | 180 days | Generate new random, redeploy |
| 3 | `REDIS_URL` (Redis password) | `.env` / Secrets Manager | Infra | 90 days | Update Redis AUTH, rotate env |
| 4 | `MINIO_ROOT_PASSWORD` | `.env` / Secrets Manager | Infra | 90 days | Update MinIO, rotate env |
| 5 | `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | `.env` / Secrets Manager | Infra | 90 days | Regenerate via MinIO admin API |
| 6 | SSL/TLS Certificates | `/etc/nginx/ssl/` | Infra | 365 days (or auto via Let's Encrypt) | Renew cert, reload nginx |
| 7 | GitHub Deploy Key / PAT | CI/CD Secrets | DevOps | 180 days | Regenerate in GitHub Settings |
| 8 | User passwords (bcrypt hashed) | PostgreSQL `users` table | Each user | 90 days | Enforced by app (`passwordChangedAt` + 90-day expiry) |

---

## Rotation Schedule

### Quarterly (Every 90 Days)

- [ ] PostgreSQL database password
- [ ] Redis password
- [ ] MinIO root password and access keys
- [ ] Verify user password expiry enforcement is active

### Semi-Annual (Every 180 Days)

- [ ] `NEXTAUTH_SECRET` JWT signing key
- [ ] GitHub deploy keys / personal access tokens
- [ ] Review and revoke unused API tokens

### Annual

- [ ] SSL/TLS certificate renewal (or verify auto-renewal)
- [ ] Full secrets audit — confirm no stale credentials

---

## Rotation Procedures

### 1. PostgreSQL Password Rotation

```bash
# 1. Generate new password
NEW_PW=$(openssl rand -base64 32)

# 2. Update PostgreSQL
psql -U postgres -c "ALTER USER titan_app PASSWORD '${NEW_PW}';"

# 3. Update environment
# Edit .env or update secrets manager with new DATABASE_URL

# 4. Rolling restart
docker compose restart titan-app

# 5. Verify connectivity
docker compose exec titan-app npx prisma db pull --print 2>&1 | head -5
```

### 2. NEXTAUTH_SECRET Rotation

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 48)

# 2. Update .env
# NEXTAUTH_SECRET=<new_secret>

# 3. Redeploy application
docker compose up -d --force-recreate titan-app

# Note: All existing JWT sessions will be invalidated.
# Users will need to re-login. Schedule during low-traffic window.
```

### 3. Redis Password Rotation

```bash
# 1. Generate new password
NEW_PW=$(openssl rand -base64 32)

# 2. Update Redis config (requirepass)
docker compose exec redis redis-cli CONFIG SET requirepass "${NEW_PW}"

# 3. Update .env with new REDIS_URL
# REDIS_URL=redis://:${NEW_PW}@redis:6379

# 4. Restart application
docker compose restart titan-app
```

### 4. MinIO Access Key Rotation

```bash
# 1. Generate new credentials
NEW_ACCESS=$(openssl rand -hex 16)
NEW_SECRET=$(openssl rand -base64 32)

# 2. Create new access key via mc admin
mc admin user add myminio "${NEW_ACCESS}" "${NEW_SECRET}"
mc admin policy attach myminio readwrite --user "${NEW_ACCESS}"

# 3. Update .env
# MINIO_ACCESS_KEY=<new_access>
# MINIO_SECRET_KEY=<new_secret>

# 4. Remove old key after verification
mc admin user remove myminio <old_access_key>

# 5. Restart application
docker compose restart titan-app
```

### 5. SSL Certificate Renewal

```bash
# Auto-renewal (Let's Encrypt via certbot)
certbot renew --nginx --quiet

# Manual renewal
./scripts/generate-ssl-cert.sh

# Reload nginx
docker compose exec nginx nginx -s reload
```

---

## Pre-Rotation Checklist

Before any rotation:

1. **Notify team** — announce maintenance window
2. **Backup current credentials** — secure record in password manager (never in git)
3. **Test in staging first** — validate connectivity after rotation
4. **Plan rollback** — keep old credentials for 24h in case of issues
5. **Audit log** — record the rotation event

## Post-Rotation Checklist

After rotation:

1. **Verify application health** — check `/api/metrics` and application logs
2. **Verify database connectivity** — confirm API responses are successful
3. **Destroy old credentials** — remove from all locations after 24h grace period
4. **Update rotation log** — record date and operator

---

## Emergency Rotation

If a credential is suspected to be compromised:

1. **Rotate immediately** — do not wait for the scheduled window
2. **Check audit logs** — `/api/audit` for unusual activity
3. **Scan for unauthorized access** — review database logs, nginx access logs
4. **Notify security team** — escalate per incident response procedure
5. **Document incident** — create GitHub Issue with timeline

---

## Compliance Notes

- **Password policy:** Minimum 12 characters, mixed case, numbers, special characters
- **Password history:** Last 5 passwords cannot be reused (enforced by application)
- **Password expiry:** 90-day maximum age (enforced by `isPasswordExpired()`)
- **Session timeout:** 8-hour maximum JWT lifetime
- **Account lockout:** 10 failed attempts triggers 15-minute lockout
- **No secrets in code:** All secrets via environment variables or secrets manager
- **Audit trail:** All auth events logged to `audit_logs` table
