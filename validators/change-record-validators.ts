import { z } from "zod";
import { CMChangeTypeEnum, RiskLevelEnum, ChangeStatusEnum } from "./shared/enums";

export const createChangeRecordSchema = z.object({
  type: CMChangeTypeEnum,
  riskLevel: RiskLevelEnum,
  impactedSystems: z.array(z.string().min(1)).min(1, "至少需要一個受影響系統"),
  scheduledStart: z.string().datetime("預定開始時間格式不正確").nullable().optional(),
  scheduledEnd: z.string().datetime("預定結束時間格式不正確").nullable().optional(),
  rollbackPlan: z.string().nullable().optional(),
  verificationPlan: z.string().nullable().optional(),
}).refine(
  (data) => {
    if (data.scheduledStart && data.scheduledEnd) {
      return new Date(data.scheduledEnd) > new Date(data.scheduledStart);
    }
    return true;
  },
  { message: "預定結束時間必須晚於預定開始時間", path: ["scheduledEnd"] }
);

export const updateChangeRecordSchema = z.object({
  type: CMChangeTypeEnum.optional(),
  riskLevel: RiskLevelEnum.optional(),
  impactedSystems: z.array(z.string().min(1)).min(1, "至少需要一個受影響系統").optional(),
  scheduledStart: z.string().datetime("預定開始時間格式不正確").nullable().optional(),
  scheduledEnd: z.string().datetime("預定結束時間格式不正確").nullable().optional(),
  actualStart: z.string().datetime("實際開始時間格式不正確").nullable().optional(),
  actualEnd: z.string().datetime("實際結束時間格式不正確").nullable().optional(),
  rollbackPlan: z.string().nullable().optional(),
  verificationPlan: z.string().nullable().optional(),
  cabApprovedBy: z.string().nullable().optional(),
  cabApprovedAt: z.string().datetime("CAB 核准時間格式不正確").nullable().optional(),
}).refine(
  (data) => {
    if (data.scheduledStart && data.scheduledEnd) {
      return new Date(data.scheduledEnd) > new Date(data.scheduledStart);
    }
    return true;
  },
  { message: "預定結束時間必須晚於預定開始時間", path: ["scheduledEnd"] }
);

export const changeStatusTransitionSchema = z.object({
  status: ChangeStatusEnum,
  note: z.string().optional(),
});

export type CreateChangeRecordInput = z.infer<typeof createChangeRecordSchema>;
export type UpdateChangeRecordInput = z.infer<typeof updateChangeRecordSchema>;
export type ChangeStatusTransitionInput = z.infer<typeof changeStatusTransitionSchema>;
