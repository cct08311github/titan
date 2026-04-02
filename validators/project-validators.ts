/**
 * Project validators — PMO project management (Issue #1168)
 */

import { z } from "zod";

// ── Project ─────────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: z.string().min(1, "項目名稱為必填").max(200),
  year: z.number().int().min(2020).max(2100).optional(),
  description: z.string().max(10000).optional(),
  category: z.string().max(100).optional(),
  subCategory: z.string().max(100).optional(),
  tags: z.array(z.string().max(30)).optional(),

  // 需求方
  requestDept: z.string().min(1, "需求部門為必填"),
  requestContact: z.string().max(50).optional(),
  requestPhone: z.string().max(20).optional(),
  requestDate: z.string().datetime().optional(),
  businessGoal: z.string().max(5000).optional(),

  // 協辦
  coDepts: z.array(z.string()).optional(),
  coContacts: z.array(z.string()).optional(),

  // IT 開發方
  devDept: z.string().optional(),
  ownerId: z.string().min(1, "專案負責人為必填"),
  leadDevId: z.string().optional(),
  teamMembers: z.array(z.string()).optional(),

  // 優先級
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  urgency: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),

  // 排期
  plannedStart: z.string().datetime().optional(),
  plannedEnd: z.string().datetime().optional(),

  // 廠商
  vendor: z.string().optional(),
  vendorContact: z.string().optional(),
  vendorContract: z.string().optional(),
  vendorAmount: z.number().min(0).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  description: z.string().max(10000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  subCategory: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().max(30)).optional(),

  // 需求方
  requestDept: z.string().min(1).optional(),
  requestContact: z.string().max(50).nullable().optional(),
  requestPhone: z.string().max(20).nullable().optional(),
  requestDate: z.string().datetime().nullable().optional(),
  businessGoal: z.string().max(5000).nullable().optional(),

  // 協辦
  coDepts: z.array(z.string()).optional(),
  coContacts: z.array(z.string()).optional(),

  // IT 開發方
  devDept: z.string().nullable().optional(),
  ownerId: z.string().min(1).optional(),
  leadDevId: z.string().nullable().optional(),
  teamMembers: z.array(z.string()).optional(),

  // 效益評估
  benefitRevenue: z.number().int().min(0).max(25).nullable().optional(),
  benefitCompliance: z.number().int().min(0).max(25).nullable().optional(),
  benefitEfficiency: z.number().int().min(0).max(25).nullable().optional(),
  benefitRisk: z.number().int().min(0).max(25).nullable().optional(),
  benefitNote: z.string().max(5000).nullable().optional(),
  benefitEvaluator: z.string().nullable().optional(),
  benefitDate: z.string().datetime().nullable().optional(),

  // 優先級
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  urgency: z.enum(["HIGH", "MEDIUM", "LOW"]).nullable().optional(),
  strategicAlign: z.number().int().min(0).max(10).nullable().optional(),
  priorityNote: z.string().max(500).nullable().optional(),

  // 可行性
  feasibility: z.enum(["PENDING", "FEASIBLE", "CONDITIONAL", "NOT_FEASIBLE"]).optional(),
  feasibilityNote: z.string().max(10000).nullable().optional(),
  techComplexity: z.enum(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]).nullable().optional(),
  techStack: z.string().max(500).nullable().optional(),
  dependencies: z.string().max(5000).nullable().optional(),
  constraints: z.string().max(5000).nullable().optional(),
  assumptions: z.string().max(5000).nullable().optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).nullable().optional(),
  riskNote: z.string().max(5000).nullable().optional(),

  // 人天
  mdProjectMgmt: z.number().min(0).max(9999).nullable().optional(),
  mdRequirements: z.number().min(0).max(9999).nullable().optional(),
  mdDesign: z.number().min(0).max(9999).nullable().optional(),
  mdDevelopment: z.number().min(0).max(9999).nullable().optional(),
  mdTesting: z.number().min(0).max(9999).nullable().optional(),
  mdDeployment: z.number().min(0).max(9999).nullable().optional(),
  mdDocumentation: z.number().min(0).max(9999).nullable().optional(),
  mdTraining: z.number().min(0).max(9999).nullable().optional(),
  mdMaintenance: z.number().min(0).max(9999).nullable().optional(),
  mdOther: z.number().min(0).max(9999).nullable().optional(),
  mdActualTotal: z.number().min(0).nullable().optional(),

  // 預算
  budgetInternal: z.number().min(0).nullable().optional(),
  budgetExternal: z.number().min(0).nullable().optional(),
  budgetHardware: z.number().min(0).nullable().optional(),
  budgetLicense: z.number().min(0).nullable().optional(),
  budgetOther: z.number().min(0).nullable().optional(),
  budgetActual: z.number().min(0).nullable().optional(),
  budgetApproved: z.boolean().optional(),
  budgetApprovalNo: z.string().nullable().optional(),
  costPerManDay: z.number().min(0).nullable().optional(),

  // 廠商
  vendor: z.string().nullable().optional(),
  vendorContact: z.string().nullable().optional(),
  vendorContract: z.string().nullable().optional(),
  vendorAmount: z.number().min(0).nullable().optional(),
  vendorStartDate: z.string().datetime().nullable().optional(),
  vendorEndDate: z.string().datetime().nullable().optional(),
  subVendors: z.array(z.string()).optional(),

  // 排期
  plannedStart: z.string().datetime().nullable().optional(),
  plannedEnd: z.string().datetime().nullable().optional(),
  actualStart: z.string().datetime().nullable().optional(),
  actualEnd: z.string().datetime().nullable().optional(),
  goLiveDate: z.string().datetime().nullable().optional(),
  warrantyEndDate: z.string().datetime().nullable().optional(),

  // 狀態
  status: z.enum([
    "PROPOSED", "EVALUATING", "APPROVED", "SCHEDULED",
    "REQUIREMENTS", "DESIGN", "DEVELOPMENT", "TESTING",
    "DEPLOYMENT", "WARRANTY", "COMPLETED", "POST_REVIEW",
    "CLOSED", "ON_HOLD", "CANCELLED",
  ]).optional(),
  phase: z.string().nullable().optional(),
  progressPct: z.number().min(0).max(100).optional(),
  progressNote: z.string().nullable().optional(),
  blockers: z.string().nullable().optional(),
  nextSteps: z.string().nullable().optional(),
  currentGate: z.string().nullable().optional(),
  gateStatus: z.enum(["PENDING", "PASSED", "BLOCKED"]).nullable().optional(),

  // 合規
  approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  approvedBy: z.string().nullable().optional(),
  approvedDate: z.string().datetime().nullable().optional(),
  approvalNo: z.string().nullable().optional(),
  relatedRegulation: z.string().nullable().optional(),
  internalNote: z.string().nullable().optional(),
});

