"use client";

/**
 * Session Timeout Warning — Issue #798 (AU-4)
 *
 * Displays a warning modal 5 minutes before session expires.
 * User can click "延長" to extend the session.
 * On timeout, redirects to login page.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";

/** Default session timeout in minutes (overridable by admin settings) */
const DEFAULT_TIMEOUT_MINUTES = 30;
const WARNING_BEFORE_MINUTES = 5;

export function SessionTimeoutWarning() {
  const { data: session, update } = useSession();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef(Date.now());

  const timeoutMs = DEFAULT_TIMEOUT_MINUTES * 60 * 1000;
  const warningMs = (DEFAULT_TIMEOUT_MINUTES - WARNING_BEFORE_MINUTES) * 60 * 1000;

  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Set warning timer
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingSeconds(WARNING_BEFORE_MINUTES * 60);

      // Start countdown
      countdownRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            // Session expired — redirect to login
            window.location.href = "/login?reason=session_timeout";
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, warningMs);

    // Set absolute timeout
    timeoutRef.current = setTimeout(() => {
      window.location.href = "/login?reason=session_timeout";
    }, timeoutMs);
  }, [timeoutMs, warningMs]);

  const handleExtend = useCallback(async () => {
    // Extend session via NextAuth update
    await update();
    resetTimers();
  }, [update, resetTimers]);

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
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [session, resetTimers]);

  if (!session || !showWarning) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-6 shadow-xl max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Session 即將逾時
        </h2>
        <p className="mt-2 text-gray-600">
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
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
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
