/**
 * TITAN Load Test Baseline — k6 Script
 * ======================================
 * 目標：模擬 5 人團隊日常操作的負載基準測試
 *
 * 使用方式（需安裝 k6）：
 *   k6 run tests/load/baseline.js
 *
 * 環境變數：
 *   BASE_URL  — TITAN 應用程式 URL（預設 http://localhost:3000）
 *   USERNAME  — 測試帳號（預設 admin）
 *   PASSWORD  — 測試密碼（預設 changeme）
 *
 * 情境設定：
 *   - 5 名虛擬使用者（VUs）
 *   - 暖機 30 秒 → 穩態 2 分鐘 → 降載 30 秒
 *   - 總測試時間約 3 分鐘
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ── 自訂指標 ──────────────────────────────────────────────
const errorRate = new Rate("errors");
const loginDuration = new Trend("login_duration", true);
const dashboardDuration = new Trend("dashboard_duration", true);
const taskListDuration = new Trend("task_list_duration", true);
const taskCreateDuration = new Trend("task_create_duration", true);
const taskUpdateDuration = new Trend("task_update_duration", true);
const taskDeleteDuration = new Trend("task_delete_duration", true);
const reportDuration = new Trend("report_duration", true);
const kpiDuration = new Trend("kpi_duration", true);

// ── 設定 ──────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const USERNAME = __ENV.USERNAME || "admin";
const PASSWORD = __ENV.PASSWORD || "changeme";

export const options = {
  stages: [
    { duration: "30s", target: 5 },  // 暖機：0 → 5 VUs
    { duration: "2m", target: 5 },   // 穩態：維持 5 VUs
    { duration: "30s", target: 0 },  // 降載：5 → 0 VUs
  ],
  thresholds: {
    // 基準門檻 — 首次執行後依實際數據調整
    http_req_duration: ["p(95)<2000"],   // 95% 請求 < 2 秒
    http_req_failed: ["rate<0.05"],      // 錯誤率 < 5%
    errors: ["rate<0.05"],
    login_duration: ["p(95)<3000"],      // 登入 < 3 秒
    dashboard_duration: ["p(95)<2000"],  // 儀表板 < 2 秒
    task_list_duration: ["p(95)<1500"],  // 任務列表 < 1.5 秒
    task_create_duration: ["p(95)<2000"],// 建立任務 < 2 秒
    report_duration: ["p(95)<3000"],     // 報表產生 < 3 秒
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

function checkResponse(res, name) {
  const success = check(res, {
    [`${name}: status 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${name}: response time < 2s`]: (r) => r.timings.duration < 2000,
  });
  errorRate.add(!success);
  return success;
}

// ── 場景 1：登入 ──────────────────────────────────────────
function login() {
  const res = http.post(
    `${BASE_URL}/api/auth/callback/credentials`,
    JSON.stringify({ username: USERNAME, password: PASSWORD }),
    { headers: getHeaders(), tags: { scenario: "login" } }
  );
  loginDuration.add(res.timings.duration);
  checkResponse(res, "login");

  // 嘗試從回應或 cookie 取得 session token
  let token = null;
  try {
    const body = JSON.parse(res.body);
    token = body.token || body.accessToken || null;
  } catch (_) {
    // NextAuth 可能透過 cookie 管理 session
  }
  return token;
}

// ── 場景 2：儀表板載入 ────────────────────────────────────
function loadDashboard(token) {
  group("Dashboard Load", () => {
    // 主頁面
    const dashRes = http.get(`${BASE_URL}/dashboard`, {
      headers: getHeaders(token),
      tags: { scenario: "dashboard" },
    });
    dashboardDuration.add(dashRes.timings.duration);
    checkResponse(dashRes, "dashboard_page");

    // 並行 API 請求（儀表板常見的資料來源）
    const responses = http.batch([
      ["GET", `${BASE_URL}/api/tasks?limit=10`, null, {
        headers: getHeaders(token), tags: { scenario: "dashboard" },
      }],
      ["GET", `${BASE_URL}/api/notifications?limit=5`, null, {
        headers: getHeaders(token), tags: { scenario: "dashboard" },
      }],
      ["GET", `${BASE_URL}/api/kpi`, null, {
        headers: getHeaders(token), tags: { scenario: "dashboard" },
      }],
    ]);

    responses.forEach((r, i) => {
      const names = ["tasks_list", "notifications", "kpi_summary"];
      checkResponse(r, `dashboard_${names[i]}`);
    });
  });
}

// ── 場景 3：任務 CRUD ─────────────────────────────────────
function taskCrud(token) {
  let taskId = null;

  group("Task CRUD", () => {
    // CREATE
    const createRes = http.post(
      `${BASE_URL}/api/tasks`,
      JSON.stringify({
        title: `Load Test Task ${Date.now()}`,
        description: "Created by k6 load test",
        status: "TODO",
        priority: "MEDIUM",
      }),
      { headers: getHeaders(token), tags: { scenario: "task_create" } }
    );
    taskCreateDuration.add(createRes.timings.duration);
    checkResponse(createRes, "task_create");

    try {
      const body = JSON.parse(createRes.body);
      taskId = body.id || body.data?.id;
    } catch (_) {}

    // READ (list)
    const listRes = http.get(`${BASE_URL}/api/tasks?limit=20`, {
      headers: getHeaders(token),
      tags: { scenario: "task_list" },
    });
    taskListDuration.add(listRes.timings.duration);
    checkResponse(listRes, "task_list");

    // UPDATE
    if (taskId) {
      const updateRes = http.patch(
        `${BASE_URL}/api/tasks/${taskId}`,
        JSON.stringify({
          status: "IN_PROGRESS",
          description: "Updated by k6 load test",
        }),
        { headers: getHeaders(token), tags: { scenario: "task_update" } }
      );
      taskUpdateDuration.add(updateRes.timings.duration);
      checkResponse(updateRes, "task_update");
    }

    // DELETE
    if (taskId) {
      const deleteRes = http.del(`${BASE_URL}/api/tasks/${taskId}`, null, {
        headers: getHeaders(token),
        tags: { scenario: "task_delete" },
      });
      taskDeleteDuration.add(deleteRes.timings.duration);
      checkResponse(deleteRes, "task_delete");
    }
  });
}

// ── 場景 4：報表產生 ──────────────────────────────────────
function generateReports(token) {
  group("Report Generation", () => {
    const endpoints = [
      { url: `${BASE_URL}/api/reports/weekly`, name: "weekly_report" },
      { url: `${BASE_URL}/api/reports/monthly`, name: "monthly_report" },
      { url: `${BASE_URL}/api/reports/workload`, name: "workload_report" },
    ];

    endpoints.forEach(({ url, name }) => {
      const res = http.get(url, {
        headers: getHeaders(token),
        tags: { scenario: "reports" },
      });
      reportDuration.add(res.timings.duration);
      checkResponse(res, name);
    });
  });
}

// ── 場景 5：KPI 查詢 ─────────────────────────────────────
function queryKpi(token) {
  group("KPI Query", () => {
    const res = http.get(`${BASE_URL}/api/kpi`, {
      headers: getHeaders(token),
      tags: { scenario: "kpi" },
    });
    kpiDuration.add(res.timings.duration);
    checkResponse(res, "kpi_list");
  });
}

// ── 主流程 ────────────────────────────────────────────────
export default function () {
  // 每個 VU 模擬一個使用者的完整工作流程
  const token = login();
  sleep(1);

  loadDashboard(token);
  sleep(0.5);

  taskCrud(token);
  sleep(0.5);

  generateReports(token);
  sleep(0.5);

  queryKpi(token);
  sleep(1);

  // 模擬使用者瀏覽間隔（1-3 秒隨機）
  sleep(Math.random() * 2 + 1);
}
