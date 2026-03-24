import { PrismaClient, Role, TaskStatus, Priority, TaskCategory } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 開始建立種子資料...");

  // ── 建立使用者 ──────────────────────────────────────
  const adminPassword = await hash("admin123", 12);
  const engPassword = await hash("engineer123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin" },
    update: {},
    create: {
      email: "admin",
      name: "系統管理員",
      password: adminPassword,
      role: Role.MANAGER,
    },
  });

  const engineers = await Promise.all([
    prisma.user.upsert({
      where: { email: "eng01" },
      update: {},
      create: {
        email: "eng01",
        name: "王大明",
        password: engPassword,
        role: Role.ENGINEER,
      },
    }),
    prisma.user.upsert({
      where: { email: "eng02" },
      update: {},
      create: {
        email: "eng02",
        name: "李小花",
        password: engPassword,
        role: Role.ENGINEER,
      },
    }),
    prisma.user.upsert({
      where: { email: "eng03" },
      update: {},
      create: {
        email: "eng03",
        name: "張志偉",
        password: engPassword,
        role: Role.ENGINEER,
      },
    }),
    prisma.user.upsert({
      where: { email: "eng04" },
      update: {},
      create: {
        email: "eng04",
        name: "陳美玲",
        password: engPassword,
        role: Role.ENGINEER,
      },
    }),
  ]);

  console.log(`✅ 建立使用者：1 位主管 + ${engineers.length} 位工程師`);

  // ── 建立年度計畫 ──────────────────────────────────────
  const annualPlan = await prisma.annualPlan.upsert({
    where: { year: 2026 },
    update: {},
    create: {
      year: 2026,
      title: "2026 年度 IT 維運計畫",
      description: "銀行 IT 團隊 2026 年度核心維運目標與計畫",
      implementationPlan: `## 執行計畫\n\n### Q1（1–3 月）\n- 完成核心交換機韌體升級\n- 建立自動化監控告警\n\n### Q2（4–6 月）\n- 資安稽核配合\n- 備援系統演練\n\n### Q3（7–9 月）\n- 系統效能優化\n- 使用者培訓\n\n### Q4（10–12 月）\n- 年度績效盤點\n- 次年計畫草擬`,
      createdBy: admin.id,
    },
  });

  // ── 建立里程碑 ──────────────────────────────────────
  await prisma.milestone.createMany({
    skipDuplicates: true,
    data: [
      {
        annualPlanId: annualPlan.id,
        title: "Q1 核心設備升級完成",
        plannedEnd: new Date("2026-03-31"),
        order: 1,
      },
      {
        annualPlanId: annualPlan.id,
        title: "資安稽核通過",
        plannedEnd: new Date("2026-06-30"),
        order: 2,
      },
      {
        annualPlanId: annualPlan.id,
        title: "備援演練完成",
        plannedEnd: new Date("2026-09-30"),
        order: 3,
      },
      {
        annualPlanId: annualPlan.id,
        title: "年度績效報告提交",
        plannedEnd: new Date("2026-12-20"),
        order: 4,
      },
    ],
  });

  // ── 建立月度目標 ──────────────────────────────────────
  const marchGoal = await prisma.monthlyGoal.upsert({
    where: {
      annualPlanId_month_title: {
        annualPlanId: annualPlan.id,
        month: 3,
        title: "核心交換機韌體升級",
      },
    },
    update: {},
    create: {
      annualPlanId: annualPlan.id,
      month: 3,
      title: "核心交換機韌體升級",
      description: "完成 3 台核心交換機韌體升級至最新穩定版本",
    },
  });

  const aprilGoal = await prisma.monthlyGoal.upsert({
    where: {
      annualPlanId_month_title: {
        annualPlanId: annualPlan.id,
        month: 4,
        title: "監控系統建置",
      },
    },
    update: {},
    create: {
      annualPlanId: annualPlan.id,
      month: 4,
      title: "監控系統建置",
      description: "部署 Prometheus + Grafana 監控堆疊，設定告警規則",
    },
  });

  console.log("✅ 建立年度計畫、里程碑、月度目標");

  // ── 建立範例任務 ──────────────────────────────────────
  await prisma.task.createMany({
    skipDuplicates: false,
    data: [
      {
        monthlyGoalId: marchGoal.id,
        title: "核心交換機 A 韌體升級前評估",
        description: "評估韌體升級風險，制定回滾計畫",
        category: TaskCategory.PLANNED,
        primaryAssigneeId: engineers[0].id,
        backupAssigneeId: engineers[1].id,
        creatorId: admin.id,
        status: TaskStatus.DONE,
        priority: Priority.P1,
        dueDate: new Date("2026-03-10"),
        startDate: new Date("2026-03-03"),
        estimatedHours: 8,
        actualHours: 6,
        progressPct: 100,
        tags: ["網路", "交換機", "評估"],
      },
      {
        monthlyGoalId: marchGoal.id,
        title: "核心交換機 A 韌體升級執行",
        description: "於維護視窗執行韌體升級，完成後驗證網路連通性",
        category: TaskCategory.PLANNED,
        primaryAssigneeId: engineers[0].id,
        backupAssigneeId: engineers[1].id,
        creatorId: admin.id,
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.P1,
        dueDate: new Date("2026-03-28"),
        startDate: new Date("2026-03-15"),
        estimatedHours: 16,
        actualHours: 8,
        progressPct: 50,
        tags: ["網路", "交換機", "升級"],
      },
      {
        monthlyGoalId: aprilGoal.id,
        title: "Prometheus 部署與設定",
        description: "在 Docker 環境部署 Prometheus，設定監控目標",
        category: TaskCategory.PLANNED,
        primaryAssigneeId: engineers[2].id,
        backupAssigneeId: engineers[3].id,
        creatorId: admin.id,
        status: TaskStatus.TODO,
        priority: Priority.P2,
        dueDate: new Date("2026-04-15"),
        estimatedHours: 12,
        actualHours: 0,
        progressPct: 0,
        tags: ["監控", "Prometheus", "Docker"],
      },
      {
        title: "處理 MIS 系統登入異常",
        description: "用戶回報 MIS 系統偶發登入失敗，需排查原因",
        category: TaskCategory.INCIDENT,
        primaryAssigneeId: engineers[1].id,
        creatorId: admin.id,
        status: TaskStatus.IN_PROGRESS,
        priority: Priority.P0,
        dueDate: new Date("2026-03-25"),
        addedDate: new Date("2026-03-24"),
        addedReason: "用戶回報系統異常",
        addedSource: "事件通報",
        estimatedHours: 4,
        actualHours: 2,
        progressPct: 50,
        tags: ["MIS", "資安", "緊急"],
      },
    ],
  });

  console.log("✅ 建立 4 個範例任務");
  console.log("\n🎉 種子資料建立完成！");
  console.log("\n登入帳號：");
  console.log("  主管：admin / admin123");
  console.log("  工程師：eng01 ~ eng04 / engineer123");
}

main()
  .catch((e) => {
    console.error("❌ 種子資料建立失敗：", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
