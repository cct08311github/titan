"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { buildLabelMap } from "@/lib/nav-config";

const LABEL_MAP = buildLabelMap();

/**
 * Breadcrumb navigation — renders current path as clickable segments.
 * Label lookup uses the shared nav-config; unknown segments are title-cased.
 * Example: 首頁 / 任務看板 / 詳情
 *
 * Issue #1019
 */
export function Breadcrumb() {
  const pathname = usePathname();

  // Split into segments, filter blanks
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  // Build cumulative hrefs and resolve labels
  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    // Try exact match first, then fall back to first-level match, then humanise
    const label =
      LABEL_MAP[href] ??
      LABEL_MAP["/" + seg] ??
      (() => { try { return decodeURIComponent(seg); } catch { return seg; } })();
    return { href, label };
  });

  return (
    <nav
      aria-label="麵包屑導航"
      className="flex items-center gap-1 text-xs text-muted-foreground px-4 sm:px-6 pt-3 pb-0"
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="h-3.5 w-3.5" aria-hidden="true" />
        <span>首頁</span>
      </Link>
      {crumbs.map(({ href, label }, i) => (
        <span key={href} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" aria-hidden="true" />
          {i === crumbs.length - 1 ? (
            <span className="text-foreground font-medium" aria-current="page">
              {label}
            </span>
          ) : (
            <Link href={href} className="hover:text-foreground transition-colors">
              {label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
