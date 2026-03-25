#!/bin/bash
# TITAN Development Environment Startup
# Starts PostgreSQL + Redis in Docker, Next.js on host

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "=== TITAN Dev Environment ==="

# 1. Start DB + Redis
echo "Starting PostgreSQL + Redis..."
docker compose -f docker-compose.dev.yml up -d titan-db titan-redis
echo "Waiting for services to be healthy..."
sleep 5

# 2. Check DB is ready
until docker exec titan-db-dev pg_isready -U titan -d titan_dev > /dev/null 2>&1; do
  echo "  Waiting for PostgreSQL..."
  sleep 2
done
echo "✅ PostgreSQL ready"

# 3. Check Redis
until docker exec titan-redis-dev redis-cli ping > /dev/null 2>&1; do
  echo "  Waiting for Redis..."
  sleep 2
done
echo "✅ Redis ready"

# 4. Generate Prisma Client
echo "Generating Prisma Client..."
npx prisma generate > /dev/null 2>&1

# 5. Push schema (dev only)
echo "Pushing Prisma schema..."
DATABASE_URL="postgresql://titan:titan_dev_password@localhost:5433/titan_dev" npx prisma db push --skip-generate > /dev/null 2>&1

# 6. Seed if needed
USER_COUNT=$(docker exec titan-db-dev psql -U titan -d titan_dev -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ')
if [ "${USER_COUNT:-0}" -eq "0" ]; then
  echo "Seeding database..."
  DATABASE_URL="postgresql://titan:titan_dev_password@localhost:5433/titan_dev" npx prisma db seed 2>/dev/null || \
  docker exec titan-db-dev psql -U titan -d titan_dev -c "
    INSERT INTO users (id, name, email, password, role, \"isActive\", \"createdAt\", \"updatedAt\")
    VALUES
      ('admin-001', '邱主管', 'admin@titan.local', '\$2a\$10\$oR/zOfynJPAopTHPcAlMnulib1MjTe7yOfQzL3/MTZwjpS20IZXza', 'MANAGER', true, NOW(), NOW()),
      ('eng-001', '工程師A', 'eng-a@titan.local', '\$2a\$10\$oR/zOfynJPAopTHPcAlMnulib1MjTe7yOfQzL3/MTZwjpS20IZXza', 'ENGINEER', true, NOW(), NOW()),
      ('eng-002', '工程師B', 'eng-b@titan.local', '\$2a\$10\$oR/zOfynJPAopTHPcAlMnulib1MjTe7yOfQzL3/MTZwjpS20IZXza', 'ENGINEER', true, NOW(), NOW()),
      ('eng-003', '工程師C', 'eng-c@titan.local', '\$2a\$10\$oR/zOfynJPAopTHPcAlMnulib1MjTe7yOfQzL3/MTZwjpS20IZXza', 'ENGINEER', true, NOW(), NOW()),
      ('eng-004', '工程師D', 'eng-d@titan.local', '\$2a\$10\$oR/zOfynJPAopTHPcAlMnulib1MjTe7yOfQzL3/MTZwjpS20IZXza', 'ENGINEER', true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  " 2>/dev/null
  echo "✅ Database seeded"
fi

# 7. Start Next.js
# Fixed secret for dev — sessions survive server restart
SECRET="titan-dev-secret-2026-do-not-use-in-production-abcdef1234567890"
echo ""
echo "=== Starting Next.js dev server ==="
echo "URL: http://mac-mini.tailde842d.ts.net:3100"
echo "Login: admin@titan.local / Titan@2026"
echo ""

exec env \
  DATABASE_URL="postgresql://titan:titan_dev_password@localhost:5433/titan_dev" \
  REDIS_URL="redis://localhost:6379" \
  NEXTAUTH_SECRET="$SECRET" \
  AUTH_SECRET="$SECRET" \
  AUTH_URL="http://mac-mini.tailde842d.ts.net:3100" \
  NEXTAUTH_URL="http://mac-mini.tailde842d.ts.net:3100" \
  NODE_ENV=development \
  npx next dev -p 3100
