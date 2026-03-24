import { z } from "zod";

const DeliverableTypeEnum = z.enum([
  "DOCUMENT",
  "SYSTEM",
  "REPORT",
  "APPROVAL",
]);

const DeliverableStatusEnum = z.enum([
  "NOT_STARTED",
  "IN_PROGRESS",
  "DELIVERED",
  "ACCEPTED",
]);

export const createDeliverableSchema = z.object({
  title: z.string().min(1),
  type: DeliverableTypeEnum,
  taskId: z.string().optional(),
  kpiId: z.string().optional(),
  annualPlanId: z.string().optional(),
  monthlyGoalId: z.string().optional(),
  attachmentUrl: z.string().url().optional(),
});

export const updateDeliverableSchema = z.object({
  title: z.string().min(1).optional(),
  status: DeliverableStatusEnum.optional(),
  attachmentUrl: z.string().url().nullable().optional(),
  acceptedBy: z.string().nullable().optional(),
  acceptedAt: z.string().datetime().nullable().optional(),
});

export const listDeliverablesSchema = z.object({
  taskId: z.string().optional(),
  kpiId: z.string().optional(),
  annualPlanId: z.string().optional(),
  monthlyGoalId: z.string().optional(),
  status: DeliverableStatusEnum.optional(),
  type: DeliverableTypeEnum.optional(),
});

export type CreateDeliverableInput = z.infer<typeof createDeliverableSchema>;
export type UpdateDeliverableInput = z.infer<typeof updateDeliverableSchema>;
export type ListDeliverablesQuery = z.infer<typeof listDeliverablesSchema>;
