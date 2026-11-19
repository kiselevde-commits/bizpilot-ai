import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import {
  dispatchPendingEvents,
  getAutomationEvent,
  retryAutomationEvent,
} from "@/services/automation.service";
import { jsonSuccess } from "@/lib/api/envelope";
import { handleApiError } from "@/lib/api/handle-error";
import { buildRateLimitKey, checkRateLimit } from "@/lib/api/server-handler";
import { getClientIp } from "@/lib/api/request-ip";
import { assertSameOrigin } from "@/lib/api/origin";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    assertSameOrigin(request, process.env.APP_BASE_URL ?? request.nextUrl.origin);
    checkRateLimit(
      buildRateLimitKey("automation-retry", getClientIp(request), user.id),
      30,
      60_000,
    );

    await retryAutomationEvent(user, id);

    let dispatched = false;

    try {
      await dispatchPendingEvents({ eventId: id, limit: 1 });
      dispatched = true;
    } catch (error) {
      // The event stays RETRYING in PostgreSQL; the next lazy dispatch will pick it up.
      console.error("Manual retry dispatch failed", {
        eventId: id,
        name: error instanceof Error ? error.name : "UnknownError",
      });
    }

    const event = await getAutomationEvent(user, id);

    return jsonSuccess({ event, dispatched });
  } catch (error) {
    const handled = handleApiError(error);

    return NextResponse.json(handled.body, { status: handled.status });
  }
}
