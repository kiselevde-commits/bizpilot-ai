import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { computeHmacSignature, currentTimestampSeconds } from "@/lib/security/hmac";

vi.mock("@/services/automation.service", () => ({
  handleN8nCallback: vi.fn(),
}));

import { handleN8nCallback } from "@/services/automation.service";
import { POST } from "@/app/api/webhooks/n8n/route";

const SECRET = "callback-test-secret";
const URL = "http://localhost:3000/api/webhooks/n8n";

const callbackMock = handleN8nCallback as unknown as ReturnType<typeof vi.fn>;

function makeRequest(
  body: string,
  options: {
    signature?: string;
    timestamp?: string;
    secret?: string;
    contentType?: string;
  } = {},
): NextRequest {
  const timestamp = options.timestamp ?? currentTimestampSeconds();
  const signature =
    options.signature ?? computeHmacSignature(options.secret ?? SECRET, timestamp, body);

  return new NextRequest(URL, {
    method: "POST",
    headers: {
      "content-type": options.contentType ?? "application/json",
      "x-n8n-signature": signature,
      "x-n8n-timestamp": timestamp,
      "x-forwarded-for": "203.0.113.10",
    },
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.N8N_CALLBACK_SECRET = SECRET;
  callbackMock.mockResolvedValue({
    eventId: "11111111-1111-4111-8111-111111111111",
    status: "DELIVERED",
    duplicate: false,
  });
});

afterEach(() => {
  delete process.env.N8N_CALLBACK_SECRET;
});

describe("POST /api/webhooks/n8n", () => {
  it("accepts a valid signature and returns the callback result", async () => {
    const body = JSON.stringify({
      idempotencyKey: "lead.created:lead-1",
      status: "delivered",
      externalEventId: "tg-1",
    });
    const response = await POST(makeRequest(body));
    const json = (await response.json()) as {
      success: boolean;
      data: { status: string; duplicate: boolean };
    };

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toMatchObject({ status: "DELIVERED", duplicate: false });
    expect(callbackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "lead.created:lead-1",
        status: "delivered",
      }),
    );
  });

  it("rejects an invalid signature", async () => {
    const body = JSON.stringify({
      idempotencyKey: "lead.created:lead-1",
      status: "delivered",
    });
    const response = await POST(makeRequest(body, { signature: "0".repeat(64) }));
    const json = (await response.json()) as {
      success: boolean;
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(json.error.code).toBe("INVALID_SIGNATURE");
    expect(callbackMock).not.toHaveBeenCalled();
  });

  it("rejects a stale timestamp", async () => {
    const body = JSON.stringify({
      idempotencyKey: "lead.created:lead-1",
      status: "delivered",
    });
    const timestamp = String(Number(currentTimestampSeconds()) - 301);
    const response = await POST(makeRequest(body, { timestamp }));
    const json = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(401);
    expect(json.error.code).toBe("STALE_TIMESTAMP");
  });

  it("rejects a timestamp too far in the future", async () => {
    const body = JSON.stringify({
      idempotencyKey: "lead.created:lead-1",
      status: "delivered",
    });
    const timestamp = String(Number(currentTimestampSeconds()) + 301);
    const response = await POST(makeRequest(body, { timestamp }));
    const json = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(401);
    expect(json.error.code).toBe("STALE_TIMESTAMP");
  });

  it("verifies the exact raw body and rejects a modified body", async () => {
    const original = JSON.stringify({
      idempotencyKey: "lead.created:lead-1",
      status: "delivered",
    });
    const modified = JSON.stringify({
      idempotencyKey: "lead.created:lead-1",
      status: "failed",
    });
    const timestamp = currentTimestampSeconds();
    const signature = computeHmacSignature(SECRET, timestamp, original);
    const response = await POST(makeRequest(modified, { timestamp, signature }));

    expect(response.status).toBe(401);
    expect(callbackMock).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON after a valid signature", async () => {
    const body = "{not-json";
    const response = await POST(makeRequest(body));
    const json = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for a valid signature with an invalid payload", async () => {
    const body = JSON.stringify({ status: "delivered" });
    const response = await POST(makeRequest(body));
    const json = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(callbackMock).not.toHaveBeenCalled();
  });

  it("returns 503 when the callback secret is not configured", async () => {
    delete process.env.N8N_CALLBACK_SECRET;

    const body = JSON.stringify({
      idempotencyKey: "lead.created:lead-1",
      status: "delivered",
    });
    const response = await POST(makeRequest(body));
    const json = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(503);
    expect(json.error.code).toBe("INTERNAL_ERROR");
  });

  it("returns 400 for a non-JSON content type", async () => {
    const body = JSON.stringify({
      idempotencyKey: "lead.created:lead-1",
      status: "delivered",
    });
    const response = await POST(makeRequest(body, { contentType: "text/plain" }));

    expect(response.status).toBe(400);
  });

  it("returns 413 for a body larger than 64 KB", async () => {
    const body = JSON.stringify({
      idempotencyKey: "x".repeat(70 * 1024),
      status: "delivered",
    });
    const response = await POST(makeRequest(body));
    const json = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(413);
    expect(json.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(callbackMock).not.toHaveBeenCalled();
  });
});
