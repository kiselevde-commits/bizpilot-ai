import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { AIService } from "@/services/ai.service";
import { handleApiError } from "@/lib/api/handle-error";
import { z } from "zod";

const HistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  leadId: z.string().uuid().optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser();

    const searchParams = request.nextUrl.searchParams;
    const parsed = HistoryQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      leadId: searchParams.get("leadId") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: "VALIDATION_ERROR", message: "Некорректные параметры запроса" },
        },
        { status: 400 },
      );
    }

    const aiService = new AIService();

    const result = await aiService.getHistory(user, {
      page: parsed.data.page,
      limit: parsed.data.limit,
      leadId: parsed.data.leadId ?? null,
    });

    return NextResponse.json({
      success: true,
      data: result,
      error: null,
    });
  } catch (error) {
    const handled = handleApiError(error);

    return NextResponse.json(handled.body, { status: handled.status });
  }
}
