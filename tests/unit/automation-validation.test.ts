import { describe, expect, it } from "vitest";
import { automationListQuerySchema, n8nCallbackSchema } from "@/lib/validation/automation";

describe("n8n callback schema", () => {
  it("accepts lowercase and uppercase statuses", () => {
    const delivered = n8nCallbackSchema.parse({
      idempotencyKey: "lead.created:lead-1",
      status: "delivered",
    });
    const failed = n8nCallbackSchema.parse({
      idempotencyKey: "lead.created:lead-1",
      status: "FAILED",
      error: "Telegram API error",
    });

    expect(delivered.status).toBe("delivered");
    expect(failed.status).toBe("failed");
  });

  it("accepts and preserves an ignored workspaceId field", () => {
    const parsed = n8nCallbackSchema.parse({
      idempotencyKey: "lead.created:lead-1",
      status: "delivered",
      workspaceId: "workspace-evil",
    });

    // The service must derive the workspace from the stored event; this assertion
    // documents that the schema does not treat workspaceId as trusted business data.
    expect(parsed).toMatchObject({ workspaceId: "workspace-evil" });
  });

  it("rejects missing idempotencyKey, empty bodies and unknown statuses", () => {
    expect(n8nCallbackSchema.safeParse({ status: "delivered" }).success).toBe(false);
    expect(n8nCallbackSchema.safeParse({ idempotencyKey: "", status: "delivered" }).success).toBe(
      false,
    );
    expect(
      n8nCallbackSchema.safeParse({
        idempotencyKey: "lead.created:lead-1",
        status: "unknown",
      }).success,
    ).toBe(false);
  });

  it("limits externalEventId and error length", () => {
    expect(
      n8nCallbackSchema.safeParse({
        idempotencyKey: "lead.created:lead-1",
        status: "delivered",
        externalEventId: "x".repeat(201),
      }).success,
    ).toBe(false);
    expect(
      n8nCallbackSchema.safeParse({
        idempotencyKey: "lead.created:lead-1",
        status: "failed",
        error: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });
});

describe("automation list query schema", () => {
  it("applies pagination defaults and validates status", () => {
    const parsed = automationListQuerySchema.parse({});

    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
    expect(parsed.sort).toBe("createdAt:desc");
    expect(automationListQuerySchema.safeParse({ status: "DELIVERED" }).success).toBe(true);
    expect(automationListQuerySchema.safeParse({ status: "UNKNOWN" }).success).toBe(false);
    expect(automationListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
