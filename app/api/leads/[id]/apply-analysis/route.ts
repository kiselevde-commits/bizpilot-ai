import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { buildAIProvider } from "@/lib/ai/provider";
import { AIService } from "@/services/ai.service";
import { assertJsonContentType, readJsonBody } from "@/lib/api/body-limit";
import { handleApiError } from "@/lib/api/handle-error";
import { assertSameOrigin } from "@/lib/api/origin";
import { z } from "zod";

const AI_BODY_LIMIT = 256 * 1024;

const ApplyAnalysisBodySchema = z.object({
  summary: z.string().max(300).nullable().optional(),
  leadScore: z.number().int().min(0).max(100).nullable().optional(),
  category: z
    .string()
    .max(100)
    .nullable()
    .optional(),
  intent: z.string().max(100).nullable().optional(),
  customerType: z.string().max(100).nullable().optional(),
  priority: z
    .enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
    .nullable()
    .optional(),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireUser();
    const { id } = await params;

    assertSameOrigin(request, process.env.APP_BASE_URL ?? request.nextUrl.origin);
    assertJsonContentType(request);
    const rawBody = await readJsonBody(request, AI_BODY_LIMIT);

    const parsed = ApplyAnalysisBodySchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: "VALIDATION_ERROR", message: "Некорректный запрос" },
        },
        { status: 400 },
      );
    }

    const aiService = new AIService(
      buildAIProvider(
        {
          baseUrl: process.env.AI_BASE_URL ?? "",
          apiKey: process.env.AI_API_KEY ?? "",
          model: process.env.AI_MODEL ?? "",
          timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 60000),
        },
        process.env.AI_PROVIDER === "mock" && process.env.ALLOW_MOCK_AI === "true",
      ),
    );

    const result = await aiService.applyAnalysis(id, {
      summary: parsed.data.summary ?? null,
      leadScore: parsed.data.leadScore ?? null,
      category: parsed.data.category ?? null,
      intent: parsed.data.intent ?? null,
      customerType: parsed.data.customerType ?? null,
      priority: parsed.data.priority ?? null,
    }, user);

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
