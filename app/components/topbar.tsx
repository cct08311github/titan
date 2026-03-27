"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Moon, Sun, X, AlertTriangle, Search } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import { NotificationBell } from "@/app/components/notification-bell";
import { getFlatNavItems, buildLabelMap } from "@/lib/nav-config";

/** Page titles derived from shared nav-config (Issue #1019) */
const PAGE_TITLES = buildLabelMap();

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("titan-theme", next ? "dark" : "light");
  }
  return (
    <button onClick={toggle} className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" aria-label={dark ? "切換淺色模式" : "切換深色模式"} title={dark ? "切換淺色模式" : "切換深色模式"}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

const PASSWORD_MAX_AGE_DAYS = 90;
const PASSWORD_WARN_DAYS = 7;

function computeDaysUntilExpiry(passwordChangedAt?: string | null): number | null {
  if (!passwordChangedAt) return null;
  const changedMs = new Date(passwordChangedAt).getTime();
  const expiresAt = changedMs + PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const remaining = expiresAt - Date.now();
  return remaining > 0 ? Math.ceil(remaining / (24 * 60 * 60 * 1000)) : 0;
}

export function Topbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const role = session?.user?.role as string | undefined;

  const pageTitle = Object.entries(PAGE_TITLES).find(([p]) => pathname === p || pathname.startsWith(p + "/"))?.[1];

  // Mobile nav items filtered by role (Issue #1019)
  const mobileNavItems = getFlatNavItems(role);

  // Issue #834: password expiry warning
  const user = session?.user as { passwordChangedAt?: string | null } | undefined;
  const daysLeft = useMemo(() => computeDaysUntilExpiry(user?.passwordChangedAt), [user?.passwordChangedAt]);
  const showExpiryWarning = daysLeft !== null && daysLeft <= PASSWORD_WARN_DAYS && daysLeft > 0;

  return (
    <>
    {/* Password expiry warning banner (Issue #834) */}
    {showExpiryWarning && (
      <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400" data-testid="password-expiry-warning">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span>
          您的密碼將於 <strong>{daysLeft}</strong> 天後到期，請儘速
          <Link href="/change-password" className="underline font-medium ml-1">變更密碼</Link>
        </span>
      </div>
    )}
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 sm:px-6 flex-shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 -ml-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="選單"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <h1 className="text-sm font-medium text-foreground">{pageTitle ?? ""}</h1>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
          className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="全域搜尋"
          title="搜尋 (⌘K)"
        >
          <Search className="h-4 w-4" />
        </button>
        <ThemeToggle />
        <NotificationBell />
        <div className="w-px h-6 bg-border mx-2" />
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-semibold text-primary">{session?.user?.name?.charAt(0) ?? "U"}</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-none text-foreground">{session?.user?.name ?? "使用者"}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{session?.user?.role === "MANAGER" ? "主管" : "工程師"}</p>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="p-2 rounded-lg text-muted-foreground hover:text-danger hover:bg-accent transition-colors ml-1" aria-label="登出" title="登出">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>

    {/* Mobile navigation overlay — now role-filtered via shared nav-config (Issue #1019) */}
    {mobileMenuOpen && (
      <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
        <nav
          className="w-64 h-full bg-card shadow-xl p-4 space-y-1"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2.5 px-3 py-3 mb-3 border-b border-border">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-xs font-bold text-primary-foreground">T</span>
            </div>
            <span className="text-base font-semibold tracking-tight">TITAN</span>
          </div>
          {mobileNavItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg text-sm h-10 px-3 transition-colors",
                  isActive
                    ? "bg-primary/[0.06] text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    )}
    </>
  );
}
