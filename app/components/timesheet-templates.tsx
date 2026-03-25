"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type TemplateEntry = {
  hours: number;
  category: string;
  taskId?: string;
  description?: string;
};

type Template = {
  id: string;
  name: string;
  entries: string; // JSON array of TemplateEntry
  userId: string;
  createdAt: string;
  updatedAt: string;
};

type TimesheetTemplatesProps = {
  templates: Template[];
  onApply: (entries: TemplateEntry[]) => void;
  onDelete: (templateId: string) => void;
  onSave: (name: string) => void;
};

export function TimesheetTemplates({ templates, onApply, onDelete, onSave }: TimesheetTemplatesProps) {
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");

  function handleApply(template: Template) {
    try {
      const entries: TemplateEntry[] = JSON.parse(template.entries);
      onApply(entries);
    } catch {
      // Invalid JSON — ignore
    }
  }

  function handleSave() {
    if (!saveName.trim()) return;
    onSave(saveName.trim());
    setSaveName("");
    setShowSave(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">我的模板</h3>
        <button
          onClick={() => setShowSave((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent/50"
        >
          儲存為模板
        </button>
      </div>

      {/* Save template form */}
      {showSave && (
        <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="模板名稱"
            className="flex-1 bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <button
            onClick={handleSave}
            className="px-3 py-1.5 bg-accent hover:bg-accent/80 text-accent-foreground text-xs font-medium rounded-md transition-colors"
          >
            確認儲存
          </button>
          <button
            onClick={() => { setShowSave(false); setSaveName(""); }}
            className="px-2 py-1.5 text-muted-foreground hover:text-foreground text-xs rounded-md transition-colors"
          >
            取消
          </button>
        </div>
      )}

      {/* Template list */}
      {templates.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 py-2">尚無模板，點擊「儲存為模板」建立第一個。</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="group relative flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border rounded-lg hover:border-ring/50 hover:bg-accent/30 transition-all cursor-pointer"
            >
              <button
                onClick={() => handleApply(tpl)}
                className="text-xs text-foreground font-medium"
              >
                {tpl.name}
              </button>
              <button
                aria-label="刪除模板"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(tpl.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all ml-1"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
