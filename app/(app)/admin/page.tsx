"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Database,
  Shield,
  Clock,
  Users,
  Tag,
  Flag,
  Bell,
} from "lucide-react";
import { AdminPermissions } from "@/app/components/admin-permissions";
import { AdminMonitoringAlerts } from "@/app/components/admin-monitoring-alerts";
import { AdminTools } from "@/app/components/admin-tools";
import { AdminStaleTaskSettings } from "@/app/components/admin-stale-task-settings";
import { BackupStatusSection } from "@/app/components/admin/backup-status-section";
import { AuditLogSection } from "@/app/components/admin/audit-log-section";
import { UserManagementSection } from "@/app/components/admin/user-management-section";
import { CategoryManagementSection } from "@/app/components/admin/category-management-section";
import { FeatureFlagsSection } from "@/app/components/admin/feature-flags-section";
import { cn } from "@/lib/utils";
import { hasMinimumRole } from "@/lib/auth/permissions";
import { PageLoading, PageError } from "@/app/components/page-states";

// ── Types ──────────────────────────────────────────────────────────────────

type AdminTab = "system" | "users" | "categories" | "flags" | "permissions" | "alerts" | "stale";

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>("system");

  // Redirect non-managers
  useEffect(() => {
    if (status === "authenticated" && !hasMinimumRole(session?.user?.role ?? "", "MANAGER")) {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  if (status === "loading") return <PageLoading />;

  if (!hasMinimumRole(session?.user?.role ?? "", "MANAGER")) {
    return (
      <PageError
        message="權限不足：僅限管理員存取此頁面"
        className="py-20"
      />
    );
  }

  const userRole = session?.user?.role ?? "";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">系統管理</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          備份狀態、稽核日誌、使用者與類別管理
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center bg-muted rounded-lg p-0.5 w-fit" role="tablist" aria-label="管理功能分頁">
        <button
          onClick={() => setActiveTab("system")}
          role="tab"
          aria-selected={activeTab === "system"}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-md transition-colors",
            activeTab === "system"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Database className="h-3.5 w-3.5" />
          系統管理
        </button>
        <button
          onClick={() => setActiveTab("users")}
          role="tab"
          aria-selected={activeTab === "users"}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-md transition-colors",
            activeTab === "users"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="h-3.5 w-3.5" />
          使用者管理
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          role="tab"
          aria-selected={activeTab === "categories"}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-md transition-colors",
            activeTab === "categories"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Tag className="h-3.5 w-3.5" />
          類別管理
        </button>
        {userRole === "ADMIN" && (
          <button
            onClick={() => setActiveTab("flags")}
            role="tab"
            aria-selected={activeTab === "flags"}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-md transition-colors",
              activeTab === "flags"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Flag className="h-3.5 w-3.5" />
            功能開關
          </button>
        )}
        <button
          onClick={() => setActiveTab("permissions")}
          role="tab"
          aria-selected={activeTab === "permissions"}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-md transition-colors",
            activeTab === "permissions"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Shield className="h-3.5 w-3.5" />
          權限管理
        </button>
        <button
          onClick={() => setActiveTab("alerts")}
          role="tab"
          aria-selected={activeTab === "alerts"}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-md transition-colors",
            activeTab === "alerts"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Bell className="h-3.5 w-3.5" />
          監控警報
        </button>
        {userRole === "ADMIN" && (
          <button
            onClick={() => setActiveTab("stale")}
            role="tab"
            aria-selected={activeTab === "stale"}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-md transition-colors",
              activeTab === "stale"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            停滯設定
          </button>
        )}
      </div>

      {/* Tab content */}
      {activeTab === "system" && (
        <div className="space-y-10">
          <BackupStatusSection />
          <AdminTools role={userRole} />
          <AuditLogSection />
        </div>
      )}
      {activeTab === "users" && <UserManagementSection />}
      {activeTab === "categories" && <CategoryManagementSection />}
      {activeTab === "flags" && userRole === "ADMIN" && <FeatureFlagsSection />}
      {activeTab === "permissions" && <AdminPermissions />}
      {activeTab === "alerts" && <AdminMonitoringAlerts />}
      {activeTab === "stale" && userRole === "ADMIN" && <AdminStaleTaskSettings />}
    </div>
  );
}
