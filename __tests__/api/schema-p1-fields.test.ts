/**
 * @jest-environment node
 */
/**
 * Schema field existence tests for P1 — Issue #1003
 *
 * Verifies that the 12 Document fields and 6 KnowledgeSpace fields
 * are present in the Prisma-generated types.
 */

// We test by checking that the Prisma model delegates accept the new fields
// This is effectively a compile-time test; if fields are missing, TS would error

import { Prisma } from "@prisma/client";

describe("Document P1 fields (schema validation)", () => {
  it("accepts all 12 new Document fields in create input", () => {
    // This tests that Prisma generated types include the new fields
    const input: Partial<Prisma.DocumentCreateInput> = {
      categoryId: "cat-1",
      summary: "Summary text",
      pinned: true,
      coverImage: "https://example.com/img.png",
      publishedVersion: 1,
      publishedAt: new Date(),
      publishedBy: "user-1",
      archivedAt: new Date(),
      archivedBy: "user-1",
      wordCount: 500,
      readTimeMin: 3,
      visibility: "TEAM",
    };
    expect(input.categoryId).toBe("cat-1");
    expect(input.pinned).toBe(true);
    expect(input.wordCount).toBe(500);
    expect(input.readTimeMin).toBe(3);
    expect(input.visibility).toBe("TEAM");
  });
});

describe("KnowledgeSpace P1 fields (schema validation)", () => {
  it("accepts all 6 new KnowledgeSpace fields in create input", () => {
    const input: Partial<Prisma.KnowledgeSpaceCreateInput> = {
      slug: "my-space",
      icon: "book",
      color: "#FF5733",
      visibility: "TEAM",
      sortOrder: 1,
      updatedBy: "user-1",
    };
    expect(input.slug).toBe("my-space");
    expect(input.icon).toBe("book");
    expect(input.color).toBe("#FF5733");
    expect(input.sortOrder).toBe(1);
    expect(input.visibility).toBe("TEAM");
  });
});