// ── Risk ────────────────────────────────────────────────────────────────────

export const createRiskSchema = z.object({
  title: z.string().min(1, "風險名稱為必填").max(200),
  description: z.string().max(5000).optional(),
  category: z.string().optional(),
  probability: z.enum(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]),
  impact: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  mitigation: z.string().max(5000).optional(),
  contingency: z.string().max(5000).optional(),
  ownerId: z.string().min(1, "負責人為必填"),
  status: z.enum(["OPEN", "MITIGATING", "CLOSED", "ACCEPTED"]).optional(),
  dueDate: z.string().datetime().optional(),
});

export const updateRiskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  category: z.string().nullable().optional(),
  probability: z.enum(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]).optional(),
  impact: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  mitigation: z.string().max(5000).nullable().optional(),
  contingency: z.string().max(5000).nullable().optional(),
  ownerId: z.string().min(1).optional(),
  status: z.enum(["OPEN", "MITIGATING", "CLOSED", "ACCEPTED"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

// ── Issue ───────────────────────────────────────────────────────────────────

export const createIssueSchema = z.object({
  title: z.string().min(1, "議題名稱為必填").max(200),
  description: z.string().max(5000).optional(),
  category: z.string().optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  assigneeId: z.string().min(1, "負責人為必填"),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "ESCALATED"]).optional(),
  resolution: z.string().max(5000).optional(),
  dueDate: z.string().datetime().optional(),
  source: z.string().optional(),
});

export const updateIssueSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  category: z.string().nullable().optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assigneeId: z.string().min(1).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "ESCALATED"]).optional(),
  resolution: z.string().max(5000).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  source: z.string().nullable().optional(),
});

// ── Stakeholder ─────────────────────────────────────────────────────────────

export const createStakeholderSchema = z.object({
  name: z.string().min(1, "姓名為必填").max(100),
  department: z.string().optional(),
  role: z.string().optional(),
  influence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  interest: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  engagement: z.enum(["CHAMPION", "SUPPORTER", "NEUTRAL", "RESISTANT"]).optional(),
  commStrategy: z.string().max(5000).optional(),
  contactInfo: z.string().optional(),
});

// ── Gate ────────────────────────────────────────────────────────────────────

export const updateGateSchema = z.object({
  checklist: z.array(z.object({
    item: z.string(),
    checked: z.boolean(),
    note: z.string().optional(),
  })).optional(),
  status: z.enum(["PENDING", "PASSED", "BLOCKED", "WAIVED"]).optional(),
  reviewNote: z.string().max(5000).nullable().optional(),
  blockerNote: z.string().max(5000).nullable().optional(),
  waiverReason: z.string().max(5000).nullable().optional(),
  attachments: z.array(z.string()).optional(),
});

// ── Post-Review ─────────────────────────────────────────────────────────────

export const submitReviewSchema = z.object({
  postReviewSchedule: z.number().int().min(0).max(25),
  postReviewQuality: z.number().int().min(0).max(25),
  postReviewBudget: z.number().int().min(0).max(25),
  postReviewSatisfy: z.number().int().min(0).max(25),
  postReviewNote: z.string().max(10000).optional(),
  lessonsLearned: z.string().max(10000).optional(),
  improvements: z.string().max(10000).optional(),
});

// ── Type exports ────────────────────────────────────────────────────────────

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateRiskInput = z.infer<typeof createRiskSchema>;
export type UpdateRiskInput = z.infer<typeof updateRiskSchema>;
export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
export type CreateStakeholderInput = z.infer<typeof createStakeholderSchema>;
export type UpdateGateInput = z.infer<typeof updateGateSchema>;
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
