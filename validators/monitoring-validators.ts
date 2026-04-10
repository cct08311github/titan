import { z } from "zod";

export const webhookPayloadSchema = z.object({
  alertName: z.string().min(1),
  severity: z.string().min(1),
  status: z.enum(["firing", "resolved"]),
  labels: z.record(z.string(), z.unknown()).optional(),
  annotations: z.object({
    summary: z.string().optional(),
    description: z.string().optional(),
  }).optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
  source: z.string().optional(),
});

export const acknowledgeAlertSchema = z.object({
  action: z.literal("acknowledge"),
});

export const createTaskFromAlertSchema = z.object({
  action: z.literal("create_task"),
});

export const kpiHistorySchema = z.object({
  actual: z.number().finite().min(-1e9).max(1e9),  // guard against Infinity/NaN/overflow
  period: z.string().regex(/^\d{4}-\d{2}$/),
  source: z.string().max(500).optional(),
});
