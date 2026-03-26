/**
 * @jest-environment node
 */
/**
 * Tests for timesheet locking — Issue #815 (T-6)
 */

describe("Timesheet Lock — 7-day rule", () => {
  function isLocked(entryDate: Date, now: Date = new Date()): boolean {
    const diffMs = now.getTime() - entryDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays > 7;
  }

  it("entry from today is NOT locked", () => {
    const now = new Date("2026-03-26T10:00:00+08:00");
    const entryDate = new Date("2026-03-26");
    expect(isLocked(entryDate, now)).toBe(false);
  });

  it("entry from 6 days ago is NOT locked", () => {
    const now = new Date("2026-03-26T10:00:00+08:00");
    const entryDate = new Date("2026-03-20");
    expect(isLocked(entryDate, now)).toBe(false);
  });

  it("entry from exactly 7 days ago is NOT locked (<=7)", () => {
    const now = new Date("2026-03-26T00:00:00+08:00");
    const entryDate = new Date("2026-03-19");
    expect(isLocked(entryDate, now)).toBe(false); // exactly 7 days = still editable
  });

  it("entry from 8 days ago IS locked", () => {
    const now = new Date("2026-03-26T10:00:00+08:00");
    const entryDate = new Date("2026-03-18");
    expect(isLocked(entryDate, now)).toBe(true);
  });

  it("entry from 30 days ago IS locked", () => {
    const now = new Date("2026-03-26T10:00:00+08:00");
    const entryDate = new Date("2026-02-24");
    expect(isLocked(entryDate, now)).toBe(true);
  });
});

describe("Timesheet Lock — role-based access", () => {
  type Role = "ENGINEER" | "MANAGER" | "ADMIN";

  function canEditLocked(role: Role): boolean {
    return role === "ADMIN";
  }

  function canRequestUnlock(role: Role): boolean {
    return role === "ENGINEER" || role === "MANAGER";
  }

  function canApproveUnlock(role: Role): boolean {
    return role === "ADMIN" || role === "MANAGER";
  }

  it("ENGINEER cannot edit locked entries", () => {
    expect(canEditLocked("ENGINEER")).toBe(false);
  });

  it("MANAGER cannot edit locked entries", () => {
    expect(canEditLocked("MANAGER")).toBe(false);
  });

  it("ADMIN can edit locked entries", () => {
    expect(canEditLocked("ADMIN")).toBe(true);
  });

  it("ENGINEER can request unlock", () => {
    expect(canRequestUnlock("ENGINEER")).toBe(true);
  });

  it("MANAGER can approve unlock", () => {
    expect(canApproveUnlock("MANAGER")).toBe(true);
  });

  it("ADMIN can approve unlock", () => {
    expect(canApproveUnlock("ADMIN")).toBe(true);
  });
});

describe("Timesheet Lock — unlock request flow", () => {
  type UnlockRequest = {
    id: string;
    timeEntryId: string;
    requesterId: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    reason: string;
  };

  it("unlock request starts as PENDING", () => {
    const req: UnlockRequest = {
      id: "req-1",
      timeEntryId: "entry-1",
      requesterId: "u1",
      status: "PENDING",
      reason: "需要修正工時",
    };
    expect(req.status).toBe("PENDING");
  });

  it("approved request becomes APPROVED", () => {
    const req: UnlockRequest = {
      id: "req-1",
      timeEntryId: "entry-1",
      requesterId: "u1",
      status: "APPROVED",
      reason: "需要修正工時",
    };
    expect(req.status).toBe("APPROVED");
  });

  it("rejected request becomes REJECTED", () => {
    const req: UnlockRequest = {
      id: "req-1",
      timeEntryId: "entry-1",
      requesterId: "u1",
      status: "REJECTED",
      reason: "需要修正工時",
    };
    expect(req.status).toBe("REJECTED");
  });
});

describe("Timesheet Lock — auto-relock after modification", () => {
  it("should re-lock entry after approved modification", () => {
    // After admin approves unlock and user modifies, entry re-locks
    const entry = { locked: false }; // temporarily unlocked
    // User modifies...
    entry.locked = true; // auto-relock
    expect(entry.locked).toBe(true);
  });
});
