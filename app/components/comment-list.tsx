"use client";

/**
 * CommentList — Issue #805 (K-3a)
 *
 * Displays task comments in chronological order with:
 * - Markdown rendering (sanitized via sanitizeHtml)
 * - @mention user display
 * - Edit (own, within 5 min) / Delete (own) actions
 * - New comment form with @mention autocomplete
 *
 * Security: All comment content is HTML-escaped first, then Markdown rules are
 * applied, and finally passed through sanitizeHtml() to strip any remaining
 * dangerous tags/attributes. This defense-in-depth approach prevents XSS.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Send, Edit3, Trash2, Loader2, X, AtSign } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractData, extractItems } from "@/lib/api-client";
import { sanitizeHtml } from "@/lib/security/sanitize";
import { useConfirmDialog } from "@/app/components/ui/alert-dialog";

type User = { id: string; name: string; avatar?: string | null };

type Comment = {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: User;
};

interface CommentListProps {
  taskId: string;
  currentUserId?: string;
}

/** 5 minutes in ms */
const EDIT_WINDOW_MS = 5 * 60 * 1000;

function isWithinEditWindow(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < EDIT_WINDOW_MS;
}

/**
 * Render comment markdown to sanitized HTML.
 * Defense-in-depth: HTML-escape first, apply markdown rules, then sanitize output.
 * This ensures no raw HTML from user input can execute.
 */
