import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getAutomationStatus, queueAutomationDispatch } from "@/services/automation.service";
import { jsonSuccess } from "@/lib/api/envelope";
import { handleApiError } from "@/lib/api/handle-error";
import { buildRateLimitKey, checkRateLimit } from "@/lib/api/server-handler";
import { getClientIp } from "@/lib/api/request-ip";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser();

    checkRateLimit(
      buildRateLimitKey("automation-status", getClientIp(request), user.id),
      100,
      60_000,
    );

    queueAutomationDispatch();

    const result = await getAutomationStatus(user);

    return jsonSuccess(result);
  } catch (error) {
    const handled = handleApiError(error);

    return NextResponse.json(handled.body, { status: handled.status });
  }
}
