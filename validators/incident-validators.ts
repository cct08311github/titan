import { z } from "zod";
import { IncidentSeverityEnum } from "./shared/enums";

export const createIncidentRecordSchema = z.object({
  severity: IncidentSeverityEnum,
  impactScope: z.string().min(1, "影響範圍為必填"),
  incidentStart: z.string().datetime("事件開始時間格式不正確"),
  incidentEnd: z.string().datetime("事件結束時間格式不正確").nullable().optional(),
  rootCause: z.string().nullable().optional(),
  resolution: z.string().nullable().optional(),
  reportedBy: z.string().nullable().optional(),
}).refine(
  (data) => {
    if (data.incidentEnd) {
      return new Date(data.incidentEnd) > new Date(data.incidentStart);
    }
    return true;
  },
  { message: "事件結束時間必須晚於開始時間", path: ["incidentEnd"] }
);

export const updateIncidentRecordSchema = z.object({
  severity: IncidentSeverityEnum.optional(),
  impactScope: z.string().min(1, "影響範圍為必填").optional(),
  incidentStart: z.string().datetime("事件開始時間格式不正確").optional(),
  incidentEnd: z.string().datetime("事件結束時間格式不正確").nullable().optional(),
  rootCause: z.string().nullable().optional(),
  resolution: z.string().nullable().optional(),
  reportedBy: z.string().nullable().optional(),
}).refine(
  (data) => {
    if (data.incidentEnd && data.incidentStart) {
      return new Date(data.incidentEnd) > new Date(data.incidentStart);
    }
    return true;
  },
  { message: "事件結束時間必須晚於開始時間", path: ["incidentEnd"] }
);

export type CreateIncidentRecordInput = z.infer<typeof createIncidentRecordSchema>;
export type UpdateIncidentRecordInput = z.infer<typeof updateIncidentRecordSchema>;
