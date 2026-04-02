#!/usr/bin/env npx ts-node
/**
 * Generate Mobile TypeScript Types from Prisma Schema — Issue #1089
 *
 * Parses prisma/schema.prisma and produces types/mobile-api.ts containing:
 * - All enums as string union types (lightweight, no runtime import needed)
 * - Key model interfaces (fields relevant to mobile API responses)
 * - API response wrapper types
 *
 * Usage:
 *   npx ts-node scripts/generate-mobile-types.ts
 *   npm run generate:mobile-types
 *
 * The output file is committed to the repo so mobile devs can import directly.
 * CI runs a diff check to ensure it stays in sync with the schema.
 */

import * as fs from "fs";
import * as path from "path";

const SCHEMA_PATH = path.join(__dirname, "..", "prisma", "schema.prisma");
const OUTPUT_PATH = path.join(__dirname, "..", "types", "mobile-api.ts");

// Models to include in mobile types (others are internal/server-only)
const MOBILE_MODELS = new Set([
  "User",
  "Task",
  "SubTask",
  "TaskComment",
  "TaskActivity",
  "TimeEntry",
  "TimeEntryTemplate",
  "TimeEntryTemplateItem",
  "Notification",
  "NotificationPreference",
  "KPI",
  "KPIAchievement",
  "AnnualPlan",
  "MonthlyGoal",
  "Milestone",
  "Deliverable",
  "Document",
  "KnowledgeSpace",
]);

// Fields to exclude from mobile types (server-internal, sensitive)
const EXCLUDED_FIELDS = new Set([
  "password",
  "passwordChangedAt",
  "mustChangePassword",
  "passwordHistory",
  "tokenHash",
  "revokedAt",
  "ipAddress",
]);

// Prisma → TypeScript type mapping
const TYPE_MAP: Record<string, string> = {
  String: "string",
  Int: "number",
  Float: "number",
  Decimal: "number",
  Boolean: "boolean",
  DateTime: "string", // ISO 8601 in API responses
  Json: "unknown",
  BigInt: "number",
};

interface ParsedEnum {
  name: string;
  values: string[];
}

interface ParsedField {
  name: string;
  type: string;
  isOptional: boolean;
  isList: boolean;
  isRelation: boolean;
}

interface ParsedModel {
  name: string;
  fields: ParsedField[];
}

function parseSchema(content: string): { enums: ParsedEnum[]; models: ParsedModel[] } {
  const enums: ParsedEnum[] = [];
  const models: ParsedModel[] = [];
  const lines = content.split("\n");

  let currentEnum: ParsedEnum | null = null;
  let currentModel: ParsedModel | null = null;
  let braceDepth = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Track enum blocks
    if (line.startsWith("enum ") && line.endsWith("{")) {
      const name = line.replace("enum ", "").replace(" {", "").trim();
      currentEnum = { name, values: [] };
      braceDepth = 1;
      continue;
    }

    // Track model blocks
    if (line.startsWith("model ") && line.endsWith("{")) {
      const name = line.replace("model ", "").replace(" {", "").trim();
      currentModel = { name, fields: [] };
      braceDepth = 1;
      continue;
    }

    if (line === "}") {
      if (currentEnum) {
        enums.push(currentEnum);
        currentEnum = null;
      }
      if (currentModel) {
        models.push(currentModel);
        currentModel = null;
      }
      braceDepth = 0;
      continue;
    }

    // Parse enum values — strip inline comments and whitespace
    if (currentEnum && line && !line.startsWith("//") && !line.startsWith("@@")) {
      const enumValue = line.split("//")[0].trim().replace(/,\s*$/, "");
      if (enumValue) {
        currentEnum.values.push(enumValue);
      }
      continue;
    }

    // Parse model fields
    if (currentModel && line && !line.startsWith("//") && !line.startsWith("@@")) {
      const field = parseField(line);
      if (field) {
        currentModel.fields.push(field);
      }
    }
  }

  return { enums, models };
}

function parseField(line: string): ParsedField | null {
  // Match: fieldName TypeName? @relation(...) etc.
  const match = line.match(/^(\w+)\s+(\w+)(\[\])?([\?])?/);
  if (!match) return null;

  const [, name, rawType, listMarker, optionalMarker] = match;

  // Skip Prisma directives lines like @@id, @@unique, @@index
  if (name.startsWith("@@")) return null;

  const isExplicitRelation = line.includes("@relation(");
  const isList = listMarker === "[]";
  const isOptional = optionalMarker === "?" || isList;
  // A field is a relation if it has @relation() or its type starts with uppercase
  // and is not a known scalar/enum type (relations reference other models)
  const isScalarOrEnum = rawType in TYPE_MAP || rawType.match(/^[A-Z]/) === null;
  const isRelation = isExplicitRelation || (isList && !isScalarOrEnum);

  return {
    name,
    type: rawType,
    isOptional,
    isList,
    isRelation,
  };
}

