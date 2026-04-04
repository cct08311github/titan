import { PrismaClient, Role, TaskStatus, Priority, TaskCategory, TimeCategory } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import "dotenv/config";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL environment variable is not set");
const adapter = new PrismaPg(dbUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("開始建立種子資料...");

  // ── 建立使用者 ─────────────────────────────────────────
  // E2E test password — bypasses API-level policy check (seed writes directly to DB)
  const adminPassword = await hash("1234", 12);
  const engPassword = await hash("1234", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@titan.local" },
    update: {},
    create: {
      email: "admin@titan.local",
      name: "系統管理員",
      password: adminPassword,
      role: Role.MANAGER,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });

  const engineers = await Promise.all([
    prisma.user.upsert({
      where: { email: "eng-a@titan.local" },
      update: {},
      create: {
        email: "eng-a@titan.local",
        name: "王大明",
        password: engPassword,
        role: Role.ENGINEER,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    }),
    prisma.user.upsert({
      where: { email: "eng-b@titan.local" },
      update: {},
      create: {
        email: "eng-b@titan.local",
        name: "李小花",
        password: engPassword,
        role: Role.ENGINEER,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    }),
    prisma.user.upsert({
      where: { email: "eng-c@titan.local" },
      update: {},
      create: {
        email: "eng-c@titan.local",
        name: "張志偉",
        password: engPassword,
        role: Role.ENGINEER,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    }),
    prisma.user.upsert({
      where: { email: "eng-d@titan.local" },
      update: {},
      create: {
        email: "eng-d@titan.local",
        name: "陳美玖",
        password: engPassword,
        role: Role.ENGINEER,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    }),
  ]);

  // E2E test accounts for password policy tests (PWD-01, PWD-02)
  await prisma.user.upsert({
    where: { email: "pwdtest@titan.local" },
    update: {},
    create: {
      name: "密碼測試用戶",
      email: "pwdtest@titan.local",
      password: await hash("TempPass@2026!", 12),
      role: "ENGINEER",
      mustChangePassword: true,  // PWD-01: first-login forced change
      passwordChangedAt: new Date(),
    },
  });

  await prisma.user.upsert({
    where: { email: "expiredpwd@titan.local" },
    update: {},
    create: {
      name: "過期密碼用戶",
      email: "expiredpwd@titan.local",
      password: await hash("OldPass@2026!", 12),
      role: "ENGINEER",
      mustChangePassword: false,
      passwordChangedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000), // 91 days ago
    },
  });

  const allUsers = [admin, ...engineers];
  console.log(`建立使用者：1 位主管 + ${engineers.length} 位工程師 + 2 個 PWD 測試帳號`);

  // ── 建立 3 個年度計畫 ───────────────────────────────────
  const existing2026 = await prisma.annualPlan.findFirst({ where: { year: 2026 } });
  const plan2026 = existing2026 ?? await prisma.annualPlan.create({
    data: {
      year: 2026,
      title: "2026 年度 IT 維運計畫",
      description: "銀行 IT 團隊 2026 年度核心維運目標與計畫",
      implementationPlan: `## 執行計畫\n\n### Q1（1–3 月）\n- 完成核心交換機韌體升級\n- 建立自動化監控告警\n\n### Q2（4–6 月）\n- 資安稽核配合\n- 備援系統演練\n\n### Q3（7–9 月）\n- 系統效能優化\n- 使用者培訓\n\n### Q4（10–12 月）\n- 年度績效盤點\n- 次年計畫草擬`,
      createdBy: admin.id,
    },
  });

  const existing2025 = await prisma.annualPlan.findFirst({ where: { year: 2025 } });
  const plan2025 = existing2025 ?? await prisma.annualPlan.create({
    data: {
      year: 2025,
      title: "2025 年度 IT 維運計畫",
      description: "銀行 IT 團隊 2025 年度計畫（已歸檔）",
      progressPct: 85,
      archivedAt: new Date("2025-12-31"),
      createdBy: admin.id,
    },
  });

  const existing2024 = await prisma.annualPlan.findFirst({ where: { year: 2024 } });
  const plan2024 = existing2024 ?? await prisma.annualPlan.create({
    data: {
      year: 2024,
      title: "2024 年度 IT 維運計畫",
      description: "銀行 IT 團隊 2024 年度計畫（已歸檔）",
      progressPct: 100,
      archivedAt: new Date("2024-12-31"),
      createdBy: admin.id,
    },
  });

  console.log("建立 3 個年度計畫");

  // ── 建立里程碑 ─────────────────────────────────────────
  await prisma.milestone.createMany({
    skipDuplicates: true,
    data: [
      { annualPlanId: plan2026.id, title: "Q1 核心設備升級完成", plannedEnd: new Date("2026-03-31"), order: 1 },
      { annualPlanId: plan2026.id, title: "資安稽核通過", plannedEnd: new Date("2026-06-30"), order: 2 },
      { annualPlanId: plan2026.id, title: "備援演練完成", plannedEnd: new Date("2026-09-30"), order: 3 },
      { annualPlanId: plan2026.id, title: "年度績效報告提交", plannedEnd: new Date("2026-12-20"), order: 4 },
      { annualPlanId: plan2025.id, title: "2025 系統遷移完成", plannedEnd: new Date("2025-06-30"), status: "COMPLETED", order: 1 },
      { annualPlanId: plan2025.id, title: "2025 年度稽核通過", plannedEnd: new Date("2025-12-15"), status: "COMPLETED", order: 2 },
    ],
  });

  // ── 建立月度目標 ─────────────────────────────────────────
  const marchGoal = await prisma.monthlyGoal.upsert({
    where: { annualPlanId_month_title: { annualPlanId: plan2026.id, month: 3, title: "核心交換機韌體升級" } },
    update: {},
    create: { annualPlanId: plan2026.id, month: 3, title: "核心交換機韌體升級", description: "完成 3 台核心交換機韌體升級至最新穩定版本" },
  });

  const aprilGoal = await prisma.monthlyGoal.upsert({
    where: { annualPlanId_month_title: { annualPlanId: plan2026.id, month: 4, title: "監控系統建置" } },
    update: {},
    create: { annualPlanId: plan2026.id, month: 4, title: "監控系統建置", description: "部署 Prometheus + Grafana 監控堆疊，設定告警規則" },
  });

  const mayGoal = await prisma.monthlyGoal.upsert({
    where: { annualPlanId_month_title: { annualPlanId: plan2026.id, month: 5, title: "資安稽核準備" } },
    update: {},
    create: { annualPlanId: plan2026.id, month: 5, title: "資安稽核準備", description: "準備金管會資安稽核文件與系統設定" },
  });

  const juneGoal = await prisma.monthlyGoal.upsert({
    where: { annualPlanId_month_title: { annualPlanId: plan2026.id, month: 6, title: "備援系統演練" } },
    update: {},
    create: { annualPlanId: plan2026.id, month: 6, title: "備援系統演練", description: "執行資料庫 failover 與系統備援切換演練" },
  });

  console.log("建立里程碑、月度目標");

  // ── 建立 20 個範例任務 ───────────────────────────────────
  const taskData = [
    // March tasks (marchGoal)
    { monthlyGoalId: marchGoal.id, title: "核心交換機 A 韌體升級前評估", description: "評估韌體升級風險，制定回滾計畫", category: TaskCategory.PLANNED, primaryAssigneeId: engineers[0].id, backupAssigneeId: engineers[1].id, creatorId: admin.id, status: TaskStatus.DONE, priority: Priority.P1, dueDate: new Date("2026-03-10"), startDate: new Date("2026-03-03"), estimatedHours: 8, actualHours: 6, progressPct: 100, tags: ["網路", "交換機", "評估"] },
    { monthlyGoalId: marchGoal.id, title: "核心交換機 A 韌體升級執行", description: "於維護視窗執行韌體升級，完成後驗證網路連通性", category: TaskCategory.PLANNED, primaryAssigneeId: engineers[0].id, backupAssigneeId: engineers[1].id, creatorId: admin.id, status: TaskStatus.IN_PROGRESS, priority: Priority.P1, dueDate: new Date("2026-03-28"), startDate: new Date("2026-03-15"), estimatedHours: 16, actualHours: 8, progressPct: 50, tags: ["網路", "交換機", "升級"] },
    { monthlyGoalId: marchGoal.id, title: "核心交換機 B 韌體升級前評估", category: TaskCategory.PLANNED, primaryAssigneeId: engineers[1].id, creatorId: admin.id, status: TaskStatus.TODO, priority: Priority.P2, dueDate: new Date("2026-03-25"), estimatedHours: 6, tags: ["網路", "交換機"] },
    { monthlyGoalId: marchGoal.id, title: "核心交換機 C 韌體升級前評估", category: TaskCategory.PLANNED, primaryAssigneeId: engineers[1].id, backupAssigneeId: engineers[0].id, creatorId: admin.id, status: TaskStatus.BACKLOG, priority: Priority.P2, dueDate: new Date("2026-03-31"), estimatedHours: 6, tags: ["網路", "交換機"] },
    // April tasks (aprilGoal)
    { monthlyGoalId: aprilGoal.id, title: "Prometheus 部署與設定", description: "在 Docker 環境部署 Prometheus，設定監控目標", category: TaskCategory.PLANNED, primaryAssigneeId: engineers[2].id, backupAssigneeId: engineers[3].id, creatorId: admin.id, status: TaskStatus.TODO, priority: Priority.P2, dueDate: new Date("2026-04-15"), estimatedHours: 12, tags: ["監控", "Prometheus", "Docker"] },
    { monthlyGoalId: aprilGoal.id, title: "Grafana 儀表板建置", description: "建置伺服器資源、資料庫效能、應用程式健康等儀表板", category: TaskCategory.PLANNED, primaryAssigneeId: engineers[2].id, creatorId: admin.id, status: TaskStatus.BACKLOG, priority: Priority.P2, dueDate: new Date("2026-04-25"), estimatedHours: 16, tags: ["監控", "Grafana"] },
    { monthlyGoalId: aprilGoal.id, title: "告警規則設定", description: "設定 CPU/RAM/Disk/DB 連線數等告警閾值", category: TaskCategory.PLANNED, primaryAssigneeId: engineers[3].id, creatorId: admin.id, status: TaskStatus.BACKLOG, priority: Priority.P2, dueDate: new Date("2026-04-30"), estimatedHours: 8, tags: ["監控", "告警"] },
    // May tasks (mayGoal)
    { monthlyGoalId: mayGoal.id, title: "資安政策文件盤點", category: TaskCategory.PLANNED, primaryAssigneeId: engineers[0].id, creatorId: admin.id, status: TaskStatus.BACKLOG, priority: Priority.P1, dueDate: new Date("2026-05-10"), estimatedHours: 12, tags: ["資安", "稽核"] },
    { monthlyGoalId: mayGoal.id, title: "弱點掃描與修復", category: TaskCategory.PLANNED, primaryAssigneeId: engineers[2].id, backupAssigneeId: engineers[3].id, creatorId: admin.id, status: TaskStatus.BACKLOG, priority: Priority.P1, dueDate: new Date("2026-05-20"), estimatedHours: 20, tags: ["資安", "弱掃"] },
    { monthlyGoalId: mayGoal.id, title: "存取控制清單稽核", category: TaskCategory.PLANNED, primaryAssigneeId: engineers[3].id, creatorId: admin.id, status: TaskStatus.BACKLOG, priority: Priority.P2, dueDate: new Date("2026-05-25"), estimatedHours: 8, tags: ["資安", "ACL"] },
    // June tasks (juneGoal)
    { monthlyGoalId: juneGoal.id, title: "DB Failover 演練腳本撰寫", category: TaskCategory.PLANNED, primaryAssigneeId: engineers[0].id, creatorId: admin.id, status: TaskStatus.BACKLOG, priority: Priority.P1, dueDate: new Date("2026-06-10"), estimatedHours: 10, tags: ["備援", "DB"] },
    { monthlyGoalId: juneGoal.id, title: "Failover 正式演練", category: TaskCategory.PLANNED, primaryAssigneeId: engineers[0].id, backupAssigneeId: engineers[2].id, creatorId: admin.id, status: TaskStatus.BACKLOG, priority: Priority.P0, dueDate: new Date("2026-06-20"), estimatedHours: 8, tags: ["備援", "演練"] },
    { monthlyGoalId: juneGoal.id, title: "演練結果報告撰寫", category: TaskCategory.PLANNED, primaryAssigneeId: engineers[3].id, creatorId: admin.id, status: TaskStatus.BACKLOG, priority: Priority.P2, dueDate: new Date("2026-06-28"), estimatedHours: 6, tags: ["備援", "報告"] },
    // Incidents & support (no monthly goal)
    { title: "處理 MIS 系統登入異常", description: "用戶回報 MIS 系統偶發登入失敗，需排查原因", category: TaskCategory.INCIDENT, primaryAssigneeId: engineers[1].id, creatorId: admin.id, status: TaskStatus.IN_PROGRESS, priority: Priority.P0, dueDate: new Date("2026-03-25"), addedDate: new Date("2026-03-24"), addedReason: "用戶回報系統異常", addedSource: "事件通報", estimatedHours: 4, actualHours: 2, progressPct: 50, tags: ["MIS", "資安", "緊急"] },
    { title: "印表機網路設定調整", category: TaskCategory.SUPPORT, primaryAssigneeId: engineers[3].id, creatorId: admin.id, status: TaskStatus.DONE, priority: Priority.P3, dueDate: new Date("2026-03-20"), actualHours: 1, progressPct: 100, addedDate: new Date("2026-03-19"), addedReason: "行政部門請求", addedSource: "內部需求", tags: ["支援", "硬體"] },
    { title: "新進員工 AD 帳號設定", category: TaskCategory.ADMIN, primaryAssigneeId: engineers[2].id, creatorId: admin.id, status: TaskStatus.DONE, priority: Priority.P2, dueDate: new Date("2026-03-15"), actualHours: 2, progressPct: 100, tags: ["行政", "帳號"] },
    { title: "資安教育訓練課程準備", category: TaskCategory.LEARNING, primaryAssigneeId: engineers[0].id, creatorId: admin.id, status: TaskStatus.IN_PROGRESS, priority: Priority.P2, dueDate: new Date("2026-04-05"), estimatedHours: 8, actualHours: 3, progressPct: 40, tags: ["教育", "資安"] },
    { title: "VPN 連線問題排查", category: TaskCategory.INCIDENT, primaryAssigneeId: engineers[1].id, creatorId: admin.id, status: TaskStatus.REVIEW, priority: Priority.P1, dueDate: new Date("2026-03-22"), addedDate: new Date("2026-03-21"), addedReason: "遠端同仁無法連線", addedSource: "事件通報", estimatedHours: 3, actualHours: 3, progressPct: 90, tags: ["VPN", "網路"] },
    { title: "週報系統排程設定", category: TaskCategory.ADDED, primaryAssigneeId: engineers[3].id, creatorId: admin.id, status: TaskStatus.TODO, priority: Priority.P3, dueDate: new Date("2026-04-01"), addedDate: new Date("2026-03-20"), addedReason: "主管要求自動化週報", addedSource: "主管指派", estimatedHours: 6, tags: ["自動化", "報表"] },
    { title: "備份排程驗證與調整", category: TaskCategory.PLANNED, primaryAssigneeId: engineers[0].id, backupAssigneeId: engineers[2].id, creatorId: admin.id, status: TaskStatus.TODO, priority: Priority.P1, dueDate: new Date("2026-04-10"), estimatedHours: 4, tags: ["備份", "維運"] },
  ];

  await prisma.task.createMany({ skipDuplicates: false, data: taskData });
  console.log(`建立 ${taskData.length} 個範例任務`);

  // ── 建立 5 個 KPI ─────────────────────────────────────────
  const kpiData = [
    { year: 2026, code: "KPI-2026-01", title: "系統可用性", description: "核心系統月均可用率 ≥ 99.5%", target: 99.5, actual: 99.8, weight: 2, createdBy: admin.id },
    { year: 2026, code: "KPI-2026-02", title: "資安事件回應時間", description: "P0 事件平均回應時間 ≤ 30 分鐘", target: 30, actual: 25, weight: 2, createdBy: admin.id },
    { year: 2026, code: "KPI-2026-03", title: "計畫完成率", description: "年度計畫項目完成率 ≥ 90%", target: 90, actual: 0, weight: 1.5, createdBy: admin.id },
    { year: 2026, code: "KPI-2026-04", title: "使用者滿意度", description: "IT 服務滿意度調查 ≥ 4.0 / 5.0", target: 4.0, actual: 0, weight: 1, createdBy: admin.id },
    { year: 2026, code: "KPI-2026-05", title: "教育訓練時數", description: "團隊人均年度訓練時數 ≥ 40 小時", target: 40, actual: 12, weight: 1, createdBy: admin.id },
  ];

  for (const kpi of kpiData) {
    await prisma.kPI.upsert({
      where: { year_code: { year: kpi.year, code: kpi.code } },
      update: {},
      create: kpi,
    });
  }
  console.log(`建立 ${kpiData.length} 個 KPI`);

  // ── 建立工時紀錄 ─────────────────────────────────────────
  const timeEntryData: Array<{
    userId: string;
    date: Date;
    hours: number;
    category: TimeCategory;
    description: string;
  }> = [];

  // Generate time entries for the past 2 weeks for each engineer
  const categories: TimeCategory[] = [
    TimeCategory.PLANNED_TASK,
    TimeCategory.ADDED_TASK,
    TimeCategory.INCIDENT,
    TimeCategory.SUPPORT,
    TimeCategory.ADMIN,
    TimeCategory.LEARNING,
  ];

  for (const eng of engineers) {
    for (let dayOffset = 0; dayOffset < 10; dayOffset++) {
      const date = new Date("2026-03-10");
      date.setDate(date.getDate() + dayOffset);
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      // Main work (6 hours planned)
      timeEntryData.push({
        userId: eng.id,
        date,
        hours: 5 + Math.round(Math.random() * 2),
        category: TimeCategory.PLANNED_TASK,
        description: "計畫任務工作",
      });

      // Some days have additional categories
      if (Math.random() > 0.5) {
        const extraCategory = categories[Math.floor(Math.random() * categories.length)];
        timeEntryData.push({
          userId: eng.id,
          date,
          hours: 1 + Math.round(Math.random()),
          category: extraCategory,
          description: `${extraCategory} 工作`,
        });
      }
    }
  }

  await prisma.timeEntry.createMany({ skipDuplicates: false, data: timeEntryData });
  console.log(`建立 ${timeEntryData.length} 筆工時紀錄`);

  // ── 文件模板 (Issue #1002) ────────────────────────────────
  const systemTemplates = [
    {
      title: "SOP 標準作業程序",
      category: "SOP",
      content: `# SOP 標準作業程序

## 1. 目的
（說明本 SOP 的目的與適用範圍）

## 2. 適用範圍
（列出適用的系統、部門、流程）

## 3. 權責
| 角色 | 職責 |
|------|------|
| 執行者 | |
| 審核者 | |
| 核准者 | |

## 4. 作業流程
1. 步驟一
2. 步驟二
3. 步驟三

## 5. 注意事項
-

## 6. 相關文件
-

## 7. 修訂紀錄
| 版本 | 日期 | 修訂者 | 修訂內容 |
|------|------|--------|----------|
| 1.0 | | | 初版 |
`,
    },
    {
      title: "會議紀錄",
      category: "會議紀錄",
      content: `# 會議紀錄

**日期**：
**時間**：
**地點**：
**主持人**：
**記錄人**：
**出席者**：

---

## 議程

### 1. 上次會議追蹤事項
| 事項 | 負責人 | 狀態 |
|------|--------|------|
| | | |

### 2. 本次議題
#### 議題一
- 討論內容：
- 決議：

#### 議題二
- 討論內容：
- 決議：

### 3. 臨時動議

## 行動項目
| 事項 | 負責人 | 截止日期 |
|------|--------|----------|
| | | |

## 下次會議
- 日期：
- 議題：
`,
    },
    {
      title: "事件報告",
      category: "事件報告",
      content: `# 事件報告

## 基本資訊
- **事件編號**：
- **發生時間**：
- **發現時間**：
- **嚴重等級**：SEV1 / SEV2 / SEV3 / SEV4
- **影響範圍**：
- **通報人**：

## 事件描述
（詳述發生了什麼）

## 時間線
| 時間 | 事件 | 執行者 |
|------|------|--------|
| | 事件發生 | |
| | 發現/通報 | |
| | 開始處理 | |
| | 恢復服務 | |

## 影響評估
- 受影響系統：
- 受影響使用者數：
- 業務影響：

## 根因分析 (RCA)
（5-Why 或魚骨圖分析）

## 解決方案
（採取了哪些措施恢復服務）

## 改善行動
| 行動 | 負責人 | 截止日期 | 類型 |
|------|--------|----------|------|
| | | | 預防 / 偵測 / 回應 |

## 經驗教訓
-
`,
    },
    {
      title: "技術文件",
      category: "技術文件",
      content: `# 技術文件

## 概述
（本文件的目的與讀者對象）

## 架構說明
（系統架構圖與說明）

## 前置需求
-
-

## 安裝/設定步驟
\`\`\`bash
# 步驟
\`\`\`

## 使用說明
### 基本用法

### 進階用法

## API 參考
| 端點 | 方法 | 說明 |
|------|------|------|
| | | |

## 故障排除
### 常見問題 1
**症狀**：
**解決方案**：

## 參考資料
-
`,
    },
  ];

  for (const tmpl of systemTemplates) {
    await prisma.documentTemplate.upsert({
      where: { id: `system-tmpl-${tmpl.category}` },
      update: { title: tmpl.title, content: tmpl.content, category: tmpl.category },
      create: {
        id: `system-tmpl-${tmpl.category}`,
        title: tmpl.title,
        content: tmpl.content,
        category: tmpl.category,
        isSystem: true,
        createdBy: admin.id,
      },
    });
  }
  console.log(`  文件模板：${systemTemplates.length} 個系統模板`);

  // ── 完成 ────────────────────────────────────────────────
  console.log("\n種子資料建立完成！");
  console.log(`  使用者：1 位主管 + 4 位工程師`);
  console.log(`  計畫：3 個年度計畫`);
  console.log(`  任務：${taskData.length} 個`);
  console.log(`  KPI：${kpiData.length} 個`);
  console.log(`  工時：${timeEntryData.length} 筆`);
  console.log("\n登入帳號：");
  console.log("  主管：admin@titan.local / 1234");
  console.log("  工程師：eng-a ~ eng-d @titan.local / 1234");
}

main()
  .catch((e) => {
    console.error("種子資料建立失敗：", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
