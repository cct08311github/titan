/**
 * Client-side API helper — automatically unwraps { ok, data } response format.
 *
 * All TITAN API routes return: { ok: boolean, data: T } or { ok: false, error, message }
 * This helper extracts the `data` field so callers get the payload directly.
 */

export async function apiFetch<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<{ data: T | null; error: string | null; status: number }> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    return {
      data: null,
      error: json?.message ?? json?.error ?? `HTTP ${res.status}`,
      status: res.status,
    };
  }

  // Unwrap { ok, data } envelope
  const data = json?.data !== undefined ? json.data : json;
  return { data, error: null, status: res.status };
}

/**
 * Extract items from API response — handles all formats:
 * - Raw array: [...]
 * - Wrapped: { ok, data: [...] }
 * - Paginated: { ok, data: { items: [...], pagination } }
 */
export function extractItems<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response;
  const data = (response as Record<string, unknown>)?.data;
  if (Array.isArray(data)) return data;
  const items = (data as Record<string, unknown>)?.items;
  if (Array.isArray(items)) return items;
  return [];
}

/**
 * Extract single item from API response:
 * - Raw object: { id, ... }
 * - Wrapped: { ok, data: { id, ... } }
 */
export function extractData<T>(response: unknown): T {
  const obj = response as Record<string, unknown>;
  return (obj?.data !== undefined ? obj.data : obj) as T;
}
