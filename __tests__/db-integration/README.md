# DB-integration tests

Tests in this directory **connect to a real Postgres database**. They catch
driver/adapter-level bugs that unit tests with mocked Prisma cannot see —
for example, the `DocumentStatus` enum cast failure (#1481) that cascaded
into 2h+ E2E hangs despite `alert-service` having 6 passing unit tests.

## Running locally

```bash
export DATABASE_URL=postgresql://titan:titan_test@localhost:5432/titan_test
npm run db:migrate:deploy
npm run test:db
```

If `DATABASE_URL` is not set the suite skips with a warning — never fails.

## Running in CI

The `db-integration` job in `.github/workflows/ci.yml` provisions a
Postgres service container, runs migrations, and calls `npm run test:db`.

## What belongs here

- **One smoke test per enum-bearing column** — exercises the Prisma query
  that would fail if the column type drifted from the schema declaration.
- **Query contracts that depend on the driver adapter** — e.g. array
  inclusion, JSONB filters, timezone-aware date columns.

## What does NOT belong here

- Business logic (use unit tests with mocked Prisma)
- UI rendering (use React Testing Library)
- End-to-end user flows (use Playwright in `e2e/`)
