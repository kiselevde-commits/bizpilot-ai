import { describe, expect, it } from "vitest";
import type { Role } from "@prisma/client";
import {
  AI_ANALYSIS_STATUSES,
  AUTOMATION_EVENT_STATUSES,
  CONTACT_STATUSES,
  CUSTOMER_TYPES,
  INTEGRATION_STATUSES,
  INTEGRATION_TYPES,
  LEAD_CATEGORIES,
  LEAD_INTENTS,
  LEAD_STATUSES,
  PRIORITIES,
  ROLES,
  TASK_STATUSES,
} from "@/lib/constants";

describe("constants parity with Prisma enums", () => {
  it("ROLES", () => {
    expect(ROLES).toEqual(["ADMIN", "MANAGER", "OPERATOR"]);
  });

  it("LEAD_STATUSES", () => {
    expect(LEAD_STATUSES).toEqual([
      "NEW",
      "ANALYZING",
      "QUALIFIED",
      "IN_PROGRESS",
      "WAITING",
      "CONVERTED",
      "REJECTED",
    ]);
  });

  it("PRIORITIES", () => {
    expect(PRIORITIES).toEqual(["LOW", "MEDIUM", "HIGH", "URGENT"]);
  });

  it("TASK_STATUSES", () => {
    expect(TASK_STATUSES).toEqual(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]);
  });

  it("LEAD_CATEGORIES", () => {
    expect(LEAD_CATEGORIES).toEqual([
      "business_automation",
      "crm_integration",
      "ai_bot",
      "document_flow",
      "web_app",
      "other",
    ]);
  });

  it("LEAD_INTENTS", () => {
    expect(LEAD_INTENTS).toEqual(["request", "question", "complaint", "info", "other"]);
  });

  it("CUSTOMER_TYPES", () => {
    expect(CUSTOMER_TYPES).toEqual(["b2b", "b2c", "b2g", "unknown"]);
  });

  it("CONTACT_STATUSES", () => {
    expect(CONTACT_STATUSES).toEqual(["NEW", "ACTIVE", "INACTIVE"]);
  });

  it("AI_ANALYSIS_STATUSES", () => {
    expect(AI_ANALYSIS_STATUSES).toEqual(["SUCCESS", "FAILED"]);
  });

  it("INTEGRATION_TYPES", () => {
    expect(INTEGRATION_TYPES).toEqual(["n8n", "telegram"]);
  });

  it("INTEGRATION_STATUSES", () => {
    expect(INTEGRATION_STATUSES).toEqual(["NOT_CONFIGURED", "ACTIVE", "ERROR"]);
  });

  it("AUTOMATION_EVENT_STATUSES", () => {
    expect(AUTOMATION_EVENT_STATUSES).toEqual([
      "PENDING",
      "SENT",
      "DELIVERED",
      "FAILED",
      "RETRYING",
    ]);
  });
});

it("Role type is exported from Prisma", () => {
  const role: Role = "ADMIN";
  expect(role).toBe("ADMIN");
});