function mapType(field: ParsedField, enumNames: Set<string>): string {
  const baseType = TYPE_MAP[field.type] ?? (enumNames.has(field.type) ? field.type : field.type);

  if (field.isList) return `${baseType}[]`;
  return baseType;
}

function generate(enums: ParsedEnum[], models: ParsedModel[]): string {
  const enumNames = new Set(enums.map((e) => e.name));
  const modelNames = new Set(models.map((m) => m.name));
  const lines: string[] = [];

  lines.push("/**");
  lines.push(" * TITAN Mobile API Types — Auto-generated from prisma/schema.prisma");
  lines.push(` * Generated: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(" *");
  lines.push(" * DO NOT EDIT MANUALLY — run `npm run generate:mobile-types` to regenerate.");
  lines.push(" * See scripts/generate-mobile-types.ts for the generator.");
  lines.push(" */");
  lines.push("");
  lines.push("/* eslint-disable @typescript-eslint/no-empty-interface */");
  lines.push("");

  // Generate enums as string union types
  lines.push("// ═══════════════════════════════════════════════════════════");
  lines.push("// Enums (string unions — no runtime overhead)");
  lines.push("// ═══════════════════════════════════════════════════════════");
  lines.push("");

  for (const e of enums) {
    lines.push(`export type ${e.name} = ${e.values.map((v) => `"${v}"`).join(" | ")};`);
  }

  lines.push("");
  lines.push("// ═══════════════════════════════════════════════════════════");
  lines.push("// Models (mobile-facing fields only)");
  lines.push("// ═══════════════════════════════════════════════════════════");
  lines.push("");

  // Generate model interfaces
  const mobileModels = models.filter((m) => MOBILE_MODELS.has(m.name));

  for (const model of mobileModels) {
    lines.push(`export interface ${model.name} {`);

    for (const field of model.fields) {
      // Skip excluded fields
      if (EXCLUDED_FIELDS.has(field.name)) continue;
      // Skip relation fields — types referencing other models
      if (field.isRelation || modelNames.has(field.type)) continue;

      const tsType = mapType(field, enumNames);
      const optional = field.isOptional ? "?" : "";
      lines.push(`  ${field.name}${optional}: ${tsType};`);
    }

    lines.push("}");
    lines.push("");
  }

  // Generate API response wrappers
  lines.push("// ═══════════════════════════════════════════════════════════");
  lines.push("// API Response Types");
  lines.push("// ═══════════════════════════════════════════════════════════");
  lines.push("");
  lines.push("export interface ApiResponse<T> {");
  lines.push("  success: boolean;");
  lines.push("  data?: T;");
  lines.push("  error?: string;");
  lines.push("  message?: string;");
  lines.push("}");
  lines.push("");
  lines.push("export interface PaginatedResponse<T> extends ApiResponse<T[]> {");
  lines.push("  total: number;");
  lines.push("  page: number;");
  lines.push("  pageSize: number;");
  lines.push("}");
  lines.push("");
  lines.push("export interface MobileLoginResponse {");
  lines.push("  token: string;");
  lines.push("  refreshToken: string;");
  lines.push("  expiresAt: number;");
  lines.push("  user: Pick<User, \"id\" | \"name\" | \"email\" | \"role\">;");
  lines.push("}");
  lines.push("");
  lines.push("export interface MobileRefreshResponse {");
  lines.push("  token?: string;");
  lines.push("  refreshToken: string;");
  lines.push("  expiresAt?: number;");
  lines.push("  expiresIn: number;");
  lines.push("  user: Pick<User, \"id\" | \"name\" | \"email\" | \"role\">;");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

// Main
const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
const { enums, models } = parseSchema(schema);

const output = generate(enums, models);
fs.writeFileSync(OUTPUT_PATH, output, "utf-8");

const mobileModelCount = models.filter((m) => MOBILE_MODELS.has(m.name)).length;
console.log(`✓ Generated ${OUTPUT_PATH}`);
console.log(`  ${enums.length} enums, ${mobileModelCount}/${models.length} models`);
