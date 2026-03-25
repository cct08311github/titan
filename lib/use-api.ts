"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Unified API fetch hook with automatic error handling.
 *
 * Handles common HTTP status codes:
 *   401 → redirect to /login
 *   403 → sets error "權限不足"
 *   429 → sets error with retry info
 *   4xx → sets error message from response body
 *   5xx → sets generic server error message
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApi<Task[]>("/api/tasks");
 *   const { data, loading, error, refetch } = useApi<KPI[]>("/api/kpi?year=2026");
 */

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface ApiErrorResponse {
  ok: false;
  error?: string;
  message?: string;
}

export function useApi<T = unknown>(
  url: string | null,
  options?: RequestInit
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) {
      setLoading(false);
      return;
    }

    // Abort any in-flight request
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      // ── Handle error status codes ─────────────────────────────
      if (!response.ok) {
        // 401 Unauthorized → redirect to login
        if (response.status === 401) {
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
          return;
        }

        // 403 Forbidden
        if (response.status === 403) {
          setError("權限不足：您沒有存取此資源的權限");
          setData(null);
          return;
        }

        // 429 Too Many Requests
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const retryMsg = retryAfter
            ? `請求過於頻繁，請在 ${retryAfter} 秒後重試`
            : "請求過於頻繁，請稍後重試";
          setError(retryMsg);
          setData(null);
          return;
        }

        // Other errors — try to extract message from response body
        let message = `伺服器回應錯誤 (${response.status})`;
        try {
          const body = (await response.json()) as ApiErrorResponse;
          if (body.message) {
            message = body.message;
          }
        } catch {
          // Response body is not JSON — use default message
        }
        setError(message);
        setData(null);
        return;
      }

      // ── Success ───────────────────────────────────────────────
      const body = await response.json();
      // TITAN API wraps data in { ok: true, data: ... }
      const payload = body?.data !== undefined ? body.data : body;
      setData(payload as T);
      setError(null);
    } catch (err: unknown) {
      // Ignore abort errors (caused by cleanup / refetch)
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError("網路錯誤：無法連線至伺服器");
      setData(null);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [url, options]);

  useEffect(() => {
    fetchData();
    return () => {
      controllerRef.current?.abort();
    };
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}
