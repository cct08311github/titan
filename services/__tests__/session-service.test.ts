import { SessionService, Session, SessionConfig } from "../session-service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    idleTimeoutMs: 30 * 60 * 1000, // 30 min
    maxConcurrentSessions: 3,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

describe("SessionService.createSession", () => {
  it("returns a new session with correct userId and fresh lastActivityAt", () => {
    const svc = new SessionService(makeConfig());
    const before = Date.now();
    const session = svc.createSession("user-1");
    const after = Date.now();

    expect(session.userId).toBe("user-1");
    expect(session.id).toBeTruthy();
    expect(session.lastActivityAt).toBeGreaterThanOrEqual(before);
    expect(session.lastActivityAt).toBeLessThanOrEqual(after);
  });

  it("generates unique session IDs for successive calls", () => {
    const svc = new SessionService(makeConfig());
    const s1 = svc.createSession("user-1");
    const s2 = svc.createSession("user-1");
    expect(s1.id).not.toBe(s2.id);
  });
});

// ---------------------------------------------------------------------------
// Idle timeout (30-minute server-side, based on last API call)
// ---------------------------------------------------------------------------

describe("SessionService — idle timeout", () => {
  it("considers a fresh session as NOT timed out", () => {
    const svc = new SessionService(makeConfig());
    const session = svc.createSession("user-1");
    expect(svc.isTimedOut(session)).toBe(false);
  });

  it("considers a session idle for < 30 min as NOT timed out", () => {
    const svc = new SessionService(makeConfig());
    const session = svc.createSession("user-1");
    // Simulate 29 min 59 s elapsed
    const almostTimeout: Session = {
      ...session,
      lastActivityAt: Date.now() - (30 * 60 * 1000 - 1000),
    };
    expect(svc.isTimedOut(almostTimeout)).toBe(false);
  });

  it("considers a session idle for exactly 30 min as timed out", () => {
    const svc = new SessionService(makeConfig());
    const session = svc.createSession("user-1");
    const exactly30: Session = {
      ...session,
      lastActivityAt: Date.now() - 30 * 60 * 1000,
    };
    expect(svc.isTimedOut(exactly30)).toBe(true);
  });

  it("considers a session idle for > 30 min as timed out", () => {
    const svc = new SessionService(makeConfig());
    const session = svc.createSession("user-1");
    const over30: Session = {
      ...session,
      lastActivityAt: Date.now() - 31 * 60 * 1000,
    };
    expect(svc.isTimedOut(over30)).toBe(true);
  });

  it("touchSession resets lastActivityAt and prevents timeout", () => {
    const svc = new SessionService(makeConfig());
    const session = svc.createSession("user-1");
    // Age the session past 30 min
    const aged: Session = {
      ...session,
      lastActivityAt: Date.now() - 31 * 60 * 1000,
    };
    svc.registerSession(aged);
    expect(svc.isTimedOut(svc.getSession(aged.id)!)).toBe(true);

    const before = Date.now();
    const refreshed = svc.touchSession(aged.id);
    const after = Date.now();

    expect(refreshed).not.toBeNull();
    expect(refreshed!.lastActivityAt).toBeGreaterThanOrEqual(before);
    expect(refreshed!.lastActivityAt).toBeLessThanOrEqual(after);
    expect(svc.isTimedOut(refreshed!)).toBe(false);
  });

  it("touchSession returns null for an unknown session ID", () => {
    const svc = new SessionService(makeConfig());
    expect(svc.touchSession("no-such-id")).toBeNull();
  });

  it("getActiveSession returns null if the session has timed out", () => {
    const svc = new SessionService(makeConfig());
    const session = svc.createSession("user-1");
    const timedOut: Session = {
      ...session,
      lastActivityAt: Date.now() - 31 * 60 * 1000,
    };
    svc.registerSession(timedOut);
    expect(svc.getActiveSession(timedOut.id)).toBeNull();
  });

  it("getActiveSession auto-evicts timed-out sessions", () => {
    const svc = new SessionService(makeConfig());
    const session = svc.createSession("user-1");
    const timedOut: Session = {
      ...session,
      lastActivityAt: Date.now() - 31 * 60 * 1000,
    };
    svc.registerSession(timedOut);
    svc.getActiveSession(timedOut.id); // triggers eviction
    expect(svc.getSession(timedOut.id)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Max 3 concurrent sessions per user — kick oldest
// ---------------------------------------------------------------------------

describe("SessionService — max concurrent sessions per user", () => {
  it("allows up to maxConcurrentSessions without eviction", () => {
    const svc = new SessionService(makeConfig({ maxConcurrentSessions: 3 }));
    const s1 = svc.createSession("user-A");
    const s2 = svc.createSession("user-A");
    const s3 = svc.createSession("user-A");

    expect(svc.getSession(s1.id)).toBeDefined();
    expect(svc.getSession(s2.id)).toBeDefined();
    expect(svc.getSession(s3.id)).toBeDefined();
    expect(svc.getUserSessions("user-A")).toHaveLength(3);
  });

  it("evicts the oldest session when a 4th is created", () => {
    const svc = new SessionService(makeConfig({ maxConcurrentSessions: 3 }));
    const s1 = svc.createSession("user-A");
    const s2 = svc.createSession("user-A");
    const s3 = svc.createSession("user-A");
    const s4 = svc.createSession("user-A");

    // Oldest (s1) should be gone
    expect(svc.getSession(s1.id)).toBeUndefined();
    // Remaining sessions should survive
    expect(svc.getSession(s2.id)).toBeDefined();
    expect(svc.getSession(s3.id)).toBeDefined();
    expect(svc.getSession(s4.id)).toBeDefined();
    expect(svc.getUserSessions("user-A")).toHaveLength(3);
  });

  it("evicts oldest two sessions when 5th and 6th are created sequentially", () => {
    const svc = new SessionService(makeConfig({ maxConcurrentSessions: 3 }));
    const s1 = svc.createSession("user-A");
    const s2 = svc.createSession("user-A");
    const s3 = svc.createSession("user-A");
    const s4 = svc.createSession("user-A"); // evicts s1
    const s5 = svc.createSession("user-A"); // evicts s2

    expect(svc.getSession(s1.id)).toBeUndefined();
    expect(svc.getSession(s2.id)).toBeUndefined();
    expect(svc.getSession(s3.id)).toBeDefined();
    expect(svc.getSession(s4.id)).toBeDefined();
    expect(svc.getSession(s5.id)).toBeDefined();
  });

  it("does NOT evict sessions belonging to other users", () => {
    const svc = new SessionService(makeConfig({ maxConcurrentSessions: 3 }));
    const sa1 = svc.createSession("user-A");
    const sb1 = svc.createSession("user-B");
    const sa2 = svc.createSession("user-A");
    const sb2 = svc.createSession("user-B");
    const sa3 = svc.createSession("user-A");
    const sa4 = svc.createSession("user-A"); // evicts sa1, not any of user-B's

    expect(svc.getSession(sa1.id)).toBeUndefined();
    expect(svc.getSession(sb1.id)).toBeDefined();
    expect(svc.getSession(sb2.id)).toBeDefined();
    expect(svc.getUserSessions("user-A")).toHaveLength(3);
    expect(svc.getUserSessions("user-B")).toHaveLength(2);
  });

  it("evicts by createdAt (oldest first), not by lastActivityAt", () => {
    const svc = new SessionService(makeConfig({ maxConcurrentSessions: 3 }));
    // Manually register sessions with specific createdAt values
    const old: Session = {
      id: "old-session",
      userId: "user-X",
      createdAt: Date.now() - 5000,
      lastActivityAt: Date.now(), // recently touched
    };
    const mid: Session = {
      id: "mid-session",
      userId: "user-X",
      createdAt: Date.now() - 3000,
      lastActivityAt: Date.now() - 4000, // least recently touched
    };
    const young: Session = {
      id: "young-session",
      userId: "user-X",
      createdAt: Date.now() - 1000,
      lastActivityAt: Date.now() - 2000,
    };

    svc.registerSession(old);
    svc.registerSession(mid);
    svc.registerSession(young);

    // Adding a 4th should evict the oldest by createdAt (old-session)
    svc.createSession("user-X");

    expect(svc.getSession("old-session")).toBeUndefined();
    expect(svc.getSession("mid-session")).toBeDefined();
    expect(svc.getSession("young-session")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// destroySession
// ---------------------------------------------------------------------------

describe("SessionService.destroySession", () => {
  it("removes a session so it can no longer be retrieved", () => {
    const svc = new SessionService(makeConfig());
    const session = svc.createSession("user-1");
    svc.destroySession(session.id);
    expect(svc.getSession(session.id)).toBeUndefined();
  });

  it("is a no-op for non-existent session IDs", () => {
    const svc = new SessionService(makeConfig());
    expect(() => svc.destroySession("ghost")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getUserSessions
// ---------------------------------------------------------------------------

describe("SessionService.getUserSessions", () => {
  it("returns empty array when user has no sessions", () => {
    const svc = new SessionService(makeConfig());
    expect(svc.getUserSessions("nobody")).toEqual([]);
  });

  it("returns only active (non-timed-out) sessions", () => {
    const svc = new SessionService(makeConfig());
    const active = svc.createSession("user-Z");
    const timedOut: Session = {
      id: "stale",
      userId: "user-Z",
      createdAt: Date.now() - 40 * 60 * 1000,
      lastActivityAt: Date.now() - 31 * 60 * 1000,
    };
    svc.registerSession(timedOut);

    const sessions = svc.getUserSessions("user-Z");
    const ids = sessions.map((s) => s.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain("stale");
  });
});
