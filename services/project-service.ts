/**
 * ProjectService — PMO project management (Issue #1168)
 *
 * Handles CRUD for projects, risks, issues, stakeholders, gates,
 * and post-review scoring.
 */

import { PrismaClient, Prisma, ProjectStatus } from "@prisma/client";
import { NotFoundError, ValidationError } from "./errors";

// ── Default Gate definitions ────────────────────────────────────────────────

const DEFAULT_GATES = [
  {
    name: "G1 需求確認",
    phase: "REQUIREMENTS",
    order: 1,
    checklist: [
      { item: "需求文件完成", checked: false, note: "" },
      { item: "需求方簽核", checked: false, note: "" },
      { item: "範圍確認", checked: false, note: "" },
      { item: "驗收條件定義", checked: false, note: "" },
    ],
  },
  {
    name: "G2 設計審查",
    phase: "DESIGN",
    order: 2,
    checklist: [
      { item: "架構設計文件", checked: false, note: "" },
      { item: "技術方案確認", checked: false, note: "" },
      { item: "安全審查通過", checked: false, note: "" },
      { item: "資料庫設計確認", checked: false, note: "" },
    ],
  },
  {
    name: "G3 開發完成",
    phase: "DEVELOPMENT",
    order: 3,
    checklist: [
      { item: "程式碼完成", checked: false, note: "" },
      { item: "單元測試通過", checked: false, note: "" },
      { item: "Code Review 完成", checked: false, note: "" },
      { item: "技術債務清理", checked: false, note: "" },
    ],
  },
  {
    name: "G4 UAT 通過",
    phase: "TESTING",
    order: 4,
    checklist: [
      { item: "SIT 測試通過", checked: false, note: "" },
      { item: "UAT 測試通過", checked: false, note: "" },
      { item: "效能測試通過", checked: false, note: "" },
      { item: "安全弱點掃描通過", checked: false, note: "" },
      { item: "使用者簽核", checked: false, note: "" },
    ],
  },
  {
    name: "G5 上線核准",
    phase: "DEPLOYMENT",
    order: 5,
    checklist: [
      { item: "上線計畫確認", checked: false, note: "" },
      { item: "回滾方案確認", checked: false, note: "" },
      { item: "維運交接完成", checked: false, note: "" },
      { item: "監控告警設定", checked: false, note: "" },
      { item: "教育訓練完成", checked: false, note: "" },
      { item: "主管核准", checked: false, note: "" },
    ],
  },
];

// ── Urgency weight map ──────────────────────────────────────────────────────

const URGENCY_WEIGHT: Record<string, number> = {
  HIGH: 1.5,
  MEDIUM: 1.0,
  LOW: 0.7,
};

// ── Probability/Impact numeric map ──────────────────────────────────────────

