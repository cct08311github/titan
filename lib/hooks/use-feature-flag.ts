"use client";

/**
 * useFeatureFlag — Issue #988
 *
 * Client-side hook to read feature flags from /api/admin/feature-flags.
 * Caches the result to avoid repeated fetches within same page lifecycle.
 */

import { useState, useEffect } from "react";

type FlagName = string;

let cachedFlags: Record<FlagName, boolean> | null = null;
let fetchPromise: Promise<Record<FlagName, boolean>> | null = null;

async function fetchFlags(): Promise<Record<FlagName, boolean>> {
  if (cachedFlags) return cachedFlags;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch("/api/admin/feature-flags")
    .then(async (res) => {
      if (!res.ok) return {};
      const body = await res.json();
      const flags = body.data?.flags ?? {};
      cachedFlags = flags;
      return flags;
    })
    .catch(() => ({}))
    .finally(() => {
      fetchPromise = null;
    });

  return fetchPromise;
}

/** Reset cache — useful for testing or after admin updates a flag */
export function resetFeatureFlagCache() {
  cachedFlags = null;
  fetchPromise = null;
}

export function useFeatureFlag(name: FlagName): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchFlags().then((flags) => {
      if (!cancelled) {
        setEnabled(flags[name] ?? false);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [name]);

  return { enabled, loading };
}
