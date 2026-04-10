import { NextRequest, NextResponse } from "next/server";
import { withManager } from "@/lib/auth-middleware";
import { requireRole } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import * as fs from "fs";
import * as path from "path";

/**
 * GET /api/admin/backup-status
 * Returns backup status summary. MANAGER only.
 */
export const GET = withManager(async (req: NextRequest) => {
  await requireRole("MANAGER");

  const backupRoot = process.env.BACKUP_ROOT ?? "/opt/titan/backups";
  const logFile = path.join(backupRoot, "backup.log");
  const dailyDir = path.join(backupRoot, "daily");

  let lastLogLines: string[] = [];
  let lastBackupTime: string | null = null;
  let backupCount = 0;
  let totalSizeMB = 0;
  let recentBackups: Array<{
    name: string;
    date: string;
    sizeMB: number;
  }> = [];

  // Read last 20 lines of backup log, filtering out lines with sensitive data
  // Issue #1330: log may contain connection strings, passwords, or secrets
  const SENSITIVE_PATTERNS = [/password/i, /secret/i, /api[_-]?key/i, /token/i, /connection.*string/i, /postgresql:\/\//i];
  try {
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, "utf-8");
      const lines = content.trim().split("\n");
      lastLogLines = lines
        .slice(-30) // read more lines to account for filtered ones
        .filter((line) => !SENSITIVE_PATTERNS.some((p) => p.test(line)))
        .slice(-20); // return at most 20 after filtering
    }
  } catch {
    // Log file may not exist in dev environments
  }

  // List daily backups
  try {
    if (fs.existsSync(dailyDir)) {
      const entries = fs.readdirSync(dailyDir, { withFileTypes: true });
      const dirs = entries
        .filter((e) => e.isDirectory())
        .map((e) => {
          const fullPath = path.join(dailyDir, e.name);
          let sizeMB = 0;
          try {
            const stat = fs.statSync(fullPath);
            sizeMB = Math.round((stat.size / 1024 / 1024) * 10) / 10;
          } catch {
            // Ignore stat errors
          }
          // Parse timestamp from directory name (e.g., 20260325_120000)
          const match = e.name.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
          const date = match
            ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`
            : e.name;
          return { name: e.name, date, sizeMB };
        })
        .sort((a, b) => b.name.localeCompare(a.name));

      backupCount = dirs.length;
      totalSizeMB = dirs.reduce((sum, d) => sum + d.sizeMB, 0);
      recentBackups = dirs.slice(0, 10);
      lastBackupTime = dirs.length > 0 ? dirs[0].date : null;
    }
  } catch {
    // Backup directory may not exist in dev environments
  }

  return success({
    backupRoot,
    lastBackupTime,
    backupCount,
    totalSizeMB: Math.round(totalSizeMB * 10) / 10,
    recentBackups,
    lastLogLines,
  });
});
