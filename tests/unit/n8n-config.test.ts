import { describe, expect, it } from "vitest";
import {
  N8N_DEFAULT_TIMEOUT_MS,
  getN8nCallbackSecret,
  getN8nDispatchConfig,
  isTelegramConfigured,
  normalizeAppBaseUrl,
  parseRetryAfterSeconds,
} from "@/lib/integrations/n8n";

describe("n8n dispatch config", () => {
  it("returns null when URL or webhook secret is missing", () => {
    expect(getN8nDispatchConfig({})).toBeNull();
    expect(getN8nDispatchConfig({ N8N_WEBHOOK_URL: "http://n8n/webhook" })).toBeNull();
    expect(getN8nDispatchConfig({ N8N_WEBHOOK_SECRET: "secret" })).toBeNull();
    expect(
      getN8nDispatchConfig({
        N8N_WEBHOOK_URL: "ftp://n8n/webhook",
        N8N_WEBHOOK_SECRET: "secret",
      }),
    ).toBeNull();
  });

  it("builds a valid config and normalizes the app base URL", () => {
    const config = getN8nDispatchConfig({
      N8N_WEBHOOK_URL: "http://n8n:5678/webhook/lead-created",
      N8N_WEBHOOK_SECRET: "webhook-secret",
      N8N_TIMEOUT_MS: "5000",
      APP_BASE_URL: "https://crm.example.com/",
    });

    expect(config).toEqual({
      webhookUrl: "http://n8n:5678/webhook/lead-created",
      webhookSecret: "webhook-secret",
      timeoutMs: 5000,
      appBaseUrl: "https://crm.example.com",
    });
  });

  it("clamps invalid timeout values to the default", () => {
    const base = {
      N8N_WEBHOOK_URL: "http://n8n/webhook",
      N8N_WEBHOOK_SECRET: "secret",
    };

    expect(getN8nDispatchConfig({ ...base, N8N_TIMEOUT_MS: "1" })?.timeoutMs).toBe(
      N8N_DEFAULT_TIMEOUT_MS,
    );
    expect(getN8nDispatchConfig({ ...base, N8N_TIMEOUT_MS: "120000" })?.timeoutMs).toBe(
      N8N_DEFAULT_TIMEOUT_MS,
    );
    expect(getN8nDispatchConfig({ ...base, N8N_TIMEOUT_MS: "not-a-number" })?.timeoutMs).toBe(
      N8N_DEFAULT_TIMEOUT_MS,
    );
  });
});

describe("n8n callback secret", () => {
  it("returns the callback secret", () => {
    expect(
      getN8nCallbackSecret({
        N8N_CALLBACK_SECRET: "callback-secret",
        N8N_WEBHOOK_SECRET: "webhook-secret",
      }),
    ).toBe("callback-secret");
  });

  it("rejects an empty or shared secret", () => {
    expect(getN8nCallbackSecret({})).toBeNull();
    expect(getN8nCallbackSecret({ N8N_CALLBACK_SECRET: "   " })).toBeNull();
    expect(
      getN8nCallbackSecret({
        N8N_CALLBACK_SECRET: "same-secret",
        N8N_WEBHOOK_SECRET: "same-secret",
      }),
    ).toBeNull();
  });
});

describe("telegram configuration", () => {
  it("requires both token and chat id", () => {
    expect(isTelegramConfigured({})).toBe(false);
    expect(isTelegramConfigured({ TELEGRAM_BOT_TOKEN: "token" })).toBe(false);
    expect(isTelegramConfigured({ TELEGRAM_CHAT_ID: "123" })).toBe(false);
    expect(
      isTelegramConfigured({
        TELEGRAM_BOT_TOKEN: "token",
        TELEGRAM_CHAT_ID: "123",
      }),
    ).toBe(true);
  });
});

describe("retry-after parsing", () => {
  it("parses delta seconds and HTTP dates", () => {
    expect(parseRetryAfterSeconds("120")).toBe(120);
    expect(parseRetryAfterSeconds("0")).toBe(0);
    expect(parseRetryAfterSeconds(null)).toBeNull();
    expect(parseRetryAfterSeconds("not-a-date")).toBeNull();

    const now = Date.parse("2026-01-01T12:00:00.000Z");
    const date = new Date(now + 60_000).toUTCString();
    expect(parseRetryAfterSeconds(date, now)).toBe(60);
  });
});

describe("normalizeAppBaseUrl", () => {
  it("accepts http(s) and rejects other values", () => {
    expect(normalizeAppBaseUrl("https://crm.example.com/")).toBe("https://crm.example.com");
    expect(normalizeAppBaseUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeAppBaseUrl(null)).toBeNull();
    expect(normalizeAppBaseUrl("ftp://example.com")).toBeNull();
    expect(normalizeAppBaseUrl("not-a-url")).toBeNull();
  });
});
