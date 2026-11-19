import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { handleApiError } from "@/lib/api/handle-error";
import { jsonSuccess } from "@/lib/api/envelope";
import { assertJsonContentType, readRawBody } from "@/lib/api/body-limit";
import { getClientIp } from "@/lib/api/request-ip";
import { buildRateLimitKey, checkRateLimit } from "@/lib/api/server-handler";
import { checkTimestamp, verifyHmacSignature } from "@/lib/security/hmac";
import { getN8nCallbackSecret } from "@/lib/integrations/n8n";
import { n8nCallbackSchema } from "@/lib/validation/automation";
import { handleN8nCallback } from "@/services/automation.service";

export const dynamic = "force-dynamic";

const WEBHOOK_BODY_LIMIT = 64 * 1024;
const WEBHOOK_RATE_LIMIT = 1000;

export async function POST(request: NextRequest): Promise<Response> {
  try {
    checkRateLimit(
      buildRateLimitKey("webhook-n8n", getClientIp(request)),
      WEBHOOK_RATE_LIMIT,
      60_000,
    );

    assertJsonContentType(request);

    const secret = getN8nCallbackSecret();

    if (!secret) {
      throw new AppError("INTERNAL_ERROR", "n8n callback is not configured on the server", {
        status: 503,
      });
    }

    const signature = request.headers.get("x-n8n-signature");
    const timestamp = request.headers.get("x-n8n-timestamp");

    if (!signature || !timestamp) {
      throw new AppError("INVALID_SIGNATURE", "Missing webhook signature headers");
    }

    const timestampCheck = checkTimestamp(timestamp);

    if (!timestampCheck.valid) {
      throw new AppError("STALE_TIMESTAMP", "Webhook timestamp is outside the allowed window", {
        details: { reason: timestampCheck.reason },
      });
    }

    // Read exact raw bytes. The body must not be re-serialized before verification.
    const rawBody = await readRawBody(request, WEBHOOK_BODY_LIMIT);

    if (!verifyHmacSignature(secret, timestamp, rawBody, signature)) {
      throw new AppError("INVALID_SIGNATURE", "Invalid webhook signature");
    }

    const bodyText = new TextDecoder().decode(rawBody);
    let body: unknown;

    try {
      body = JSON.parse(bodyText) as unknown;
    } catch {
      throw new AppError("VALIDATION_ERROR", "Invalid JSON body");
    }

    const parsed = n8nCallbackSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Invalid callback payload", {
        details: parsed.error.issues,
      });
    }

    const result = await handleN8nCallback(parsed.data);

    return jsonSuccess({
      received: true,
      eventId: result.eventId,
      status: result.status,
      duplicate: result.duplicate,
    });
  } catch (error) {
    const handled = handleApiError(error);

    return NextResponse.json(handled.body, { status: handled.status });
  }
}
