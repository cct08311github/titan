import { z } from "zod";

const MilestoneStatusEnum = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "DELAYED",
  "CANCELLED",
]);

export const createMilestoneSchema = z
  .object({
    annualPlanId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    plannedStart: z.coerce.date().optional(),
    plannedEnd: z.coerce.date(),
    order: z.number().int().min(0).optional(),
  })
  .refine(
    (data) => {
      if (data.plannedStart && data.plannedEnd) {
        return data.plannedStart < data.plannedEnd;
      }
      return true;
    },
    { message: "plannedStart 必須早於 plannedEnd", path: ["plannedStart"] }
  );

export const updateMilestoneSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  plannedStart: z.coerce.date().optional(),
  plannedEnd: z.coerce.date().optional(),
  actualStart: z.coerce.date().optional(),
  actualEnd: z.coerce.date().optional(),
  status: MilestoneStatusEnum.optional(),
  order: z.number().int().min(0).optional(),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
