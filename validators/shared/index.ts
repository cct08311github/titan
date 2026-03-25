/**
 * Barrel export for shared validators — Issue #396
 *
 * Import from '@/validators/shared' to get schemas and types
 * usable in both frontend forms and API route handlers.
 *
 * Example:
 *   import { createTaskSchema, type CreateTaskInput } from '@/validators/shared';
 */

export * from "./enums";
export * from "./task";
export * from "./plan";
export * from "./kpi";
export * from "./time-entry";
export * from "./user";
