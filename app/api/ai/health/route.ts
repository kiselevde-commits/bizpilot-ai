import { NextResponse } from "next/server";
import { isAIProviderConfigured } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe for the app container and middleware allow-list.
 * It reports whether the app is up and which AI mode is configured; it never
 * contacts the AI provider and never exposes keys, base URLs or models.
 *
 * Configuration is checked with the same trimmed rule as the runtime provider,
 * so `configured: true` cannot be reported for a configuration that would fail
 * with `AI_NOT_CONFIGURED`.
 */
export async function GET(): Promise<NextResponse<{ status: "ok"; configured: boolean }>> {
  const mockEnabled = process.env.AI_PROVIDER === "mock" && process.env.ALLOW_MOCK_AI === "true";

  const configured =
    mockEnabled ||
    isAIProviderConfigured({
      baseUrl: process.env.AI_BASE_URL,
      apiKey: process.env.AI_API_KEY,
      model: process.env.AI_MODEL,
    });

  return NextResponse.json({ status: "ok", configured });
}
