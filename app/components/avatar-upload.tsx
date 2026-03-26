"use client";

/**
 * AvatarUpload — Issue #845 (S-1)
 *
 * Avatar upload with:
 * - JPG/PNG only, <=2MB
 * - Client-side preview before upload
 * - Server-side magic bytes validation
 * - Remove avatar support
 */

import { useState, useRef } from "react";
import { Camera, Trash2, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  userId: string;
  currentAvatar: string | null;
  onAvatarChange: (newAvatar: string | null) => void;
}

const AVATAR_MAX_MB = 2;
const AVATAR_MAX_BYTES = AVATAR_MAX_MB * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);

export function AvatarUpload({ userId, currentAvatar, onAvatarChange }: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayAvatar = preview ?? currentAvatar;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Client-side validation
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("僅接受 JPG/PNG 格式");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError(`檔案大小超過 ${AVATAR_MAX_MB}MB 上限`);
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    uploadAvatar(file);
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch(`/api/users/${userId}/avatar`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message ?? "上傳失敗");
        setPreview(null);
        return;
      }

      const body = await res.json();
      const newAvatar = body?.data?.avatar ?? null;
      onAvatarChange(newAvatar);
    } catch {
      setError("上傳失敗，請稍後再試");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}/avatar`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPreview(null);
        onAvatarChange(null);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-foreground">
        頭像
      </label>
      <div className="flex items-center gap-4">
        {/* Avatar display */}
        <div className="relative group">
          <div
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center overflow-hidden border-2 border-border",
              displayAvatar ? "" : "bg-muted"
            )}
          >
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt="頭像"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="h-8 w-8 text-muted-foreground" />
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" />
            {currentAvatar ? "更換頭像" : "上傳頭像"}
          </button>
          {currentAvatar && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive border border-border rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              移除頭像
            </button>
          )}
          <p className="text-[10px] text-muted-foreground">
            JPG/PNG，最大 {AVATAR_MAX_MB}MB
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
