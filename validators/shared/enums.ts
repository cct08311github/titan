/**
 * Shared Zod enum schemas — Issue #396
 *
 * Single source of truth for enum values used by both frontend forms
 * and API route validation. Import from here to avoid duplication.
 */

import { z } from "zod";

// ── Task ────────────────────────────────────────────────────────────────────

export const TaskStatusEnum = z.enum([
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
]);

export const PriorityEnum = z.enum(["P0", "P1", "P2", "P3"]);

export const TaskCategoryEnum = z.enum([
  "PLANNED",
  "ADDED",
  "INCIDENT",
  "SUPPORT",
  "ADMIN",
  "LEARNING",
]);

// ── Incident ────────────────────────────────────────────────────────────────

export const IncidentSeverityEnum = z.enum(["SEV1", "SEV2", "SEV3", "SEV4"]);

// ── Change Management ──────────────────────────────────────────────────

export const CMChangeTypeEnum = z.enum(["NORMAL", "STANDARD", "EMERGENCY"]);

export const RiskLevelEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const ChangeStatusEnum = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "IN_PROGRESS",
  "VERIFYING",
  "COMPLETED",
  "ROLLED_BACK",
  "CANCELLED",
]);

// ── Plan / Goal ─────────────────────────────────────────────────────────────

export const GoalStatusEnum = z.enum([
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

// ── Document ────────────────────────────────────────────────────────────────

export const DocumentStatusEnum = z.enum([
  "DRAFT",
  "IN_REVIEW",
  "PUBLISHED",
  "ARCHIVED",
  "RETIRED",
]);

// ── KPI ─────────────────────────────────────────────────────────────────────

export const KpiStatusEnum = z.enum([
  "DRAFT",
  "ACTIVE",
  "ACHIEVED",
  "MISSED",
  "CANCELLED",
]);

export const KpiFrequencyEnum = z.enum([
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
]);

export const KpiVisibilityEnum = z.enum([
  "ALL",
  "MANAGER",
]);

// ── Time Entry ──────────────────────────────────────────────────────────────

export const TimeCategoryEnum = z.enum([
  "PLANNED_TASK",
  "ADDED_TASK",
  "INCIDENT",
  "SUPPORT",
  "ADMIN",
  "LEARNING",
]);

// ── Timesheet Approval ─────────────────────────────────────────────────────

export const TimesheetApprovalStatusEnum = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

// ── User ────────────────────────────────────────────────────────────────────

export const RoleEnum = z.enum(["ADMIN", "MANAGER", "ENGINEER"]);

// ── Inferred TypeScript types ───────────────────────────────────────────────

export type TaskStatus = z.infer<typeof TaskStatusEnum>;
export type Priority = z.infer<typeof PriorityEnum>;
export type TaskCategory = z.infer<typeof TaskCategoryEnum>;
export type GoalStatus = z.infer<typeof GoalStatusEnum>;
export type KpiStatus = z.infer<typeof KpiStatusEnum>;
export type TimeCategory = z.infer<typeof TimeCategoryEnum>;
export type TimesheetApprovalStatus = z.infer<typeof TimesheetApprovalStatusEnum>;
export type Role = z.infer<typeof RoleEnum>;
export type IncidentSeverity = z.infer<typeof IncidentSeverityEnum>;
export type KpiFrequency = z.infer<typeof KpiFrequencyEnum>;
export type KpiVisibility = z.infer<typeof KpiVisibilityEnum>;
export type CMChangeType = z.infer<typeof CMChangeTypeEnum>;
export type RiskLevel = z.infer<typeof RiskLevelEnum>;
export type ChangeStatus = z.infer<typeof ChangeStatusEnum>;
export type DocumentStatus = z.infer<typeof DocumentStatusEnum>;
