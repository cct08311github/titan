import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Session {
  id: string;
  userId: string;
  createdAt: number;
  lastActivityAt: number;
}

export interface SessionConfig {
  /** Milliseconds of inactivity before a session is considered idle-timed-out. Default: 30 min */
  idleTimeoutMs: number;
  /** Maximum number of concurrent sessions allowed per user. Default: 3 */
  maxConcurrentSessions: number;
}

// ---------------------------------------------------------------------------
// Default configuration values
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: SessionConfig = {
  idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
  maxConcurrentSessions: 3,
};

// ---------------------------------------------------------------------------
// SessionService
//
// In-memory session store with:
//   1. Server-side 30-minute idle timeout (based on last API call timestamp)
//   2. Maximum 3 concurrent sessions per user — oldest (by createdAt) is evicted
//      when the limit would be exceeded
// ---------------------------------------------------------------------------

export class SessionService {
  private readonly sessions = new Map<string, Session>();
  private readonly config: SessionConfig;

  constructor(config: Partial<SessionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -------------------------------------------------------------------------
  // Core helpers
  // -------------------------------------------------------------------------

  /** Check whether a session has exceeded the idle timeout. */
  isTimedOut(session: Session): boolean {
    return Date.now() - session.lastActivityAt >= this.config.idleTimeoutMs;
  }

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  /**
   * Create a new session for the given user.
   * If the user already has `maxConcurrentSessions` sessions, the oldest one
   * (by `createdAt`) is evicted before the new session is stored.
   */
  createSession(userId: string): Session {
    const now = Date.now();
    const session: Session = {
      id: randomUUID(),
      userId,
      createdAt: now,
      lastActivityAt: now,
    };

    this._evictOldestIfNeeded(userId);
    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Register a session that was constructed externally (useful in tests to
   * inject sessions with specific timestamps).
   * Eviction rules still apply.
   */
  registerSession(session: Session): void {
    this._evictOldestIfNeeded(session.userId);
    this.sessions.set(session.id, session);
  }

  /** Retrieve a session by ID regardless of its timeout status. */
  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /**
   * Retrieve a session only if it has not timed out.
   * Timed-out sessions are auto-evicted on access.
   */
  getActiveSession(id: string): Session | null {
    const session = this.sessions.get(id);
    if (!session) return null;
    if (this.isTimedOut(session)) {
      this.sessions.delete(id);
      return null;
    }
    return session;
  }

  /**
   * Update `lastActivityAt` to the current time (call this on every API
   * request to keep the session alive).
   * Returns the updated session, or null if the session does not exist.
   */
  touchSession(id: string): Session | null {
    const session = this.sessions.get(id);
    if (!session) return null;
    const updated: Session = { ...session, lastActivityAt: Date.now() };
    this.sessions.set(id, updated);
    return updated;
  }

  /** Remove a session explicitly (e.g. on logout). */
  destroySession(id: string): void {
    this.sessions.delete(id);
  }

  /**
   * Return all non-timed-out sessions for the given user.
   * Stale sessions encountered during iteration are evicted.
   */
  getUserSessions(userId: string): Session[] {
    const active: Session[] = [];
    for (const session of this.sessions.values()) {
      if (session.userId !== userId) continue;
      if (this.isTimedOut(session)) {
        this.sessions.delete(session.id);
      } else {
        active.push(session);
      }
    }
    return active;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _evictOldestIfNeeded(userId: string): void {
    const userSessions = Array.from(this.sessions.values()).filter(
      (s) => s.userId === userId
    );

    if (userSessions.length < this.config.maxConcurrentSessions) return;

    // Sort ascending by createdAt — evict the oldest
    userSessions.sort((a, b) => a.createdAt - b.createdAt);
    const toEvict = userSessions.slice(
      0,
      userSessions.length - this.config.maxConcurrentSessions + 1
    );
    for (const s of toEvict) {
      this.sessions.delete(s.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Exported default configuration (used by auth config)
// ---------------------------------------------------------------------------

export const SESSION_CONFIG: SessionConfig = DEFAULT_CONFIG;