const PROB_NUM: Record<string, number> = {
  LOW: 1, MEDIUM: 2, HIGH: 3, VERY_HIGH: 4,
};
const IMPACT_NUM: Record<string, number> = {
  LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4,
};

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ListProjectsFilter {
  year?: number;
  status?: ProjectStatus | string; // supports comma-separated for multi-status (Issue #1176)
  requestDept?: string;
  priority?: string;
  ownerId?: string; // Issue #1176
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ── Service ─────────────────────────────────────────────────────────────────

export class ProjectService {
  constructor(private readonly prisma: PrismaClient) {}

  // ── List ────────────────────────────────────────────────────────────────

  async listProjects(filter: ListProjectsFilter) {
    const page = filter.page ?? 1;
    const limit = Math.min(filter.limit ?? 20, 100);
    const VALID_SORT_FIELDS = new Set(["code","name","year","status","priority","progressPct","plannedEnd","createdAt","benefitScore","priorityScore"]);
    const safeSortBy = VALID_SORT_FIELDS.has(filter.sortBy ?? "") ? filter.sortBy! : "createdAt";
    const sortOrder = filter.sortOrder ?? "desc";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { archivedAt: null };

    if (filter.year) where.year = filter.year;
    if (filter.status) {
      const statusStr = String(filter.status);
      if (statusStr.includes(",")) {
        where.status = { in: statusStr.split(",") };
      } else {
        where.status = filter.status;
      }
    }
    if (filter.requestDept) where.requestDept = filter.requestDept;
    if (filter.priority) where.priority = filter.priority;
    if (filter.ownerId) where.ownerId = filter.ownerId; // Issue #1176
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: "insensitive" } },
        { code: { contains: filter.search, mode: "insensitive" } },
        { requestDept: { contains: filter.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        select: {
          id: true,
          code: true,
          year: true,
          name: true,
          description: true,
          category: true,
          subCategory: true,
          tags: true,
          requestDept: true,
          requestContact: true,
          requestPhone: true,
          requestDate: true,
          coDepts: true,
          coContacts: true,
          devDept: true,
          ownerId: true,
          leadDevId: true,
          teamMembers: true,
          priority: true,
          urgency: true,
          strategicAlign: true,
          priorityScore: true,
          benefitRevenue: true,
          benefitCompliance: true,
          benefitEfficiency: true,
          benefitRisk: true,
          benefitScore: true,
          feasibility: true,
          techComplexity: true,
          riskLevel: true,
          mdTotalEstimated: true,
          mdActualTotal: true,
          budgetTotal: true,
          budgetActual: true,
          budgetApproved: true,
          costPerManDay: true,
          vendor: true,
          vendorAmount: true,
          plannedStart: true,
          plannedEnd: true,
          actualStart: true,
          actualEnd: true,
          goLiveDate: true,
          warrantyEndDate: true,
          status: true,
          phase: true,
          progressPct: true,
          progressNote: true,
          blockers: true,
          nextSteps: true,
          currentGate: true,
          gateStatus: true,
          progressUpdatedAt: true,
          approvalStatus: true,
          postReviewScore: true,
          postReviewDate: true,
          createdAt: true,
          updatedAt: true,
          archivedAt: true,
          owner: { select: { id: true, name: true, avatar: true } },
          _count: {
            select: {
              risks: true,
              issues: true,
              stakeholders: true,
              gates: true,
              tasks: true,
            },
          },
        },
        orderBy: { [safeSortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  // ── Get detail ──────────────────────────────────────────────────────────

  async getProject(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, avatar: true } },
        risks: {
          orderBy: { createdAt: "desc" },
          include: { owner: { select: { id: true, name: true } } },
        },
        issues: {
          orderBy: { createdAt: "desc" },
          include: { assignee: { select: { id: true, name: true } } },
        },
        stakeholders: { orderBy: { createdAt: "asc" } },
        gates: {
          orderBy: { order: "asc" },
          include: { reviewer: { select: { id: true, name: true } } },
        },
        _count: { select: { tasks: true } },
      },
    });

    if (!project) throw new NotFoundError(`項目不存在: ${id}`);
    return project;
  }

  // ── Create ──────────────────────────────────────────────────────────────

  async createProject(input: Record<string, unknown>) {
    const year = (input.year as number) ?? new Date().getFullYear();

    let retries = 3;
    while (retries > 0) {
      try {
        const project = await this.prisma.$transaction(async (tx) => {
          // Auto-generate code: PRJ-{year}-{seq:3}
          const lastProject = await tx.project.findFirst({
            where: { year },
            orderBy: { code: "desc" },
            select: { code: true },
          });

          let seq = 1;
          if (lastProject?.code) {
            const parts = lastProject.code.split("-");
            const lastSeq = parseInt(parts[parts.length - 1]);
            if (!isNaN(lastSeq)) seq = lastSeq + 1;
          }
          const code = `PRJ-${year}-${String(seq).padStart(3, "0")}`;

          return tx.project.create({
            data: {
              code,
              year,
              name: input.name as string,
              description: (input.description as string) ?? null,
              category: (input.category as string) ?? null,
              subCategory: (input.subCategory as string) ?? null,
              tags: (input.tags as string[]) ?? [],
              requestDept: input.requestDept as string,
              requestContact: (input.requestContact as string) ?? null,
              requestPhone: (input.requestPhone as string) ?? null,
              requestDate: input.requestDate ? new Date(input.requestDate as string) : null,
              businessGoal: (input.businessGoal as string) ?? null,
              coDepts: (input.coDepts as string[]) ?? [],
              coContacts: (input.coContacts as string[]) ?? [],
              devDept: (input.devDept as string) ?? null,
              ownerId: input.ownerId as string,
              createdBy: input.createdBy as string,
              leadDevId: (input.leadDevId as string) ?? null,
              teamMembers: (input.teamMembers as string[]) ?? [],
              priority: (input.priority as string) ?? "P2",
              urgency: (input.urgency as string) ?? "MEDIUM",
              plannedStart: input.plannedStart ? new Date(input.plannedStart as string) : null,
              plannedEnd: input.plannedEnd ? new Date(input.plannedEnd as string) : null,
              vendor: (input.vendor as string) ?? null,
              vendorContact: (input.vendorContact as string) ?? null,
              vendorContract: (input.vendorContract as string) ?? null,
              vendorAmount: (input.vendorAmount as number) ?? null,
              // Benefit scores
              benefitRevenue: (input.benefitRevenue as number) ?? null,
              benefitCompliance: (input.benefitCompliance as number) ?? null,
              benefitEfficiency: (input.benefitEfficiency as number) ?? null,
              benefitRisk: (input.benefitRisk as number) ?? null,
              benefitScore: ((input.benefitRevenue as number) ?? 0) + ((input.benefitCompliance as number) ?? 0) + ((input.benefitEfficiency as number) ?? 0) + ((input.benefitRisk as number) ?? 0) || null,
              // Feasibility
              feasibility: (input.feasibility as string) ?? "PENDING",
              techComplexity: (input.techComplexity as string) ?? null,
              riskLevel: (input.riskLevel as string) ?? "MEDIUM",
              // Man-days
              mdProjectMgmt: (input.mdProjectMgmt as number) ?? null,
              mdRequirements: (input.mdRequirements as number) ?? null,
              mdDesign: (input.mdDesign as number) ?? null,
              mdDevelopment: (input.mdDevelopment as number) ?? null,
              mdTesting: (input.mdTesting as number) ?? null,
              mdDeployment: (input.mdDeployment as number) ?? null,
              mdDocumentation: (input.mdDocumentation as number) ?? null,
              mdTraining: (input.mdTraining as number) ?? null,
              mdMaintenance: (input.mdMaintenance as number) ?? null,
              mdOther: (input.mdOther as number) ?? null,
              mdTotalEstimated: [input.mdProjectMgmt, input.mdRequirements, input.mdDesign, input.mdDevelopment, input.mdTesting, input.mdDeployment, input.mdDocumentation, input.mdTraining, input.mdMaintenance, input.mdOther].reduce((s: number, v) => s + ((v as number) ?? 0), 0) || null,
              // Budget
              budgetExternal: (input.budgetExternal as number) ?? null,
              costPerManDay: (input.costPerManDay as number) ?? 5000,
              // Progress
              progressPct: (input.progressPct as number) ?? 0,
              progressNote: (input.progressNote as string) ?? null,
              blockers: (input.blockers as string) ?? null,
              // Post review
              postReviewSchedule: (input.postReviewSchedule as number) ?? null,
              postReviewQuality: (input.postReviewQuality as number) ?? null,
              postReviewBudget: (input.postReviewBudget as number) ?? null,
              postReviewSatisfy: (input.postReviewSatisfy as number) ?? null,
              lessonsLearned: (input.lessonsLearned as string) ?? null,
              // Auto-create 5 default gates
              gates: {
                create: DEFAULT_GATES.map((g) => ({
                  name: g.name,
                  phase: g.phase,
                  order: g.order,
                  checklist: g.checklist,
                })),
              },
            },
            include: {
              owner: { select: { id: true, name: true } },
              gates: { orderBy: { order: "asc" } },
            },
          });
        });

        return project;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && retries > 1) {
          retries--;
          continue;
        }
        throw e;
      }
    }
    // Unreachable, but TypeScript needs it
    throw new Error("createProject: exhausted retries");
  }

  // ── Update ──────────────────────────────────────────────────────────────

  async updateProject(id: string, input: Record<string, unknown>) {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`項目不存在: ${id}`);
    if (existing.archivedAt) throw new ValidationError("項目已封存，不可編輯");

    // Build update data — only set provided fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};

    // Date fields that need conversion
    const dateFields = [
      "requestDate", "benefitDate", "vendorStartDate", "vendorEndDate",
      "plannedStart", "plannedEnd", "actualStart", "actualEnd",
      "goLiveDate", "warrantyEndDate", "approvedDate",
    ];

    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      if (dateFields.includes(key)) {
        data[key] = value ? new Date(value as string) : null;
      } else {
        data[key] = value;
      }
    }

    // Auto-calculate benefitScore
    const benefitRevenue = (input.benefitRevenue ?? existing.benefitRevenue) as number | null;
    const benefitCompliance = (input.benefitCompliance ?? existing.benefitCompliance) as number | null;
    const benefitEfficiency = (input.benefitEfficiency ?? existing.benefitEfficiency) as number | null;
    const benefitRisk = (input.benefitRisk ?? existing.benefitRisk) as number | null;
    if (
      benefitRevenue != null || benefitCompliance != null ||
      benefitEfficiency != null || benefitRisk != null
    ) {
      data.benefitScore =
        (benefitRevenue ?? 0) + (benefitCompliance ?? 0) +
        (benefitEfficiency ?? 0) + (benefitRisk ?? 0);
    }

    // Auto-calculate mdTotalEstimated
    const mdFields = [
      "mdProjectMgmt", "mdRequirements", "mdDesign", "mdDevelopment",
      "mdTesting", "mdDeployment", "mdDocumentation", "mdTraining",
      "mdMaintenance", "mdOther",
    ];
    const hasMdUpdate = mdFields.some((f) => input[f] !== undefined);
    if (hasMdUpdate) {
      let total = 0;
      for (const f of mdFields) {
        const val = (input[f] !== undefined ? input[f] : (existing as Record<string, unknown>)[f]) as number | null;
        total += val ?? 0;
      }
      data.mdTotalEstimated = total;
    }

    // Auto-calculate budgetTotal
    const budgetFields = [
      "budgetInternal", "budgetExternal", "budgetHardware",
      "budgetLicense", "budgetOther",
    ];
    const hasBudgetUpdate = budgetFields.some((f) => input[f] !== undefined);
    if (hasBudgetUpdate) {
      let total = 0;
      for (const f of budgetFields) {
        const val = (input[f] !== undefined ? input[f] : (existing as Record<string, unknown>)[f]) as number | null;
        total += val ?? 0;
      }
      data.budgetTotal = total;
    }

    // Auto-calculate priorityScore
    const urgency = (input.urgency ?? existing.urgency) as string | null;
    const benefitScoreVal = data.benefitScore ?? existing.benefitScore;
    const strategicAlign = (input.strategicAlign ?? existing.strategicAlign) as number | null;
    if (benefitScoreVal != null || strategicAlign != null) {
      const urgencyW = URGENCY_WEIGHT[urgency ?? "MEDIUM"] ?? 1.0;
      data.priorityScore = Math.round(
        (benefitScoreVal ?? 0) * urgencyW + (strategicAlign ?? 0) * 10
      );
    }

    // Update progressUpdatedAt if progress fields change
    if (
      input.progressPct !== undefined ||
      input.progressNote !== undefined ||
      input.status !== undefined
    ) {
      data.progressUpdatedAt = new Date();
    }

    const project = await this.prisma.project.update({
      where: { id },
      data,
      include: {
        owner: { select: { id: true, name: true } },
        gates: { orderBy: { order: "asc" } },
        _count: { select: { risks: true, issues: true, tasks: true } },
      },
    });

    return project;
  }

  // ── Delete (soft) ───────────────────────────────────────────────────────

  async deleteProject(id: string) {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`項目不存在: ${id}`);

    return this.prisma.project.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  // ── Post-review ─────────────────────────────────────────────────────────

  async submitReview(id: string, input: Record<string, unknown>, reviewerId: string) {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`項目不存在: ${id}`);
    if (existing.archivedAt) throw new ValidationError("項目已封存");
    if (existing.postReviewDate) throw new ValidationError("後評價已提交，不可重複");
    const allowedStatuses = ["COMPLETED", "WARRANTY"];
    if (!allowedStatuses.includes(existing.status)) throw new ValidationError("只有已完成的專案才能提交後評價");

    const schedule = input.postReviewSchedule as number;
    const quality = input.postReviewQuality as number;
    const budget = input.postReviewBudget as number;
    const satisfy = input.postReviewSatisfy as number;

    return this.prisma.project.update({
      where: { id },
      data: {
        postReviewSchedule: schedule,
        postReviewQuality: quality,
        postReviewBudget: budget,
        postReviewSatisfy: satisfy,
        postReviewScore: schedule + quality + budget + satisfy,
        postReviewNote: (input.postReviewNote as string) ?? null,
        lessonsLearned: (input.lessonsLearned as string) ?? null,
        improvements: (input.improvements as string) ?? null,
        postReviewBy: reviewerId,
        postReviewDate: new Date(),
        status: "POST_REVIEW",
      },
    });
  }

  // ── Risk CRUD ─────────────────────────────────────────────────────────

  async listRisks(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectRisk.findMany({
      where: { projectId },
      include: { owner: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async createRisk(projectId: string, input: Record<string, unknown>) {
    await this.ensureProject(projectId);

    // Auto-generate code
    const count = await this.prisma.projectRisk.count({ where: { projectId } });
    const code = `RISK-${String(count + 1).padStart(3, "0")}`;

    // Auto-calculate risk score
    const probNum = PROB_NUM[(input.probability as string)] ?? 1;
    const impactNum = IMPACT_NUM[(input.impact as string)] ?? 1;

    return this.prisma.projectRisk.create({
      data: {
        projectId,
        code,
        title: input.title as string,
        description: (input.description as string) ?? null,
        category: (input.category as string) ?? null,
        probability: input.probability as string,
        impact: input.impact as string,
        riskScore: probNum * impactNum,
        mitigation: (input.mitigation as string) ?? null,
        contingency: (input.contingency as string) ?? null,
        ownerId: input.ownerId as string,
        status: (input.status as string) ?? "OPEN",
        dueDate: input.dueDate ? new Date(input.dueDate as string) : null,
      },
      include: { owner: { select: { id: true, name: true } } },
    });
  }

  async updateRisk(riskId: string, input: Record<string, unknown>, projectId?: string) {
    const existing = await this.prisma.projectRisk.findUnique({ where: { id: riskId } });
    if (!existing) throw new NotFoundError(`風險不存在: ${riskId}`);
    if (projectId && existing.projectId !== projectId) throw new ValidationError("資源不屬於此項目");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      if (key === "dueDate") {
        data[key] = value ? new Date(value as string) : null;
      } else {
        data[key] = value;
      }
    }

    // Recalculate risk score if probability or impact changed
    const prob = (input.probability ?? existing.probability) as string;
    const impact = (input.impact ?? existing.impact) as string;
    data.riskScore = (PROB_NUM[prob] ?? 1) * (IMPACT_NUM[impact] ?? 1);

    return this.prisma.projectRisk.update({
      where: { id: riskId },
      data,
      include: { owner: { select: { id: true, name: true } } },
    });
  }

  async deleteRisk(riskId: string, projectId?: string) {
    const existing = await this.prisma.projectRisk.findUnique({ where: { id: riskId } });
    if (!existing) throw new NotFoundError(`風險不存在: ${riskId}`);
    if (projectId && existing.projectId !== projectId) throw new ValidationError("資源不屬於此項目");
    return this.prisma.projectRisk.delete({ where: { id: riskId } });
  }

  // ── Issue CRUD ────────────────────────────────────────────────────────

  async listIssues(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectIssue.findMany({
      where: { projectId },
      include: { assignee: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async createIssue(projectId: string, input: Record<string, unknown>) {
    await this.ensureProject(projectId);

    const count = await this.prisma.projectIssue.count({ where: { projectId } });
    const code = `ISS-${String(count + 1).padStart(3, "0")}`;

    return this.prisma.projectIssue.create({
      data: {
        projectId,
        code,
        title: input.title as string,
        description: (input.description as string) ?? null,
        category: (input.category as string) ?? null,
        severity: input.severity as string,
        assigneeId: input.assigneeId as string,
        status: (input.status as string) ?? "OPEN",
        resolution: (input.resolution as string) ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate as string) : null,
        source: (input.source as string) ?? null,
      },
      include: { assignee: { select: { id: true, name: true } } },
    });
  }

  async updateIssue(issueId: string, input: Record<string, unknown>, projectId?: string) {
    const existing = await this.prisma.projectIssue.findUnique({ where: { id: issueId } });
    if (!existing) throw new NotFoundError(`議題不存在: ${issueId}`);
    if (projectId && existing.projectId !== projectId) throw new ValidationError("資源不屬於此項目");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      if (key === "dueDate") {
        data[key] = value ? new Date(value as string) : null;
      } else {
        data[key] = value;
      }
    }

    return this.prisma.projectIssue.update({
      where: { id: issueId },
      data,
      include: { assignee: { select: { id: true, name: true } } },
    });
  }

  async deleteIssue(issueId: string, projectId?: string) {
    const existing = await this.prisma.projectIssue.findUnique({ where: { id: issueId } });
    if (!existing) throw new NotFoundError(`議題不存在: ${issueId}`);
    if (projectId && existing.projectId !== projectId) throw new ValidationError("資源不屬於此項目");
    return this.prisma.projectIssue.delete({ where: { id: issueId } });
  }

  // ── Stakeholder CRUD ──────────────────────────────────────────────────

  async listStakeholders(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectStakeholder.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
  }

  async createStakeholder(projectId: string, input: Record<string, unknown>) {
    await this.ensureProject(projectId);

    return this.prisma.projectStakeholder.create({
      data: {
        projectId,
        name: input.name as string,
        department: (input.department as string) ?? null,
        role: (input.role as string) ?? null,
        influence: (input.influence as string) ?? null,
        interest: (input.interest as string) ?? null,
        engagement: (input.engagement as string) ?? null,
        commStrategy: (input.commStrategy as string) ?? null,
        contactInfo: (input.contactInfo as string) ?? null,
      },
    });
  }

  async deleteStakeholder(stakeholderId: string, projectId?: string) {
    const existing = await this.prisma.projectStakeholder.findUnique({ where: { id: stakeholderId } });
    if (!existing) throw new NotFoundError(`利害關係人不存在: ${stakeholderId}`);
    if (projectId && existing.projectId !== projectId) throw new ValidationError("資源不屬於此項目");
    return this.prisma.projectStakeholder.delete({ where: { id: stakeholderId } });
  }

  // ── Gate ──────────────────────────────────────────────────────────────

  async listGates(projectId: string) {
    await this.ensureProject(projectId);
    return this.prisma.projectGate.findMany({
      where: { projectId },
      include: { reviewer: { select: { id: true, name: true } } },
      orderBy: { order: "asc" },
    });
  }

  async updateGate(gateId: string, input: Record<string, unknown>, reviewerId: string, projectId?: string) {
    const existing = await this.prisma.projectGate.findUnique({ where: { id: gateId } });
    if (!existing) throw new NotFoundError(`Gate 不存在: ${gateId}`);
    if (projectId && existing.projectId !== projectId) throw new ValidationError("資源不屬於此項目");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};

    if (input.checklist !== undefined) {
      data.checklist = input.checklist;
      // Auto-calculate checklistPassed
      const items = input.checklist as Array<{ checked: boolean }>;
      data.checklistPassed = items.length > 0 && items.every((i) => i.checked);
    }

    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === "PASSED" || input.status === "BLOCKED" || input.status === "WAIVED") {
        data.reviewerId = reviewerId;
        data.reviewedAt = new Date();
      }
    }

    if (input.reviewNote !== undefined) data.reviewNote = input.reviewNote;
    if (input.blockerNote !== undefined) data.blockerNote = input.blockerNote;
    if (input.waiverReason !== undefined) data.waiverReason = input.waiverReason;
    if (input.attachments !== undefined) data.attachments = input.attachments;

    return this.prisma.projectGate.update({
      where: { id: gateId },
      data,
      include: { reviewer: { select: { id: true, name: true } } },
    });
  }

  // ── Dashboard stats ───────────────────────────────────────────────────

  async getDashboardStats(year?: number) {
    const currentYear = year ?? new Date().getFullYear();
    const where = { year: currentYear, archivedAt: null as null };

    const [
      total,
      byStatus,
      byPriority,
      byDept,
      avgProgress,
      riskCount,
      openIssueCount,
    ] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.groupBy({
        by: ["status"],
        where,
        _count: { id: true },
      }),
      this.prisma.project.groupBy({
        by: ["priority"],
        where,
        _count: { id: true },
      }),
      this.prisma.project.groupBy({
        by: ["requestDept"],
        where,
        _count: { id: true },
      }),
      this.prisma.project.aggregate({
        where,
        _avg: { progressPct: true },
      }),
      this.prisma.projectRisk.count({
        where: {
          project: { year: currentYear, archivedAt: null },
          status: { in: ["OPEN", "MITIGATING"] },
        },
      }),
      this.prisma.projectIssue.count({
        where: {
          project: { year: currentYear, archivedAt: null },
          status: { in: ["OPEN", "IN_PROGRESS", "ESCALATED"] },
        },
      }),
    ]);

    return {
      year: currentYear,
      total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count.id })),
      byDept: byDept.map((d) => ({ dept: d.requestDept, count: d._count.id })),
      avgProgress: Math.round(avgProgress._avg.progressPct ?? 0),
      openRisks: riskCount,
      openIssues: openIssueCount,
    };
  }

  // ── Export (CSV) ──────────────────────────────────────────────────────

  // ── Excel export data ────────────────────────────────────────────────────

  async getProjectsForExport(filter: ListProjectsFilter) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { archivedAt: null };
    if (filter.year) where.year = filter.year;
    if (filter.status) where.status = filter.status;
    if (filter.requestDept) where.requestDept = filter.requestDept;

    return this.prisma.project.findMany({
      where,
      include: {
        owner: { select: { name: true } },
      },
      orderBy: { code: "asc" },
    });
  }

  async exportCsv(filter: ListProjectsFilter) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { archivedAt: null };
    if (filter.year) where.year = filter.year;
    if (filter.status) where.status = filter.status;
    if (filter.requestDept) where.requestDept = filter.requestDept;

    const projects = await this.prisma.project.findMany({
      where,
      include: {
        owner: { select: { name: true } },
      },
      orderBy: { code: "asc" },
    });

    const headers = [
      "編號", "名稱", "年度", "需求部門", "狀態", "優先級",
      "負責人", "效益總分", "預估人天", "預算總額", "進度%",
      "計劃開始", "計劃結束",
    ];

    const rows = projects.map((p) => [
      p.code,
      `"${(p.name || "").replace(/"/g, '""')}"`,
      p.year,
      p.requestDept,
      p.status,
      p.priority,
      p.owner.name,
      p.benefitScore ?? "",
      p.mdTotalEstimated ?? "",
      p.budgetTotal ?? "",
      p.progressPct,
      p.plannedStart ? p.plannedStart.toISOString().split("T")[0] : "",
      p.plannedEnd ? p.plannedEnd.toISOString().split("T")[0] : "",
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  // ── Private helpers ───────────────────────────────────────────────────

  private async ensureProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, archivedAt: true },
    });
    if (!project) throw new NotFoundError(`項目不存在: ${projectId}`);
    if (project.archivedAt) throw new ValidationError("項目已封存，不可操作");
  }
}
