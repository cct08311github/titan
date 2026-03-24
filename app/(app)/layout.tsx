import { Sidebar } from "@/app/components/sidebar";
import { Topbar } from "@/app/components/topbar";
import { NextAuthSessionProvider } from "@/app/components/session-provider";
import { PasswordChangeGuard } from "@/app/components/password-change-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <PasswordChangeGuard>
        <div className="flex h-screen bg-background overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </div>
      </PasswordChangeGuard>
    </NextAuthSessionProvider>
  );
}
