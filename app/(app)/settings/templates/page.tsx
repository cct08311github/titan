"use client";

import { TaskTemplateSection } from "@/app/components/task-template-section";
import { RecurringTaskSection } from "@/app/components/recurring-task-section";

export default function TemplatesPage() {
  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">範本與自動化</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">管理任務範本與週期性任務規則</p>
      </div>
      <TaskTemplateSection />
      <RecurringTaskSection />
    </div>
  );
}
