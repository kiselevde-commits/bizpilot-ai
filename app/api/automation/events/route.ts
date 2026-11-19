import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { listAutomationEvents, queueAutomationDispatch } from "@/services/automation.service";
import { jsonSuccess } from "@/lib/api/envelope";
import { handleApiError } from "@/lib/api/handle-error";
import { buildRateLimitKey, checkRateLimit } from "@/lib/api/server-handler";
import { getClientIp } from "@/lib/api/request-ip";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser();

    checkRateLimit(
      buildRateLimitKey("automation-events", getClientIp(request), user.id),
      100,
      60_000,
    );

    const searchParams = request.nextUrl.searchParams;

    // Lazy outbox acceleration: max 10 events per request, best-effort.
    queueAutomationDispatch();

    const result = await listAutomationEvents(user, {
      page: Number(searchParams.get("page") ?? "1"),
      limit: Number(searchParams.get("limit") ?? "20"),
      status: searchParams.get("status") ?? undefined,
      sort: searchParams.get("sort") ?? "createdAt:desc",
    });

    return jsonSuccess(result);
  } catch (error) {
    const handled = handleApiError(error);

    return NextResponse.json(handled.body, { status: handled.status });
  }
}
