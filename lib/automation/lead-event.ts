import type { LeadCategory, Priority } from "@prisma/client";

export const LEAD_CREATED_EVENT_TYPE = "lead.created";

export type LeadCreatedEventInput = {
  leadId: string;
  title: string;
  priority: Priority | string;
  category: LeadCategory | string | null;
  summary: string | null;
};

export type LeadCreatedEventPayload = {
  title: string;
  priority: string;
  category: string | null;
  summary: string | null;
  url: string | null;
};

/**
 * Stable idempotency key for the outbox event. It must never change on retry.
 */
export function buildLeadCreatedIdempotencyKey(leadId: string): string {
  return `${LEAD_CREATED_EVENT_TYPE}:${leadId}`;
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return trimmed.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/**
 * Payload sent to n8n and ultimately to Telegram. It intentionally contains only
 * the fields required by the notification and never the lead message, email,
 * phone or other contact data.
 */
export function buildLeadCreatedEventPayload(
  input: LeadCreatedEventInput,
  appBaseUrl: string | null | undefined,
): LeadCreatedEventPayload {
  const baseUrl = normalizeBaseUrl(appBaseUrl);
  const url = baseUrl ? `${baseUrl}/leads/${input.leadId}` : null;

  return {
    title: input.title.slice(0, 255),
    priority: input.priority,
    category: input.category,
    summary: input.summary ? input.summary.slice(0, 300) : null,
    url,
  };
}
