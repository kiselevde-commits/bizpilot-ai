import "server-only";

import { computeHmacSignature, currentTimestampSeconds } from "@/lib/security/hmac";
import { sanitizeExternalError } from "@/lib/security/sanitize";

export const N8N_DEFAULT_TIMEOUT_MS = 10_000;
export const N8N_MAX_RESPONSE_BYTES = 64 * 1024;

export type N8nDispatchConfig = {
  webhookUrl: string;
  webhookSecret: string;
  timeoutMs: number;
  appBaseUrl: string | null;
};

export type N8nSendInput = {
  eventId: string;
  idempotencyKey: string;
  eventType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export type N8nSendResult =
  | {
      kind: "response";
      status: number;
      retryAfterSeconds: number | null;
      externalEventId: string | null;
    }
  | { kind: "network_error"; message: string }
  | { kind: "timeout"; message: string };

export interface N8nClient {
  sendEvent(input: N8nSendInput): Promise<N8nSendResult>;
}

type EnvLike = Record<string, string | undefined>;

export function normalizeAppBaseUrl(value: string | null | undefined): string | null {
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

function readTimeoutMs(value: string | null): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1_000 || parsed > 60_000) {
    return N8N_DEFAULT_TIMEOUT_MS;
  }

  return Math.trunc(parsed);
}

/**
 * Returns null when the outbox cannot be dispatched. This is expected when n8n
 * is intentionally disabled: the CRM keeps working and events stay in PostgreSQL.
 */
export function getN8nDispatchConfig(env: EnvLike = process.env): N8nDispatchConfig | null {
  const webhookUrl = env.N8N_WEBHOOK_URL?.trim() ?? "";
  const webhookSecret = env.N8N_WEBHOOK_SECRET?.trim() ?? "";

  if (!webhookUrl || !webhookSecret) {
    return null;
  }

  try {
    const parsed = new URL(webhookUrl);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
  } catch {
    return null;
  }

  return {
    webhookUrl,
    webhookSecret,
    timeoutMs: readTimeoutMs(env.N8N_TIMEOUT_MS?.trim() ?? null),
    appBaseUrl: normalizeAppBaseUrl(env.APP_BASE_URL),
  };
}

export function getN8nCallbackSecret(env: EnvLike = process.env): string | null {
  const secret = env.N8N_CALLBACK_SECRET?.trim();
  const webhookSecret = env.N8N_WEBHOOK_SECRET?.trim();

  if (!secret) {
    return null;
  }

  // TZ 24.10 requires different secrets for inbound and outbound directions.
  if (webhookSecret && secret === webhookSecret) {
    return null;
  }

  return secret;
}

export function isTelegramConfigured(env: EnvLike = process.env): boolean {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();

  return Boolean(token && chatId);
}

/**
 * Parses RFC 7231 `Retry-After`: either delta-seconds or an HTTP date.
 * Returns null for missing/invalid values so callers can use the fixed schedule.
 */
export function parseRetryAfterSeconds(
  value: string | null,
  nowMs: number = Date.now(),
): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);

    return Number.isFinite(seconds) ? Math.max(0, Math.trunc(seconds)) : null;
  }

  const dateMs = Date.parse(trimmed);

  if (Number.isNaN(dateMs)) {
    return null;
  }

  return Math.max(0, Math.ceil((dateMs - nowMs) / 1000));
}

function extractExternalEventId(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;

  for (const key of ["executionId", "execution_id", "externalEventId"]) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim().slice(0, 200);
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value).slice(0, 200);
    }
  }

  return null;
}

export class HttpN8nClient implements N8nClient {
  constructor(private readonly config: N8nDispatchConfig) {}

  async sendEvent(input: N8nSendInput): Promise<N8nSendResult> {
    const timestamp = currentTimestampSeconds();
    const rawBody = JSON.stringify({
      eventId: input.eventId,
      eventType: input.eventType,
      idempotencyKey: input.idempotencyKey,
      occurredAt: input.occurredAt,
      data: input.payload,
    });
    const signature = computeHmacSignature(this.config.webhookSecret, timestamp, rawBody);

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.config.timeoutMs);

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-bizpilot-signature": signature,
          "x-bizpilot-timestamp": timestamp,
          "x-bizpilot-event-id": input.idempotencyKey,
        },
        body: rawBody,
        signal: controller.signal,
        cache: "no-store",
      });

      const responseText = (await response.text()).slice(0, N8N_MAX_RESPONSE_BYTES);
      let parsedBody: unknown = null;

      if (responseText.trim().length > 0) {
        try {
          parsedBody = JSON.parse(responseText) as unknown;
        } catch {
          parsedBody = null;
        }
      }

      return {
        kind: "response",
        status: response.status,
        retryAfterSeconds: parseRetryAfterSeconds(response.headers.get("retry-after")),
        externalEventId: extractExternalEventId(parsedBody),
      };
    } catch (error) {
      if (timedOut) {
        return {
          kind: "timeout",
          message: "n8n webhook request timed out",
        };
      }

      // Do not persist provider/network details: they may include the webhook URL
      // or internal host names. Diagnostics use the event id and attempt counters.
      console.error("n8n webhook request failed", {
        name: error instanceof Error ? error.name : "UnknownError",
      });

      return {
        kind: "network_error",
        message: "n8n webhook request failed",
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Kept for diagnostics/tests: strips secrets from n8n error responses. */
export function sanitizeN8nResponseError(value: unknown): string | null {
  return sanitizeExternalError(value);
}