function renderCommentMarkdown(md: string): string {
  // Step 1: HTML-escape all user content first
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Step 2: Apply markdown formatting rules on escaped content
  html = html
    .replace(/```[\s\S]*?```/g, (m) => {
      const code = m.slice(3, -3).replace(/^\n/, "");
      return `<pre class="bg-muted rounded p-2 text-xs overflow-x-auto my-1"><code>${code}</code></pre>`;
    })
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(
      /@(\S+)/g,
      '<span class="text-primary font-medium bg-primary/10 px-1 rounded">@$1</span>'
    )
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline" rel="noopener noreferrer">$1</a>')
    .replace(/\n/g, "<br />");

  // Step 3: Final sanitization pass to strip any dangerous content
  return sanitizeHtml(html);
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "剛才";
  if (mins < 60) return `${mins} 分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function CommentAvatar({ user }: { user: User }) {
  return (
    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground overflow-hidden flex-shrink-0">
      {user.avatar ? (
        <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
      ) : (
        user.name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

export function CommentList({ taskId, currentUserId }: CommentListProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [showMention, setShowMention] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  // Track which users were inserted via @mention so the server can notify them (#1506).
  // A user removed from the content string is pruned at submit time.
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { confirmDialog, ConfirmDialog } = useConfirmDialog();

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`);
      if (res.ok) {
        const body = await res.json();
        const data = extractData<{ comments: Comment[] }>(body);
        setComments(data?.comments ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchComments();
    // Fetch users for @mention
    fetch("/api/users")
      .then((r) => r.json())
      .then((body) => setUsers(extractItems<User>(body)))
      .catch(() => { toast.warning("使用者清單載入失敗"); });
  }, [fetchComments]);

  // ── @mention handling ─────────────────────────────────────────────────

  function handleTextChange(
    value: string,
    setter: (v: string) => void,
  ) {
    setter(value);

    // Check for @mention trigger
    const cursorPos = textareaRef.current?.selectionStart ?? value.length;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf("@");

    if (lastAtIdx >= 0) {
      const afterAt = textBeforeCursor.substring(lastAtIdx + 1);
      // Only show dropdown if no space after @
      if (!afterAt.includes(" ") && !afterAt.includes("\n")) {
        setShowMention(true);
        setMentionFilter(afterAt);
        return;
      }
    }
    setShowMention(false);
  }

  function insertMention(user: User) {
    const textarea = editingId ? editTextareaRef.current : textareaRef.current;
    const currentValue = editingId ? editContent : newContent;
    const setter = editingId ? setEditContent : setNewContent;

    const cursorPos = textarea?.selectionStart ?? currentValue.length;
    const textBeforeCursor = currentValue.substring(0, cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf("@");

    if (lastAtIdx >= 0) {
      const newValue =
        currentValue.substring(0, lastAtIdx) +
        `@${user.name} ` +
        currentValue.substring(cursorPos);
      setter(newValue);
      // Track the id so the server knows who to notify. Dedupe on insert.
      setMentionedUserIds((prev) => (prev.includes(user.id) ? prev : [...prev, user.id]));
    }
    setShowMention(false);
    textarea?.focus();
  }

  const filteredMentionUsers = users.filter((u) =>
    u.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  // ── CRUD handlers ─────────────────────────────────────────────────────

  async function submitComment() {
    if (!newContent.trim() || sending) return;
    setSending(true);
    try {
      // Prune mentions whose @<name> token was deleted from the content before submit.
      const finalContent = newContent.trim();
      const surviving = mentionedUserIds.filter((uid) => {
        const u = users.find((x) => x.id === uid);
        return u ? finalContent.includes(`@${u.name}`) : false;
      });
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: finalContent,
          mentionedUserIds: surviving.length > 0 ? surviving : undefined,
        }),
      });
      if (res.ok) {
        toast.success("評論已發送");
        setNewContent("");
        setMentionedUserIds([]);
        await fetchComments();
      } else {
        const errBody = await res.json().catch(() => ({}));
        toast.error("發送失敗", { description: errBody?.message });
      }
    } finally {
      setSending(false);
    }
  }

  async function saveEdit(commentId: string) {
    if (!editContent.trim()) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      if (res.ok) {
        toast.success("評論已更新");
        setEditingId(null);
        setEditContent("");
        await fetchComments();
      } else {
        const errBody = await res.json().catch(() => ({}));
        toast.error("編輯失敗", { description: errBody?.message });
      }
    } catch {
      toast.error("編輯失敗");
    }
  }

  async function deleteComment(commentId: string) {
    const ok = await confirmDialog({
      title: "刪除評論",
      description: "確定要刪除此評論？此操作無法復原。",
      confirmLabel: "刪除",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("評論已刪除");
        await fetchComments();
      }
    } catch {
      toast.error("刪除失敗");
    }
  }

  // ── Mention dropdown ──────────────────────────────────────────────────

  function MentionDropdown() {
    if (!showMention || filteredMentionUsers.length === 0) return null;
    return (
      <div className="absolute z-20 bottom-full left-0 mb-1 w-56 bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
        {filteredMentionUsers.slice(0, 10).map((u) => (
          <button
            key={u.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertMention(u)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors text-left"
          >
            <CommentAvatar user={u} />
            <span>{u.name}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        評論 ({comments.length})
      </h3>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Comment list */}
          <div className="space-y-3">
            {comments.map((comment) => {
              const isOwn = comment.userId === currentUserId;
              const canEdit = isOwn && isWithinEditWindow(comment.createdAt);
              const isEditing = editingId === comment.id;
              const wasEdited = comment.updatedAt !== comment.createdAt;

              return (
                <div key={comment.id} className="flex gap-2.5 group">
                  <CommentAvatar user={comment.user} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">
                        {comment.user.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(comment.createdAt)}
                      </span>
                      {wasEdited && (
                        <span className="text-[10px] text-muted-foreground italic">（已編輯）</span>
                      )}
                      {/* Actions */}
                      {isOwn && !isEditing && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                          {canEdit && (
                            <button
                              onClick={() => {
                                setEditingId(comment.id);
                                setEditContent(comment.content);
                              }}
                              className="p-0.5 rounded hover:bg-accent text-muted-foreground"
                              title="編輯"
                              aria-label="編輯評論"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteComment(comment.id)}
                            className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-danger"
                            title="刪除"
                            aria-label="刪除評論"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-1 space-y-1.5">
                        <div className="relative">
                          <textarea
                            ref={editTextareaRef}
                            value={editContent}
                            onChange={(e) => handleTextChange(e.target.value, setEditContent)}
                            className="w-full text-sm bg-background border border-border rounded-lg p-2 resize-none focus:outline-none focus:border-primary"
                            rows={3}
                            maxLength={10000}
                          />
                          <MentionDropdown />
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => saveEdit(comment.id)}
                            className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:opacity-90"
                          >
                            儲存
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditContent("");
                            }}
                            className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="mt-0.5 text-sm text-foreground/90 leading-relaxed"
                        /* Security: content is HTML-escaped first, markdown rules applied,
                           then sanitized via sanitizeHtml() — defense-in-depth XSS prevention */
                        dangerouslySetInnerHTML={{
                          __html: renderCommentMarkdown(comment.content),
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {comments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                尚無評論
              </p>
            )}
          </div>

          {/* New comment form */}
          <div className="border-t border-border pt-3">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={newContent}
                onChange={(e) => handleTextChange(e.target.value, setNewContent)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    submitComment();
                  }
                }}
                placeholder="輸入評論... (支援 Markdown，@ 提及使用者，Ctrl+Enter 送出)"
                rows={3}
                maxLength={10000}
                className="w-full text-sm bg-background border border-border rounded-lg p-3 resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground/60"
              />
              <MentionDropdown />
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <AtSign className="h-3 w-3" />
                <span>輸入 @ 提及使用者</span>
              </div>
              <button
                onClick={submitComment}
                disabled={!newContent.trim() || sending}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all",
                  "bg-primary text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-40"
                )}
              >
                {sending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                送出
              </button>
            </div>
          </div>
        </>
      )}
      <ConfirmDialog />
    </div>
  );
}
