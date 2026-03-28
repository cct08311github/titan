import { Sidebar } from "@/app/components/sidebar";
import { Topbar } from "@/app/components/topbar";
import { Breadcrumb } from "@/app/components/breadcrumb";
import { CommandPalette } from "@/app/components/command-palette";
import { FeedbackButton } from "@/app/components/feedback-button";
import { KeyboardShortcutsDialog } from "@/app/components/keyboard-shortcuts-dialog";
import { NextAuthSessionProvider } from "@/app/components/session-provider";
import { PasswordChangeGuard } from "@/app/components/password-change-guard";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/app/components/ui/tooltip";
// GlobalAlertBanner removed — alerts now consolidated into NotificationBell

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <TooltipProvider delayDuration={300}>
      <PasswordChangeGuard>
        <div className="flex h-screen bg-background overflow-hidden">
          {/* Sidebar: hidden on mobile, visible on md+ */}
          <div className="hidden md:block">
            <Sidebar />
          </div>
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Topbar />
            <Breadcrumb />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6" tabIndex={0}>{children}</main>
          </div>
        </div>
        <CommandPalette />
        <KeyboardShortcutsDialog />
        <FeedbackButton />
        <Toaster richColors position="top-right" />
      </PasswordChangeGuard>
      </TooltipProvider>
    </NextAuthSessionProvider>
  );
}
