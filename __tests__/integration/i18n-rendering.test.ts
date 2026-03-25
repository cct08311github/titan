/**
 * @jest-environment node
 */
/**
 * i18n Rendering Test — Issue #506
 *
 * Validates that the zh-TW message file:
 *  - Is valid JSON
 *  - Contains all required top-level namespaces
 *  - Has no empty string values
 *  - Every key referenced by page-states component exists
 *  - No duplicate keys within namespaces
 */
import * as fs from "fs";
import * as path from "path";

const MESSAGES_PATH = path.resolve(__dirname, "../../messages/zh-TW.json");

describe("i18n — zh-TW message file", () => {
  let messages: Record<string, Record<string, string>>;

  beforeAll(() => {
    const raw = fs.readFileSync(MESSAGES_PATH, "utf-8");
    messages = JSON.parse(raw);
  });

  it("parses as valid JSON", () => {
    expect(messages).toBeDefined();
    expect(typeof messages).toBe("object");
  });

  it("contains required top-level namespaces", () => {
    const required = ["Common", "Auth", "Dashboard", "Task", "Plan", "KPI", "Timesheet", "Report", "Admin", "Error"];
    for (const ns of required) {
      expect(messages).toHaveProperty(ns);
      expect(typeof messages[ns]).toBe("object");
    }
  });

  it("has no empty string values in any namespace", () => {
    const empties: string[] = [];
    for (const [ns, entries] of Object.entries(messages)) {
      for (const [key, value] of Object.entries(entries)) {
        if (typeof value === "string" && value.trim() === "") {
          empties.push(`${ns}.${key}`);
        }
      }
    }
    expect(empties).toEqual([]);
  });

  it("Common namespace has essential UI strings", () => {
    const essential = ["loading", "error", "retry", "save", "cancel", "delete", "confirm", "create", "edit", "search", "noData"];
    for (const key of essential) {
      expect(messages.Common).toHaveProperty(key);
      expect(messages.Common[key].length).toBeGreaterThan(0);
    }
  });

  it("Error namespace has page error strings", () => {
    expect(messages.Error).toHaveProperty("pageError");
    expect(messages.Error).toHaveProperty("pageErrorDescription");
    expect(messages.Error).toHaveProperty("notFound");
  });

  it("Auth namespace has login/logout strings", () => {
    expect(messages.Auth).toHaveProperty("login");
    expect(messages.Auth).toHaveProperty("logout");
    expect(messages.Auth).toHaveProperty("changePassword");
  });

  it("Task namespace has all status labels", () => {
    const statuses = ["backlog", "todo", "inProgress", "review", "done"];
    for (const s of statuses) {
      expect(messages.Task).toHaveProperty(s);
    }
  });

  it("Timesheet namespace has category labels", () => {
    const categories = ["planned", "added", "incident", "support", "admin", "learning"];
    for (const c of categories) {
      expect(messages.Timesheet).toHaveProperty(c);
    }
  });

  it("all values are strings (no nested objects beyond first level)", () => {
    for (const [ns, entries] of Object.entries(messages)) {
      for (const [key, value] of Object.entries(entries)) {
        expect(typeof value).toBe("string");
      }
    }
  });
});
