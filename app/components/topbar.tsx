"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, User } from "lucide-react";
import { NotificationBell } from "@/app/components/notification-bell";

export function Topbar() {
  const { data: session } = useSession();

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 flex-shrink-0">
      {/* Left: breadcrumb placeholder */}
      <div />

      {/* Right: notification + user */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <NotificationBell />

        {/* User info */}
        <div className="flex items-center gap-2 pl-3 border-l border-border">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm leading-none text-foreground">
              {session?.user?.name ?? "使用者"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-mono tabular-nums">
              {session?.user?.role === "MANAGER" ? "主管" : "工程師"}
            </p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label="登出"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
