/**
 * PMO Project Management — shared types (Issue #1168 / #1178)
 */

export interface ProjectListItem {
  id: string;
  code: string;
  year: number;
  name: string;
  category: string | null;
  requestDept: string;
  status: string;
  priority: string;
  benefitScore: number | null;
  mdTotalEstimated: number | null;
  mdActualTotal: number | null;
  progressPct: number;
  plannedEnd: string | null;
  owner: { id: string; name: string; avatar?: string | null };
  _count: {
    risks: number;
    issues: number;
    stakeholders: number;
    gates: number;
    tasks: number;
  };
}

export interface ProjectDetail {
  id: string;
  code: string;
  year: number;
  name: string;
  description: string | null;
  category: string | null;
  subCategory: string | null;
  tags: string[];
  requestDept: string;
  requestContact: string | null;
  requestPhone: string | null;
  requestDate: string | null;
  businessGoal: string | null;
  coDepts: string[];
  coContacts: string[];
  devDept: string | null;
  ownerId: string;
  leadDevId: string | null;
  teamMembers: string[];
  benefitRevenue: number | null;
  benefitCompliance: number | null;
  benefitEfficiency: number | null;
  benefitRisk: number | null;
  benefitScore: number | null;
  benefitNote: string | null;
  priority: string;
  urgency: string | null;
  strategicAlign: number | null;
  priorityScore: number | null;
  feasibility: string | null;
  feasibilityNote: string | null;
  techComplexity: string | null;
  riskLevel: string | null;
  mdProjectMgmt: number | null;
  mdRequirements: number | null;
  mdDesign: number | null;
  mdDevelopment: number | null;
  mdTesting: number | null;
  mdDeployment: number | null;
  mdDocumentation: number | null;
  mdTraining: number | null;
  mdMaintenance: number | null;
  mdOther: number | null;
  mdTotalEstimated: number | null;
  mdActualTotal: number | null;
  budgetInternal: number | null;
  budgetExternal: number | null;
  budgetHardware: number | null;
  budgetLicense: number | null;
  budgetOther: number | null;
  budgetTotal: number | null;
  budgetActual: number | null;
  costPerManDay: number | null;
  vendor: string | null;
  vendorContact: string | null;
  vendorContract: string | null;
  vendorAmount: number | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  goLiveDate: string | null;
  warrantyEndDate: string | null;
  status: string;
  phase: string | null;
  progressPct: number;
  progressNote: string | null;
  blockers: string | null;
  nextSteps: string | null;
  currentGate: string | null;
  gateStatus: string | null;
  postReviewSchedule: number | null;
  postReviewQuality: number | null;
  postReviewBudget: number | null;
  postReviewSatisfy: number | null;
  postReviewScore: number | null;
  postReviewNote: string | null;
  lessonsLearned: string | null;
  improvements: string | null;
  owner: { id: string; name: string; avatar?: string | null };
  risks: ProjectRisk[];
  issues: ProjectIssue[];
  stakeholders: ProjectStakeholder[];
  gates: ProjectGate[];
  _count: { tasks: number };
}

export interface ProjectRisk {
  id: string;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  probability: string;
  impact: string;
  riskScore: number;
  mitigation: string | null;
  contingency: string | null;
  status: string;
  dueDate: string | null;
  owner: { id: string; name: string };
}

export interface ProjectIssue {
  id: string;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  severity: string;
  status: string;
  resolution: string | null;
  dueDate: string | null;
  source: string | null;
  assignee: { id: string; name: string };
}

export interface ProjectStakeholder {
  id: string;
  name: string;
  department: string | null;
  role: string | null;
  influence: string | null;
  interest: string | null;
  engagement: string | null;
}

export interface ChecklistItem {
  item: string;
  checked: boolean;
  note: string;
}

export interface ProjectGate {
  id: string;
  name: string;
  phase: string;
  order: number;
  checklist: ChecklistItem[];
  checklistPassed: boolean;
  status: string;
  reviewerId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  blockerNote: string | null;
  waiverReason: string | null;
  reviewer: { id: string; name: string } | null;
}

export interface DashboardStats {
  year: number;
  total: number;
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  byDept: { dept: string; count: number }[];
  avgProgress: number;
  openRisks: number;
  openIssues: number;
}

export interface UserOption {
  id: string;
  name: string;
}
