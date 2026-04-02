"use client";

/**
 * Session Timeout Warning — Issue #798 (AU-4), enhanced by Issue #1137
 *
 * Displays a warning modal 5 minutes before session expires.
 * User can click "延長" to extend the session.
 * On timeout, redirects to login page.
 *
 * Cross-tab sync via BroadcastChannel (Issue #1137):
 * - When a tab extends the session, all tabs reset their timers.
 * - When a tab times out, all tabs redirect to login.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";

/** Default session timeout in minutes (overridable by admin settings) */
const DEFAULT_TIMEOUT_MINUTES = 30;
const WARNING_BEFORE_MINUTES = 5;

/** BroadcastChannel name for cross-tab session sync */
const CHANNEL_NAME = "titan-session-sync";

type SyncMessage =
  | { type: "session_extended" }
  | { type: "session_timeout" };

export function SessionTimeoutWarning() {
  const { data: session, update } = useSession();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef(Date.now());
  const channelRef = useRef<BroadcastChannel | null>(null);

  const timeoutMs = DEFAULT_TIMEOUT_MINUTES * 60 * 1000;
  const warningMs = (DEFAULT_TIMEOUT_MINUTES - WARNING_BEFORE_MINUTES) * 60 * 1000;

  /** Broadcast a message to other tabs (no-op if BroadcastChannel unavailable) */
  const broadcast = useCallback((msg: SyncMessage) => {
    try {
      channelRef.current?.postMessage(msg);
    } catch {
      // Silently ignore — channel may be closed
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const redirectToLogin = useCallback(() => {
    window.location.href = "/login?reason=session_timeout";
  }, []);

  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    clearAllTimers();

    // Set warning timer
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingSeconds(WARNING_BEFORE_MINUTES * 60);

      // Start countdown
      countdownRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            broadcast({ type: "session_timeout" });
            redirectToLogin();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, warningMs);

    // Set absolute timeout
    timeoutRef.current = setTimeout(() => {
      broadcast({ type: "session_timeout" });
      redirectToLogin();
    }, timeoutMs);
  }, [timeoutMs, warningMs, clearAllTimers, broadcast, redirectToLogin]);

  const handleExtend = useCallback(async () => {
    // Extend session via NextAuth update
    await update();
    resetTimers();
    broadcast({ type: "session_extended" });
  }, [update, resetTimers, broadcast]);

  // BroadcastChannel setup for cross-tab sync
  useEffect(() => {
    // SSR safety: BroadcastChannel is browser-only
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      const msg = event.data;
      if (msg.type === "session_extended") {
        // Another tab extended the session — reset our timers
        resetTimers();
      } else if (msg.type === "session_timeout") {
        // Another tab detected timeout — redirect immediately
        clearAllTimers();
        redirectToLogin();
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [resetTimers, clearAllTimers, redirectToLogin]);

  // Track user activity
  useEffect(() => {
    if (!session) return;

    const onActivity = () => {
      const now = Date.now();
      // Only reset if more than 1 minute since last reset (debounce)
      if (now - lastActivityRef.current > 60000) {
        resetTimers();
      }
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, onActivity));

    resetTimers();

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearAllTimers();
    };
  }, [session, resetTimers, clearAllTimers]);

  if (!session || !showWarning) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Session 即將逾時
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          您的 Session 將在{" "}
          <span className="font-mono font-bold text-red-600">
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>{" "}
          後逾時。是否要延長？
        </p>
        <div className="mt-4 flex gap-3 justify-end">
          <button
            onClick={() => {
              window.location.href = "/login";
            }}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            登出
          </button>
          <button
            onClick={handleExtend}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            延長 Session
          </button>
        </div>
      </div>
    </div>
  );
}
