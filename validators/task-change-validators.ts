import { z } from "zod";

export const ChangeTypeEnum = z.enum(["DELAY", "SCOPE_CHANGE"]);

export const createTaskChangeSchema = z.object({
  changeType: ChangeTypeEnum,
  reason: z.string().min(1),
  oldValue: z.string().optional(),
  newValue: z.string().optional(),
});

export type CreateTaskChangeInput = z.infer<typeof createTaskChangeSchema>;
