/**
 * TITAN Performance Baseline — k6 Load Test
 * Sprint 2 — Task 18
 *
 * Usage:
 *   k6 run scripts/k6/baseline.js
 *   k6 run scripts/k6/baseline.js --env BASE_URL=https://titan.example.com
 *
 * Scenarios: login, dashboard load, timesheet CRUD
 * Target: API response < 200ms p95
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";

// ── Configuration ───────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "http://localhost:3100";

// Custom metrics
const loginFailRate = new Rate("login_failures");
const timesheetDuration = new Trend("timesheet_crud_duration");

// ── Options ─────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: "30s", target: 5 },   // ramp up to 5 users
    { duration: "1m", target: 10 },   // hold at 10 users
    { duration: "30s", target: 20 },  // spike to 20 users
    { duration: "1m", target: 10 },   // back to 10
    { duration: "30s", target: 0 },   // ramp down
  ],
  thresholds: {
    // Global: p95 response time under 200ms
    "http_req_duration": ["p(95)<200"],
    // Login failures should be under 5%
    "login_failures": ["rate<0.05"],
    // Timesheet CRUD p95 under 200ms
    "timesheet_crud_duration": ["p(95)<200"],
  },
};

// ── Helpers ─────────────────────────────────────────────────
const HEADERS = { "Content-Type": "application/json" };

function getAuthToken() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/callback/credentials`,
    JSON.stringify({
      email: __ENV.TEST_USER || "test@titan.local",
      password: __ENV.TEST_PASS || "TestPassword123!",
    }),
    { headers: HEADERS, redirects: 0 }
  );

  const success = check(loginRes, {
    "login status is 200 or 302": (r) => r.status === 200 || r.status === 302,
  });

  loginFailRate.add(!success);

  // Extract session cookie
  const cookies = loginRes.cookies;
  return cookies;
}

// ── Main Test Function ──────────────────────────────────────
export default function () {
  // ── Scenario 1: Login ───────────────────────────────────
  group("login", () => {
    const loginRes = http.post(
      `${BASE_URL}/api/auth/callback/credentials`,
      JSON.stringify({
        email: __ENV.TEST_USER || "test@titan.local",
        password: __ENV.TEST_PASS || "TestPassword123!",
      }),
      { headers: HEADERS, redirects: 0 }
    );

    check(loginRes, {
      "login responds": (r) => r.status !== 0,
      "login under 500ms": (r) => r.timings.duration < 500,
    });

    sleep(1);
  });

  // ── Scenario 2: Dashboard Load ──────────────────────────
  group("dashboard", () => {
    const dashRes = http.get(`${BASE_URL}/dashboard`, {
      headers: HEADERS,
    });

    check(dashRes, {
      "dashboard loads": (r) => r.status === 200 || r.status === 302,
      "dashboard under 300ms": (r) => r.timings.duration < 300,
    });

    sleep(0.5);
  });

  // ── Scenario 3: Timesheet CRUD ──────────────────────────
  group("timesheet-crud", () => {
    // GET — list time entries
    const listRes = http.get(`${BASE_URL}/api/time-entries`, {
      headers: HEADERS,
    });
    timesheetDuration.add(listRes.timings.duration);

    check(listRes, {
      "list time-entries responds": (r) => r.status !== 0,
    });

    // POST — create time entry
    const createRes = http.post(
      `${BASE_URL}/api/time-entries`,
      JSON.stringify({
        date: new Date().toISOString().split("T")[0],
        hours: 1.5,
        description: "k6 load test entry",
        taskId: __ENV.TEST_TASK_ID || "test-task-1",
      }),
      { headers: HEADERS }
    );
    timesheetDuration.add(createRes.timings.duration);

    check(createRes, {
      "create time-entry responds": (r) => r.status !== 0,
    });

    // If we got an ID back, do PUT and DELETE
    if (createRes.status === 200 || createRes.status === 201) {
      try {
        const body = JSON.parse(createRes.body);
        const entryId = body.id || body.data?.id;

        if (entryId) {
          // PUT — update
          const updateRes = http.put(
            `${BASE_URL}/api/time-entries/${entryId}`,
            JSON.stringify({ hours: 2.0 }),
            { headers: HEADERS }
          );
          timesheetDuration.add(updateRes.timings.duration);

          check(updateRes, {
            "update time-entry responds": (r) => r.status !== 0,
          });

          // DELETE — remove
          const delRes = http.del(
            `${BASE_URL}/api/time-entries/${entryId}`,
            null,
            { headers: HEADERS }
          );
          timesheetDuration.add(delRes.timings.duration);

          check(delRes, {
            "delete time-entry responds": (r) => r.status !== 0,
          });
        }
      } catch (_) {
        // Response wasn't JSON, skip update/delete
      }
    }

    sleep(1);
  });
}
