# Changelog

All notable changes to TITAN are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/).

---

## [1.0.0-rc.1] — 2026-03-25

### Summary

Round 5 (R5) stability release — consolidating 40+ PRs from W1–W2 development
sprints into a release-candidate quality build. Focus: security hardening,
test coverage, documentation completeness, and operational readiness.

### Added

- **Auth.js v5 migration** — JWT/JWE authentication with `next-auth@5.0.0-beta.30` (#477)
- **Concurrent session limiter** — max 2 sessions per user, oldest evicted via JWT blacklist (#469, #491)
- **Rate limiting** — Redis-backed with in-memory fallback; login 5/60s, API differentiated by method (#488)
- **CSRF protection** — Origin header validation on all mutation endpoints (#487)
- **JWT blacklist** — server-side token revocation for suspended users (#469)
- **Session timeout** — 30 min server-side idle timeout (#491)
- **Audit logging** — automatic write-op logging via `withAuditLog` middleware (#493)
- **Zod 4 shared schemas** — unified validation across API + client (#466, #492)
- **i18n foundation** — `next-intl` message extraction for zh-TW (#473)
- **Excel import** — KPI and plan import from `.xlsx` files (#464)
- **KPI multi-year comparison** — cross-year trend reporting (#464)
- **PWA manifest** — offline-first design document and manifest (#464)
- **Push notification stub** — interface + stub provider for future bank messaging API (#503)
- **Error boundaries** — `app/(app)/error.tsx` and `global-error.tsx` (#501)
- **Env validator** — startup validation of required environment variables (#497)
- **Structured logging** — pino logger with request correlation (#504)
- **Middleware split** — composable security middleware chain (`withRateLimit`, `withAuditLog`, `withSessionTimeout`, `withJwtBlacklist`) (#468)
- **Account lock** — 10 failed logins → 15 min lock (#490)
- **Password expiry** — 90-day password rotation policy (#490)
- **Key rotation policy** — documented rotation schedule for all secrets (#490)

### Changed

- **Rate limit differentiation** — POST/PUT/DELETE 20 req/60s, GET 100 req/60s (#488, #495)
- **Session limiter Redis prefix** — `active_sessions:` → `titan:sessions:` for namespace isolation (#491)
- **Bulk task API** — wrapped in `$transaction` for atomicity (#521)
- **Copy-year KPI** — idempotency check prevents duplicate on re-call (#520)
- **Scheduled report** — same-day idempotency guard (#493)
- **Audit fire-and-forget** — added error logging on failure (#498)
- **Push notification** — explicitly marked as disabled/stub in code (#503)
- **Password docs** — `NEXTAUTH_SECRET` → `AUTH_SECRET` in all documentation (#490)
- **Tech eval decisions** — all 9 tech evaluation docs now have approved/rejected/deferred status

### Fixed

- **Error boundaries** — added `error.tsx` to activity and settings pages (#501)
- **Env validation** — added `OUTLINE_INTERNAL_URL`, `REDIS_URL`, `PINO_LOG_LEVEL` to startup check (#497)

### Documentation

- Updated README.md with current tech stack versions and test counts
- Updated version-manifest.md with application dependency versions
- Added this CHANGELOG.md
- 9 tech evaluation documents with decision status
- Architecture, security, QA reports updated for R5

### Security

- Defense-in-depth: Edge JWT → CSRF → Rate Limit → Session Timeout → JWT Blacklist → RBAC → Audit
- All secrets validated at startup — app fails fast if misconfigured
- bcrypt password hashing, httpOnly + SameSite=Strict cookies
- No secrets committed — `.env.example` with placeholders only

---

## [0.1.0] — 2026-03-20

Initial development build. Internal milestone only.
