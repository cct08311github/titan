/**
 * DB-integration test: Document.status enum contract (Issue #1481, #1486)
 *
 * Exercises the exact findMany shape that failed in production after the
 * Prisma 7 + @prisma/adapter-pg upgrade:
 *
 *     DriverAdapterError: operator does not exist: text = "DocumentStatus"
 *
 * If the documents.status column type drifts from DocumentStatus back to
 * TEXT (or any future enum field suffers the same retrofit-as-TEXT bug),
 * this test fails immediately with a clear error — not 2h into E2E.
 */

import { PrismaClient, DocumentStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const dbUrl = process.env.DATABASE_URL;

// Skip (not fail) when no DB is available — e.g. contributor's first
// clone. CI always sets DATABASE_URL via the postgres service container.
const describeIfDb = dbUrl ? describe : describe.skip;

describeIfDb("Document.status enum contract", () => {
  let prisma: PrismaClient;
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: dbUrl, max: 2 });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  test("findMany with status literal does not explode on the driver adapter", async () => {
    await expect(
      prisma.document.findMany({
        where: { status: "PUBLISHED" },
        select: { id: true },
        take: 1,
      }),
    ).resolves.toBeDefined();
  });

  test("findMany with typed enum import does not explode", async () => {
    await expect(
      prisma.document.findMany({
        where: { status: DocumentStatus.PUBLISHED },
        select: { id: true },
        take: 1,
      }),
    ).resolves.toBeDefined();
  });

  test("documents.status column type matches DocumentStatus (not TEXT)", async () => {
    const rows = await prisma.$queryRaw<Array<{ data_type: string; udt_name: string }>>`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'documents' AND column_name = 'status'
    `;
    expect(rows).toHaveLength(1);
    // Postgres reports enum columns as data_type='USER-DEFINED', udt_name='DocumentStatus'
    expect(rows[0].data_type).toBe("USER-DEFINED");
    expect(rows[0].udt_name).toBe("DocumentStatus");
  });
});
