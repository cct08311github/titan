/**
 * TITAN Performance Smoke Test — k6 Script
 * ==========================================
 * Issue #381: Performance regression testing
 *
 * 快速煙霧測試，用於 CI pipeline 偵測效能退化。
 * 單一虛擬使用者、30 秒執行，嚴格 threshold。
 *
 * 使用方式：
 *   k6 run tests/load/smoke.js
 *
 * 環境變數：
 *   BASE_URL  — TITAN URL（預設 http://localhost:3000）
 *   USERNAME  — 測試帳號（預設 admin）
 *   PASSWORD  — 測試密碼（預設 changeme）
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate } from "k6/metrics";

// ── 自訂指標 ──────────────────────────────────────────────
const errorRate = new Rate("errors");

// ── 設定 ──────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const USERNAME = __ENV.USERNAME || "admin";
const PASSWORD = __ENV.PASSWORD || "changeme";

export const options = {
  // Smoke test: 1 VU, 30 seconds
  vus: 1,
  duration: "30s",

  // Strict thresholds for CI — fail fast on regression
  thresholds: {
    http_req_duration: [
      { threshold: "p(95)<1500", abortOnFail: true, delayAbortEval: "10s" },
    ],
    http_req_failed: [
      { threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "10s" },
    ],
    errors: ["rate<0.01"],
  },
};

// ── 輔助函式 ──────────────────────────────────────────────
function getHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

function checkOk(res, name) {
  const ok = check(res, {
    [`${name}: status 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${name}: response time < 1.5s`]: (r) => r.timings.duration < 1500,
  });
  errorRate.add(!ok);
  return ok;
}

// ── 主流程 ────────────────────────────────────────────────
export default function () {
  // 1. Login
  let token = null;
  group("Login", () => {
    const res = http.post(
      `${BASE_URL}/api/auth/callback/credentials`,
      JSON.stringify({ username: USERNAME, password: PASSWORD }),
      { headers: getHeaders(), tags: { scenario: "smoke_login" } }
    );
    checkOk(res, "login");
    try {
      const body = JSON.parse(res.body);
      token = body.token || body.accessToken || null;
    } catch (_) {}
  });

  sleep(0.5);

  // 2. Dashboard API calls
  group("Dashboard APIs", () => {
    const endpoints = [
      { url: `${BASE_URL}/api/tasks?limit=5`, name: "tasks" },
      { url: `${BASE_URL}/api/notifications?limit=3`, name: "notifications" },
      { url: `${BASE_URL}/api/kpi`, name: "kpi" },
    ];

    for (const ep of endpoints) {
      const res = http.get(ep.url, {
        headers: getHeaders(token),
        tags: { scenario: "smoke_dashboard" },
      });
      checkOk(res, ep.name);
    }
  });

  sleep(0.5);

  // 3. Reports
  group("Reports", () => {
    const res = http.get(`${BASE_URL}/api/reports/trends?metric=kpi&years=${new Date().getFullYear()}`, {
      headers: getHeaders(token),
      tags: { scenario: "smoke_reports" },
    });
    checkOk(res, "trends_report");
  });

  sleep(1);
}
