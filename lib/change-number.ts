/**
 * Change number generator — Issue #858
 *
 * Format: CHG-{YYYY}-{MMDD}-{NN}
 * NN is a daily sequence number starting at 01.
 */

import { PrismaClient } from "@prisma/client";

/**
 * Generate the next change number for today.
 * Queries existing records with today's prefix to determine the sequence.
 */
export async function generateChangeNumber(prisma: PrismaClient): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `CHG-${yyyy}-${mm}${dd}`;

  // Find today's highest sequence number
  const latest = await prisma.changeRecord.findFirst({
    where: { changeNumber: { startsWith: prefix } },
    orderBy: { changeNumber: "desc" },
    select: { changeNumber: true },
  });

  let seq = 1;
  if (latest) {
    const parts = latest.changeNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  return `${prefix}-${String(seq).padStart(2, "0")}`;
}
