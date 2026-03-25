"use client";

import { useState } from "react";
import { MessageSquarePlus, X, Send, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(false);

  async function handleSubmit() {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      setMessage("");
      setOpen(false);
      setToast(true);
      setTimeout(() => setToast(false), 3000);
    } catch {
      // Silently fail — feedback is non-critical
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="意見回饋"
        className={cn(
          "fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg",
          "hover:opacity-90 hover:shadow-xl transition-all duration-200",
          "flex items-center justify-center",
          open && "hidden"
        )}
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-card rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">意見回饋</h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="關閉"
                className="p-1 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Textarea */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="請描述您的建議、問題或想法..."
              rows={4}
              className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground"
              autoFocus
            />

            {/* Submit */}
            <div className="flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || sending}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  message.trim()
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <Send className="h-3.5 w-3.5" />
                {sending ? "送出中..." : "送出"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-success/10 text-success border border-success/30 rounded-lg px-4 py-2.5 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="h-4 w-4" />
          <span className="text-sm font-medium">感謝您的回饋！</span>
        </div>
      )}
    </>
  );
}
