import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe for the app container and middleware allow-list.
 * It reports whether the app is up and which AI mode is configured; it never
 * contacts the AI provider and never exposes keys, base URLs or models.
 */
export async function GET(): Promise<NextResponse<{ status: "ok"; configured: boolean }>> {
  const configured =
    process.env.AI_PROVIDER === "mock"
      ? process.env.ALLOW_MOCK_AI === "true"
      : Boolean(process.env.AI_BASE_URL && process.env.AI_API_KEY && process.env.AI_MODEL);

  return NextResponse.json({ status: "ok", configured });
}
