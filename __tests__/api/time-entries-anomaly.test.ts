/**
 * @jest-environment node
 */
/**
 * TDD tests for anomaly detection in NotificationService (TS-27)
 *
 * Requirements:
 *   - Detect engineers with <5h total for 3+ consecutive work days
 *   - Generate notification for MANAGER when anomaly detected
 *   - Skip weekends in consecutive day calculation
 *
 * Tests written BEFORE implementation (Red phase).
 */

import { NotificationService, NotificationInput } from "@/services/notification-service";

// ── Prisma mock ──────────────────────────────────────────────────────────────
const mockTimeEntry = {
  findMany: jest.fn(),
};
const mockUser = {
  findMany: jest.fn(),
};
const mockNotification = {
  findMany: jest.fn(),
  createMany: jest.fn(),
};

const mockPrisma = {
  timeEntry: mockTimeEntry,
  user: mockUser,
  notification: mockNotification,
} as any;

describe("NotificationService.buildAnomalyNotifications (TS-27)", () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService(mockPrisma);
    mockNotification.findMany.mockResolvedValue([]);
  });

  it("detects engineer with <5h for 3 consecutive work days", async () => {
    const now = new Date("2026-03-25T18:00:00");

    // Calculate actual work days the service will use
    const workDays: Date[] = [];
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    while (workDays.length < 5) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) {
        workDays.unshift(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() - 1);
    }

    // All 5 work days with <5h — guarantees 3+ consecutive
    mockUser.findMany
      .mockResolvedValueOnce([{ id: "eng-1", name: "Engineer A" }])
      .mockResolvedValueOnce([{ id: "mgr-1", name: "Manager" }]);

    mockTimeEntry.findMany.mockResolvedValue(
      workDays.map((d) => ({ userId: "eng-1", date: new Date(d), hours: 2 }))
    );

    const existingKeys = new Set<string>();
    const result = await service.buildAnomalyNotifications(now, existingKeys);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].type).toBe("TIMESHEET_REMINDER");
    expect(result[0].title).toContain("異常");
    expect(result[0].relatedType).toBe("TimeEntry");
  });

  it("does NOT flag engineer with >=5h on all days", async () => {
    const now = new Date("2026-03-25T18:00:00");
    const workDays: Date[] = [];
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    while (workDays.length < 5) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) {
        workDays.unshift(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() - 1);
    }

    mockUser.findMany
      .mockResolvedValueOnce([{ id: "eng-1", name: "Engineer A" }])
      .mockResolvedValueOnce([{ id: "mgr-1", name: "Manager" }]);

    mockTimeEntry.findMany.mockResolvedValue(
      workDays.map((d) => ({ userId: "eng-1", date: new Date(d), hours: 8 }))
    );

    const existingKeys = new Set<string>();
    const result = await service.buildAnomalyNotifications(now, existingKeys);

    expect(result.length).toBe(0);
  });

  it("does NOT flag if consecutive low days broken by a good day", async () => {
    mockUser.findMany
      .mockResolvedValueOnce([{ id: "eng-1", name: "Engineer A" }])
      .mockResolvedValueOnce([{ id: "mgr-1", name: "Manager" }]);

    // Use UTC dates to match service behavior.
    // Lookback 5 work days from now — fill ALL 5 days, with 8h on one to break streak.
    const now = new Date("2026-03-25T18:00:00");
    // Calculate the actual work days the service will use
    const workDays: Date[] = [];
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    while (workDays.length < 5) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) {
        workDays.unshift(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() - 1);
    }

    // Fill all work days with <5h except the middle one (index 2) to break the streak
    const entries = workDays.map((d, i) => ({
      userId: "eng-1",
      date: new Date(d),
      hours: i === 2 ? 8 : 2, // middle day breaks the streak
    }));

    mockTimeEntry.findMany.mockResolvedValue(entries);

    const existingKeys = new Set<string>();
    const result = await service.buildAnomalyNotifications(now, existingKeys);

    // Max consecutive <5h = 2 (before or after the 8h day) — below threshold of 3
    expect(result.length).toBe(0);
  });

  it("notifies MANAGER, not the engineer", async () => {
    const now = new Date("2026-03-25T18:00:00");
    const workDays: Date[] = [];
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    while (workDays.length < 5) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) {
        workDays.unshift(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() - 1);
    }

    mockUser.findMany
      .mockResolvedValueOnce([{ id: "eng-1", name: "Engineer A" }])
      .mockResolvedValueOnce([{ id: "mgr-1", name: "Manager" }]);

    mockTimeEntry.findMany.mockResolvedValue(
      workDays.map((d) => ({ userId: "eng-1", date: new Date(d), hours: 2 }))
    );

    const existingKeys = new Set<string>();
    const result = await service.buildAnomalyNotifications(now, existingKeys);

    // All notifications should go to managers
    expect(result.length).toBeGreaterThan(0);
    for (const n of result) {
      expect(n.userId).toBe("mgr-1");
    }
  });

  it("skips duplicate notifications via existingKeys", async () => {
    const now = new Date("2026-03-25T18:00:00");
    const todayKey = now.toISOString().slice(0, 10);
    const workDays: Date[] = [];
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    while (workDays.length < 5) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) {
        workDays.unshift(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() - 1);
    }

    mockUser.findMany
      .mockResolvedValueOnce([{ id: "eng-1", name: "Engineer A" }])
      .mockResolvedValueOnce([{ id: "mgr-1", name: "Manager" }]);

    mockTimeEntry.findMany.mockResolvedValue(
      workDays.map((d) => ({ userId: "eng-1", date: new Date(d), hours: 2 }))
    );

    // Simulate existing notification
    const existingKeys = new Set<string>([`mgr-1:TIMESHEET_REMINDER:anomaly:eng-1:${todayKey}`]);
    const result = await service.buildAnomalyNotifications(now, existingKeys);

    expect(result.length).toBe(0);
  });
});
