"use client";

/**
 * GuidedTour — 3-step first-login guided tour (Issue #970)
 *
 * Steps:
 * 1. My Day — 認識你的今日總覽
 * 2. Create Task — 建立第一個任務
 * 3. Log Time — 記錄第一筆工時
 *
 * Shown on first login. Stores completion in localStorage.
 */

import { useState, useEffect } from "react";
import { Sun, CheckSquare, Clock, Search, Keyboard, X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const TOUR_KEY = "titan_guided_tour_completed";

interface GuidedTourProps {
  className?: string;
}

const STEPS = [
  {
    id: "my-day",
    title: "歡迎來到 TITAN！",
    description: "這是你的「今日總覽」。每天打開 TITAN 就能看到今天要做的事、工時進度和月度目標。",
    tip: "點選左側「今日總覽」，開始你的一天。",
    icon: Sun,
    color: "text-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    id: "create-task",
    title: "建立你的第一個任務",
    description: "到「任務看板」建立你的第一個任務。拖拉看板卡片就能更新任務狀態。",
    tip: "點選左側「任務看板」→ 點「+ 新增任務」。",
    icon: CheckSquare,
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    id: "log-time",
    title: "記錄你的第一筆工時",
    description: "到「工時紀錄」填寫今天的工作時間。按 Tab 就能快速在格子間切換。",
    tip: "點選左側「工時紀錄」→ 選擇今天 → 填入時數。",
    icon: Clock,
    color: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/30",
  },
  {
    id: "quick-search",
    title: "快速搜尋一切",
    description: "按下 ⌘K（或 Ctrl+K）隨時開啟搜尋面板，快速找到頁面、任務、文件和使用者。也可以用 G+字母組合鍵直接跳轉頁面。",
    tip: "試試按 ⌘K 搜尋「看板」，或按 G 再按 K 直接跳轉到看板。",
    icon: Search,
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
  },
  {
    id: "keyboard-help",
    title: "快捷鍵隨手查",
    description: "按下 ? 鍵可以隨時查看所有鍵盤快捷鍵。熟練快捷鍵能大幅提升操作效率。",
    tip: "按 ? 打開快捷鍵說明。可在設定頁重新啟動導覽。",
    icon: Keyboard,
    color: "text-rose-500",
    bgColor: "bg-rose-50 dark:bg-rose-950/30",
  },
];

export function GuidedTour({ className }: GuidedTourProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_KEY);
    if (!completed) {
      setVisible(true);
    }
  }, []);

  function handleComplete() {
    localStorage.setItem(TOUR_KEY, new Date().toISOString());
    setVisible(false);
  }

  function handleDismiss() {
    localStorage.setItem(TOUR_KEY, "dismissed");
    setVisible(false);
  }

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm", className)}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header with step indicator */}
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === step ? "w-8 bg-primary" : i < step ? "w-4 bg-primary/40" : "w-4 bg-muted"
                )}
              />
            ))}
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="關閉導覽"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-6">
          <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center mb-4", current.bgColor)}>
            <Icon className={cn("h-7 w-7", current.color)} />
          </div>

          <h2 className="text-lg font-semibold text-foreground mb-2">
            {current.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            {current.description}
          </p>
          <div className="bg-muted/50 rounded-lg px-3 py-2">
            <p className="text-xs text-foreground font-medium">
              {current.tip}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 pb-5">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className={cn(
              "flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg transition-colors",
              step === 0
                ? "text-muted-foreground/40 cursor-default"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            上一步
          </button>

          {isLast ? (
            <button
              onClick={handleComplete}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              開始使用！
            </button>
          ) : (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1 text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              下一步
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
