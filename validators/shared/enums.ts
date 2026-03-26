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

// ── Plan / Goal ─────────────────────────────────────────────────────────────

export const GoalStatusEnum = z.enum([
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

// ── KPI ─────────────────────────────────────────────────────────────────────

export const KpiStatusEnum = z.enum([
  "DRAFT",
  "ACTIVE",
  "ACHIEVED",
  "MISSED",
  "CANCELLED",
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
