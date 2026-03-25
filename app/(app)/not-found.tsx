import { Home, Search } from "lucide-react";
import Link from "next/link";

export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tabular-nums">404</h1>
          <h2 className="text-lg font-semibold">找不到頁面</h2>
          <p className="text-sm text-muted-foreground">
            您嘗試存取的頁面不存在或已被移除。請確認網址是否正確。
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Home className="h-4 w-4" />
          返回儀表板
        </Link>
      </div>
    </div>
  );
}
