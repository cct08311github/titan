#!/usr/bin/env node
/**
 * TITAN 5-User Deep Integration Test
 * 模擬 5 人同時日常操作，含主管↔經辦、經辦↔經辦交互
 */

const BASE = process.env.TITAN_URL || "https://mac-mini.tailde842d.ts.net";
const TODAY = new Date().toISOString().slice(0, 10);
const DUE_7D = new Date(Date.now() + 7 * 86400000).toISOString();
const DUE_5D = new Date(Date.now() + 5 * 86400000).toISOString();

let pass = 0, fail = 0;

// ── Session Manager ─────────────────────────────────────────────────────────

class Session {
  constructor(username) {
    this.username = username;
    this.cookies = {};
    this.userId = null;
    this.role = null;
  }

  cookieHeader() {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  }

  parseCookies(res) {
    const raw = res.headers.getSetCookie?.() || [];
    for (const c of raw) {
      const [pair] = c.split(";");
      const [name, ...rest] = pair.split("=");
      this.cookies[name.trim()] = rest.join("=").trim();
    }
  }

  async login() {
    // 1. Get CSRF token
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { redirect: "manual" });
    this.parseCookies(csrfRes);
    const { csrfToken } = await csrfRes.json();

    // 2. Credentials callback
    const body = new URLSearchParams({
      csrfToken,
      username: this.username,
      password: "1234",
      redirect: "false",
      callbackUrl: "/dashboard",
      json: "true",
    });
    const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: this.cookieHeader() },
      body: body.toString(),
      redirect: "manual",
    });
    this.parseCookies(loginRes);

    // 3. Verify session
    const sessRes = await this.get("/api/auth/session");
    const sess = await sessRes.json();
    this.userId = sess?.user?.id;
    this.role = sess?.user?.role;
    if (!this.userId) throw new Error(`Login failed for ${this.username}`);
    log(this.username, `✅ 登入成功 (${this.role})`);
  }

  async get(path) {
    return fetch(`${BASE}${path}`, { headers: { Cookie: this.cookieHeader() } });
  }

  async post(path, data) {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: this.cookieHeader() },
      body: JSON.stringify(data),
    });
    return res;
  }

  async put(path, data) {
    const res = await fetch(`${BASE}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: this.cookieHeader() },
      body: JSON.stringify(data),
    });
    return res;
  }

  async patch(path, data) {
    const res = await fetch(`${BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: this.cookieHeader() },
      body: JSON.stringify(data),
    });
    return res;
  }
}

function log(user, msg) { console.log(`[${user.padEnd(6)}] ${msg}`); }

async function check(session, action, resFn) {
  try {
    const res = await resFn();
    const ok = res.ok || res.status === 201 || res.status === 302;
    if (ok) { pass++; log(session.username, `✅ ${action}`); }
    else {
      fail++;
      const body = await res.text().catch(() => "");
      log(session.username, `❌ ${action} → ${res.status} ${body.slice(0, 100)}`);
    }
    return res;
  } catch (e) { fail++; log(session.username, `❌ ${action} → ${e.message}`); return null; }
}

