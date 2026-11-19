import { describe, expect, it } from "vitest";
import {
  buildLeadCreatedEventPayload,
  buildLeadCreatedIdempotencyKey,
  LEAD_CREATED_EVENT_TYPE,
} from "@/lib/automation/lead-event";

const baseLead = {
  leadId: "lead-1",
  title: "Нужна автоматизация продаж",
  priority: "HIGH",
  category: "business_automation",
  summary: "Клиент хочет автоматизировать обработку заявок",
};

describe("lead.created automation event", () => {
  it("builds a stable idempotency key", () => {
    const key = buildLeadCreatedIdempotencyKey("lead-1");

    expect(LEAD_CREATED_EVENT_TYPE).toBe("lead.created");
    expect(key).toBe("lead.created:lead-1");
    expect(buildLeadCreatedIdempotencyKey("lead-1")).toBe(key);
    expect(buildLeadCreatedIdempotencyKey("lead-2")).not.toBe(key);
  });

  it("includes only notification fields and a public link", () => {
    const payload = buildLeadCreatedEventPayload(baseLead, "https://crm.example.com/");

    expect(payload).toEqual({
      title: baseLead.title,
      priority: "HIGH",
      category: "business_automation",
      summary: baseLead.summary,
      url: "https://crm.example.com/leads/lead-1",
    });
  });

  it("never includes message, email, phone or other contact data", () => {
    const withPii = {
      ...baseLead,
      message: "Секретный текст заявки",
      email: "client@example.com",
      phone: "+7 999 123-45-67",
      contactName: "Иван",
    };
    const payload = buildLeadCreatedEventPayload(withPii, "https://crm.example.com");
    const serialized = JSON.stringify(payload);

    expect(serialized).not.toContain("Секретный текст");
    expect(serialized).not.toContain("client@example.com");
    expect(serialized).not.toContain("999 123");
    expect(serialized).not.toContain("Иван");
  });

  it("omits the link when APP_BASE_URL is missing or invalid", () => {
    expect(buildLeadCreatedEventPayload(baseLead, null).url).toBeNull();
    expect(buildLeadCreatedEventPayload(baseLead, "").url).toBeNull();
    expect(buildLeadCreatedEventPayload(baseLead, "not-a-url").url).toBeNull();
    expect(buildLeadCreatedEventPayload(baseLead, "ftp://example.com").url).toBeNull();
  });

  it("truncates title and summary to schema limits", () => {
    const payload = buildLeadCreatedEventPayload(
      {
        ...baseLead,
        title: "x".repeat(300),
        summary: "y".repeat(400),
      },
      null,
    );

    expect(payload.title).toHaveLength(255);
    expect(payload.summary).toHaveLength(300);
  });
});
