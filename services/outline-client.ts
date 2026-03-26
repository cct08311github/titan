/**
 * Outline API client — KB-1 (#840)
 *
 * Communicates with Outline wiki API for document listing, retrieval, and search.
 * Features:
 * - Configurable timeout (default 5s) and retry (default 2 attempts)
 * - API token from env (never exposed to frontend)
 * - Graceful error handling with typed errors
 */

import { getOutlineConfig, type OutlineConfig } from "@/config/outline";

// ── Types ──────────────────────────────────────────────────────────────────

export interface OutlineDocument {
  id: string;
  title: string;
  text: string;
  parentDocumentId: string | null;
  collectionId: string;
  publishedAt: string | null;
  updatedAt: string;
  createdBy: { id: string; name: string };
  updatedBy: { id: string; name: string };
}

export interface OutlineDocumentListItem {
  id: string;
  title: string;
  parentDocumentId: string | null;
  collectionId: string;
  updatedAt: string;
}

export interface OutlineSearchResult {
  document: OutlineDocumentListItem;
  context: string;
  ranking: number;
}

export class OutlineApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly isTimeout: boolean = false,
  ) {
    super(message);
    this.name = "OutlineApiError";
  }
}

// ── Client ─────────────────────────────────────────────────────────────────

export class OutlineClient {
  private readonly config: OutlineConfig;

  constructor(config?: OutlineConfig) {
    this.config = config ?? getOutlineConfig();
  }

  get isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Internal fetch with timeout and retry logic.
   */
  private async fetchWithRetry(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const url = `${this.config.baseUrl}/api${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiToken}`,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new OutlineApiError(
            `Outline API error: ${res.status} ${res.statusText}`,
            res.status,
          );
        }

        return await res.json();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          lastError = new OutlineApiError("Outline API timeout", undefined, true);
        } else if (err instanceof OutlineApiError) {
          lastError = err;
          // Don't retry 4xx errors
          if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
            throw err;
          }
        } else {
          lastError = err instanceof Error ? err : new Error(String(err));
        }

        // Wait before retry (exponential backoff: 500ms, 1000ms)
        if (attempt < this.config.maxRetries) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }

    throw lastError ?? new OutlineApiError("Outline API request failed");
  }

  /**
   * List documents (tree structure).
   */
  async listDocuments(collectionId?: string): Promise<OutlineDocumentListItem[]> {
    const body: Record<string, unknown> = {};
    if (collectionId) body.collectionId = collectionId;

    const result = await this.fetchWithRetry("/documents.list", body) as {
      data: OutlineDocumentListItem[];
    };
    return result.data ?? [];
  }

  /**
   * Get a single document by ID.
   */
  async getDocument(id: string): Promise<OutlineDocument> {
    const result = await this.fetchWithRetry("/documents.info", { id }) as {
      data: OutlineDocument;
    };
    return result.data;
  }

  /**
   * Search documents by query string.
   */
  async searchDocuments(query: string): Promise<OutlineSearchResult[]> {
    const result = await this.fetchWithRetry("/documents.search", { query }) as {
      data: OutlineSearchResult[];
    };
    return result.data ?? [];
  }

  /**
   * List collections.
   */
  async listCollections(): Promise<Array<{ id: string; name: string; description: string }>> {
    const result = await this.fetchWithRetry("/collections.list") as {
      data: Array<{ id: string; name: string; description: string }>;
    };
    return result.data ?? [];
  }
}

/** Singleton instance */
let _client: OutlineClient | null = null;

export function getOutlineClient(): OutlineClient {
  if (!_client) {
    _client = new OutlineClient();
  }
  return _client;
}