async function checkJson(session, action, resFn) {
  const res = await check(session, action, resFn);
  if (!res) return null;
  try { return await res.json(); } catch { return null; }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🏦 TITAN 5-User Integration Test — ${BASE}`);
  console.log(`📅 日期: ${TODAY}\n`);

  // ═══ Phase 0: 5 人同時登入 ═══
  console.log("═══ Phase 0: 登入 ═══");
  const admin = new Session("admin");
  const engA = new Session("eng-a");
  const engB = new Session("eng-b");
  const engC = new Session("eng-c");
  const engD = new Session("eng-d");
  await Promise.all([admin.login(), engA.login(), engB.login(), engC.login(), engD.login()]);

  // Resolve user IDs
  const usersRes = await admin.get("/api/users");
  const usersBody = await usersRes.json();
  const users = usersBody.data || usersBody;
  const uid = {};
  for (const u of users) {
    const short = u.email.split("@")[0];
    uid[short] = u.id;
  }
  console.log(`\n📋 使用者: ${Object.keys(uid).join(", ")}\n`);

  // ═══ Phase 1: 主管建立任務並指派 ═══
  console.log("═══ Phase 1: 主管建立任務 + 指派 ═══");

  const taskA = await checkJson(admin, "建立任務 A → eng-a (API Gateway)", () =>
    admin.post("/api/tasks", { title: "INTTEST-A: API Gateway 效能調校", primaryAssigneeId: uid["eng-a"], backupAssigneeId: uid["eng-d"], priority: "P1", status: "TODO", dueDate: DUE_7D, estimatedHours: 16, tags: ["integration-test", "performance"], category: "PLANNED" })
  );
  const taskB = await checkJson(admin, "建立任務 B → eng-b (DB Migration)", () =>
    admin.post("/api/tasks", { title: "INTTEST-B: 資料庫遷移腳本", primaryAssigneeId: uid["eng-b"], priority: "P0", status: "TODO", dueDate: DUE_5D, estimatedHours: 24, tags: ["integration-test", "database"], category: "PLANNED" })
  );
  const taskC = await checkJson(admin, "建立任務 C → eng-c (CI/CD 文件)", () =>
    admin.post("/api/tasks", { title: "INTTEST-C: CI/CD Pipeline 文件撰寫", primaryAssigneeId: uid["eng-c"], priority: "P2", status: "TODO", dueDate: DUE_7D, estimatedHours: 8, tags: ["integration-test", "documentation"], category: "PLANNED" })
  );
  const taskD = await checkJson(admin, "建立任務 D → eng-d (安全稽核)", () =>
    admin.post("/api/tasks", { title: "INTTEST-D: 安全漏洞修復", primaryAssigneeId: uid["eng-d"], backupAssigneeId: uid["eng-a"], priority: "P1", status: "TODO", dueDate: DUE_7D, estimatedHours: 20, tags: ["integration-test", "security"], category: "PLANNED" })
  );
  // 共同協作任務 — eng-a 負責, eng-b 協助
  const taskCollab = await checkJson(admin, "建立協作任務 → eng-a + eng-b", () =>
    admin.post("/api/tasks", { title: "INTTEST-COLLAB: 跨團隊 API 整合", primaryAssigneeId: uid["eng-a"], backupAssigneeId: uid["eng-b"], priority: "P1", status: "TODO", dueDate: DUE_7D, estimatedHours: 12, tags: ["integration-test", "collaboration"], category: "PLANNED" })
  );

  const idA = taskA?.data?.id || taskA?.id;
  const idB = taskB?.data?.id || taskB?.id;
  const idC = taskC?.data?.id || taskC?.id;
  const idD = taskD?.data?.id || taskD?.id;
  const idCollab = taskCollab?.data?.id || taskCollab?.id;

  // 主管留言指導
  await check(admin, "主管留言 taskA: 指導方向", () =>
    admin.post(`/api/tasks/${idA}/comments`, { content: "請先做 P95 延遲分析，目標先降到 200ms 以下。可以跟 eng-d 討論安全方面的 header 最佳化。" })
  );
  await check(admin, "主管留言 taskCollab: 協作說明", () =>
    admin.post(`/api/tasks/${idCollab}/comments`, { content: "這個任務需要 eng-a 和 eng-b 密切協作。eng-a 負責 API 設計，eng-b 負責資料庫端的介面。" })
  );

  // 主管登記行政工時
  await check(admin, "主管登記工時: 任務指派與規劃 2h", () =>
    admin.post("/api/time-entries", { date: TODAY, hours: 2, category: "ADMIN", description: "Sprint planning + 任務指派與方向設定" })
  );

  // 建立知識庫文件
  await checkJson(admin, "建立 Sprint 會議記錄", () =>
    admin.post("/api/documents", { title: "INTTEST Sprint Planning 會議記錄", templateType: "meeting-notes" })
  );

  console.log("");

  // ═══ Phase 2: 4 位工程師同時工作 ═══
  console.log("═══ Phase 2: 工程師同時工作 ═══");

  await Promise.all([
    // ── eng-a: API Gateway + 協作任務 ──
    (async () => {
      await check(engA, "接手 taskA → IN_PROGRESS", () => engA.patch(`/api/tasks/${idA}`, { status: "IN_PROGRESS" }));
      await check(engA, "登記工時 3.5h: API Gateway profiling", () =>
        engA.post("/api/time-entries", { date: TODAY, hours: 3.5, taskId: idA, category: "PLANNED_TASK", description: "API Gateway P95 延遲分析 + 連線池最佳化" })
      );
      await check(engA, "留言 taskA: 進度回報", () =>
        engA.post(`/api/tasks/${idA}/comments`, { content: "初步分析完成。P95 延遲 340ms，瓶頸在 DB connection pool。已開始調整參數，目前降到 180ms。" })
      );
      // 請 eng-d 協助
      await check(engA, "留言 taskA: 請 eng-d 協助 security header", () =>
        engA.post(`/api/tasks/${idA}/comments`, { content: "@eng-d 可以幫忙看一下 security header 的最佳化嗎？目前 HSTS + CSP header 增加了約 15ms overhead。" })
      );
      await check(engA, "更新進度 taskA: 40%", () => engA.put(`/api/tasks/${idA}`, { progressPct: 40 }));
      // 開始協作任務
      await check(engA, "接手 taskCollab → IN_PROGRESS", () => engA.patch(`/api/tasks/${idCollab}`, { status: "IN_PROGRESS" }));
      await check(engA, "登記工時 1.5h: 協作 API 設計", () =>
        engA.post("/api/time-entries", { date: TODAY, hours: 1.5, taskId: idCollab, category: "PLANNED_TASK", description: "跨團隊 API 介面設計 + 與 eng-b 討論 schema" })
      );
      await check(engA, "留言 taskCollab: 通知 eng-b", () =>
        engA.post(`/api/tasks/${idCollab}/comments`, { content: "@eng-b API spec 初稿已完成，請看一下 DB schema 端是否需要調整。我放在知識庫了。" })
      );
    })(),

    // ── eng-b: DB Migration + 協作回應 ──
    (async () => {
      await check(engB, "接手 taskB → IN_PROGRESS", () => engB.patch(`/api/tasks/${idB}`, { status: "IN_PROGRESS" }));
      await check(engB, "登記工時 4h: Schema 分析", () =>
        engB.post("/api/time-entries", { date: TODAY, hours: 4, taskId: idB, category: "PLANNED_TASK", description: "Schema diff 分析 + migration script 草稿" })
      );
      await check(engB, "留言 taskB: 進度回報", () =>
        engB.post(`/api/tasks/${idB}/comments`, { content: "Schema 分析完成。3 個 table 需要 ALTER，1 個新 index。Migration script 初版已完成，準備在 staging 測試。" })
      );
      await check(engB, "提交 taskB → REVIEW", () => engB.patch(`/api/tasks/${idB}`, { status: "REVIEW" }));
      await check(engB, "更新進度 taskB: 75%", () => engB.put(`/api/tasks/${idB}`, { progressPct: 75 }));
      // 回應協作任務
      await check(engB, "留言 taskCollab: 回覆 eng-a", () =>
        engB.post(`/api/tasks/${idCollab}/comments`, { content: "@eng-a 看過了，DB schema 需要增加一個 junction table 處理 M:N 關係。我先建好 migration，你那邊的 API 可以對應調整。" })
      );
      await check(engB, "登記工時 1h: 協作 DB 設計", () =>
        engB.post("/api/time-entries", { date: TODAY, hours: 1, taskId: idCollab, category: "PLANNED_TASK", description: "跨團隊 API 整合 — DB schema 設計 + junction table" })
      );
    })(),

    // ── eng-c: CI/CD 文件 ──
    (async () => {
      await check(engC, "接手 taskC → IN_PROGRESS", () => engC.patch(`/api/tasks/${idC}`, { status: "IN_PROGRESS" }));
      await check(engC, "登記工時 3h: 文件撰寫", () =>
        engC.post("/api/time-entries", { date: TODAY, hours: 3, taskId: idC, category: "PLANNED_TASK", description: "CI/CD pipeline 架構文件撰寫" })
      );
      await check(engC, "留言 taskC: 進度", () =>
        engC.post(`/api/tasks/${idC}/comments`, { content: "Pipeline 架構文件完成。正在撰寫 deployment runbook 章節。" })
      );
      await check(engC, "建立技術文件", () =>
        engC.post("/api/documents", { title: "INTTEST CI/CD Pipeline 架構設計", templateType: "tech-doc" })
      );
      await check(engC, "登記學習工時 1h", () =>
        engC.post("/api/time-entries", { date: TODAY, hours: 1, category: "LEARNING", description: "研究 Kubernetes GitOps 部署模式" })
      );
      await check(engC, "更新進度 taskC: 40%", () => engC.put(`/api/tasks/${idC}`, { progressPct: 40 }));
      // 對 eng-a 的任務提供意見
      await check(engC, "留言 taskA: 提供 CI/CD 觀點", () =>
        engC.post(`/api/tasks/${idA}/comments`, { content: "@eng-a 關於 API Gateway 效能，我在 CI/CD pipeline 裡有加 performance regression test，可以幫你自動監控 P95。需要的話我可以加 webhook 通知。" })
      );
    })(),

    // ── eng-d: 安全稽核 + 協助 eng-a ──
    (async () => {
      await check(engD, "接手 taskD → IN_PROGRESS", () => engD.patch(`/api/tasks/${idD}`, { status: "IN_PROGRESS" }));
      await check(engD, "登記工時 4.5h: 漏洞掃描", () =>
        engD.post("/api/time-entries", { date: TODAY, hours: 4.5, taskId: idD, category: "PLANNED_TASK", description: "安全漏洞掃描 + 分類 + 修補方案制定" })
      );
      await check(engD, "留言 taskD: 進度", () =>
        engD.post(`/api/tasks/${idD}/comments`, { content: "漏洞掃描完成。2 個 Critical、5 個 High、12 個 Medium。優先處理 Critical。" })
      );
      await check(engD, "更新進度 taskD: 30%", () => engD.put(`/api/tasks/${idD}`, { progressPct: 30 }));
      // 回應 eng-a 的 security header 請求
      await check(engD, "留言 taskA: 回覆 security header 建議", () =>
        engD.post(`/api/tasks/${idA}/comments`, { content: "@eng-a Security header 建議：HSTS 可以用 preload 減少重複 header；CSP 建議改用 hash-based 而非 nonce，可以省去每次計算。這樣大概可以省 8-10ms。" })
      );
      await check(engD, "登記行政工時 1h", () =>
        engD.post("/api/time-entries", { date: TODAY, hours: 1, category: "ADMIN", description: "團隊站會 + Sprint 規劃" })
      );
    })(),
  ]);

  console.log("");

  // ═══ Phase 3: 主管審核 + 反饋 ═══
  console.log("═══ Phase 3: 主管審核 + 反饋 ═══");

  // 標記 taskB 需注意
  await check(admin, "標記 taskB: 需要 rollback 測試", () =>
    admin.patch(`/api/tasks/${idB}/flag`, { flagged: true, reason: "Migration 需要額外的 rollback 測試再上 production" })
  );
  await check(admin, "留言 taskB: 審核意見", () =>
    admin.post(`/api/tasks/${idB}/comments`, { content: "migration script 寫得不錯。但請補上 rollback procedure，並在 staging 用 production-scale 資料量測試一次。" })
  );
  // 對協作任務給意見
  await check(admin, "留言 taskCollab: 主管肯定", () =>
    admin.post(`/api/tasks/${idCollab}/comments`, { content: "eng-a 和 eng-b 的協作很好。junction table 方案我同意，請繼續推進。" })
  );
  // 對 eng-a 的進度回饋
  await check(admin, "留言 taskA: 肯定進展", () =>
    admin.post(`/api/tasks/${idA}/comments`, { content: "P95 從 340ms 降到 180ms 很好。eng-d 的 security header 建議也很實用，請整合進去。" })
  );
  // 主管登記審核工時
  await check(admin, "登記工時 1.5h: 程式碼審核", () =>
    admin.post("/api/time-entries", { date: TODAY, hours: 1.5, category: "ADMIN", description: "Code review + migration script 審核 + 協作任務方向確認" })
  );

  console.log("");

  // ═══ Phase 4: 工程師回應主管反饋 ═══
  console.log("═══ Phase 4: 工程師回應反饋 ═══");

  await Promise.all([
    // eng-b 回應 flag
    (async () => {
      await check(engB, "留言 taskB: 回應主管", () =>
        engB.post(`/api/tasks/${idB}/comments`, { content: "收到。正在補上 rollback procedure，明天會在 staging 做 production-scale 測試。" })
      );
      await check(engB, "退回 taskB → IN_PROGRESS", () => engB.patch(`/api/tasks/${idB}`, { status: "IN_PROGRESS" }));
      await check(engB, "登記工時 1.5h: 補 rollback", () =>
        engB.post("/api/time-entries", { date: TODAY, hours: 1.5, taskId: idB, category: "PLANNED_TASK", description: "補充 rollback procedure + staging 測試準備" })
      );
    })(),

    // eng-a 整合 eng-d 建議
    (async () => {
      await check(engA, "留言 taskA: 感謝 eng-d + eng-c", () =>
        engA.post(`/api/tasks/${idA}/comments`, { content: "已整合 eng-d 的 security header 建議，P95 再降到 165ms。eng-c 的 CI performance test 也整合了，每次 deploy 自動跑 benchmark。" })
      );
      await check(engA, "更新進度 taskA: 60%", () => engA.put(`/api/tasks/${idA}`, { progressPct: 60 }));
      await check(engA, "登記工時 1h: 整合建議", () =>
        engA.post("/api/time-entries", { date: TODAY, hours: 1, taskId: idA, category: "PLANNED_TASK", description: "整合 security header 最佳化 + CI benchmark" })
      );
      // 協作任務更新
      await check(engA, "留言 taskCollab: 確認 eng-b schema", () =>
        engA.post(`/api/tasks/${idCollab}/comments`, { content: "@eng-b Junction table 已建好的話我這邊 API 可以開始接了。估計明天可以完成 API endpoint。" })
      );
      await check(engA, "更新進度 taskCollab: 50%", () => engA.put(`/api/tasks/${idCollab}`, { progressPct: 50 }));
    })(),

    // eng-c 完成文件
    (async () => {
      await check(engC, "登記工時 2h: runbook 完成", () =>
        engC.post("/api/time-entries", { date: TODAY, hours: 2, taskId: idC, category: "PLANNED_TASK", description: "Deployment runbook 完成 + 交叉檢查" })
      );
      await check(engC, "提交 taskC → REVIEW", () => engC.patch(`/api/tasks/${idC}`, { status: "REVIEW" }));
      await check(engC, "更新進度 taskC: 90%", () => engC.put(`/api/tasks/${idC}`, { progressPct: 90 }));
    })(),

    // eng-d 繼續修復
    (async () => {
      await check(engD, "登記工時 2h: Critical 漏洞修補", () =>
        engD.post("/api/time-entries", { date: TODAY, hours: 2, taskId: idD, category: "PLANNED_TASK", description: "修補 2 個 Critical 漏洞 + 驗證修補效果" })
      );
      await check(engD, "更新進度 taskD: 55%", () => engD.put(`/api/tasks/${idD}`, { progressPct: 55 }));
      await check(engD, "留言 taskD: Critical 已修", () =>
        engD.post(`/api/tasks/${idD}/comments`, { content: "2 個 Critical 漏洞已修補並驗證。開始處理 High 等級的 5 個漏洞。" })
      );
    })(),
  ]);

  console.log("");

  // ═══ Phase 5: 主管最終審核 ═══
  console.log("═══ Phase 5: 主管最終審核 ═══");

  await check(admin, "核准 taskC → DONE", () => admin.patch(`/api/tasks/${idC}`, { status: "DONE" }));
  await check(admin, "留言 taskC: 文件核准", () =>
    admin.post(`/api/tasks/${idC}/comments`, { content: "文件品質很好，已核准。eng-c 辛苦了。" })
  );
  await check(admin, "解除 taskB flag", () =>
    admin.patch(`/api/tasks/${idB}/flag`, { flagged: false })
  );
  await check(admin, "留言 taskD: 鼓勵", () =>
    admin.post(`/api/tasks/${idD}/comments`, { content: "Critical 修得很快，繼續保持。High 等級的如果需要協助可以找 eng-a backup。" })
  );
  await check(admin, "登記工時 0.5h: 最終審核", () =>
    admin.post("/api/time-entries", { date: TODAY, hours: 0.5, category: "ADMIN", description: "最終進度審核 + 文件核准" })
  );

  // ═══ Summary ═══
  console.log("\n" + "═".repeat(60));
  console.log(`🏁 測試完成！ Pass: ${pass} / Fail: ${fail} / Total: ${pass + fail}`);
  console.log("═".repeat(60));

  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(2); });
