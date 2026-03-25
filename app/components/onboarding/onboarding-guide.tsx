"use client";

/**
 * OnboardingGuide — Step-by-step first-time user guide
 * Sprint 2 — Task 20
 *
 * Steps: Welcome → Profile Setup → First Timesheet → Done
 * Shows on first login (controlled by parent via user metadata check).
 */

import React, { useState, useCallback } from "react";
import {
  UserCircle,
  Clock,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingGuideProps {
  onComplete: () => void;
  onDismiss: () => void;
  className?: string;
}

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tips: string[];
}

const STEPS: Step[] = [
  {
    id: "welcome",
    title: "歡迎使用 TITAN",
    description: "TITAN 是您的專案管理與工時追蹤平台。讓我們快速了解核心功能。",
    icon: <Sparkles className="h-8 w-8 text-primary" />,
    tips: [
      "追蹤每日工時，自動計算加班",
      "管理專案任務與交付物",
      "產出合規報表供結算使用",
    ],
  },
  {
    id: "profile",
    title: "設定個人資料",
    description: "請先完善您的個人資料，確保工時記錄正確歸屬。",
    icon: <UserCircle className="h-8 w-8 text-blue-500" />,
    tips: [
      "前往「設定」頁面更新顯示名稱",
      "確認所屬部門與職位正確",
      "設定通知偏好（Email / 站內通知）",
    ],
  },
  {
    id: "timesheet",
    title: "填寫第一筆工時",
    description: "工時表是 TITAN 最核心的功能。每天記錄工作內容與時數。",
    icon: <Clock className="h-8 w-8 text-amber-500" />,
    tips: [
      "點擊工時表中的儲存格直接輸入時數",
      "使用計時器自動追蹤工作時間",
      "支援鍵盤快速鍵：Tab 切換、Enter 儲存",
      "可從 Kimai 匯入既有工時資料",
    ],
  },
  {
    id: "done",
    title: "準備就緒，開始使用！",
    description: "您已完成基本設定。隨時可以從側邊欄存取所有功能。",
    icon: <CheckCircle2 className="h-8 w-8 text-green-500" />,
    tips: [
      "使用 Ctrl+K 快速搜尋任何內容",
      "每月結算前請確認工時已送審",
      "遇到問題可查閱「知識庫」或聯繫管理員",
    ],
  },
];

export function OnboardingGuide({
  onComplete,
  onDismiss,
  className,
}: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  }, [isLastStep, onComplete]);

  const handleBack = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  return (
    <div
      className={cn(
        "mx-auto max-w-lg rounded-2xl border border-border bg-card p-6 shadow-lg",
        className
      )}
    >
      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{currentStep + 1}</span>
          <span>/</span>
          <span>{STEPS.length}</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="跳過"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          跳過
        </button>
      </div>

      {/* Step progress dots */}
      <div className="mb-6 flex gap-1.5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= currentStep ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center">{step.icon}</div>
        <h2 className="text-lg font-semibold text-foreground">{step.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
      </div>

      {/* Tips */}
      <ul className="mb-8 space-y-2">
        {step.tips.map((tip, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm text-muted-foreground"
          >
            <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {!isFirstStep ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label="上一步"
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            上一步
          </button>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={handleNext}
          aria-label={isLastStep ? "開始使用" : "下一步"}
          className={cn(
            "flex items-center gap-1 rounded-lg px-5 py-2 text-sm font-medium transition-all",
            isLastStep
              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              : "bg-card border border-border text-foreground hover:bg-accent shadow-sm"
          )}
        >
          {isLastStep ? "開始使用" : "下一步"}
          {!isLastStep && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
