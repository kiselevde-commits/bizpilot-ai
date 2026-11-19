import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { buildAIProvider } from "@/lib/ai/provider";
import { AIService } from "@/services/ai.service";
import { assertJsonContentType, readJsonBody } from "@/lib/api/body-limit";
import { handleApiError } from "@/lib/api/handle-error";
import { z } from "zod";

const AI_BODY_LIMIT = 256 * 1024;

const AnalyzeBodySchema = z.object({
  text: z.string().trim().min(1, "Текст для анализа обязателен").max(20000),
  leadId: z.string().uuid("Некорректный ID заявки"),
});

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser();

    assertJsonContentType(request);
    const rawBody = await readJsonBody(request, AI_BODY_LIMIT);

    const parsed = AnalyzeBodySchema.safeParse(rawBody);

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

    const useMock =
      process.env.AI_PROVIDER === "mock" &&
      process.env.ALLOW_MOCK_AI === "true";

    const provider = buildAIProvider(
      {
        baseUrl: process.env.AI_BASE_URL ?? "",
        apiKey: process.env.AI_API_KEY ?? "",
        model: process.env.AI_MODEL ?? "",
        timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 60000),
      },
      useMock,
    );

    const aiService = new AIService(provider);

    const result = await aiService.analyze(
      { text: parsed.data.text, leadId: parsed.data.leadId },
      user,
    );

    return NextResponse.json({
      success: true,
      data: {
        analysis: result.analysis,
        provider: result.provider,
        model: result.model,
        tokensInput: result.tokensInput,
        tokensOutput: result.tokensOutput,
        durationMs: result.durationMs,
      },
      error: null,
    });
  } catch (error) {
    const handled = handleApiError(error);

    return NextResponse.json(handled.body, { status: handled.status });
  }
}
