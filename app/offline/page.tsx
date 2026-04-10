"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4 max-w-sm px-6">
        <div className="text-6xl mb-4">📵</div>
        <h1 className="text-2xl font-semibold">目前處於離線狀態</h1>
        <p className="text-muted-foreground text-sm">
          無法連線至網路。請確認網路連線後再試一次。
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
        >
          重新嘗試
        </button>
      </div>
    </div>
  );
}
