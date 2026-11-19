import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { handleApiError } from "@/lib/api/handle-error";
import { rateLimit } from "@/lib/security/rate-limit";

export type ServerHandlerContext = {
  ip: string;
  userAgent?: string;
  appBaseUrl: string;
};

export async function withServerHandler(
  context: ServerHandlerContext,
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    const handled = handleApiError(error);

    return NextResponse.json(handled.body, { status: handled.status });
  }
}

export function buildRateLimitKey(prefix: string, ip: string, userId?: string): string {
  return userId ? `${prefix}:user:${userId}` : `${prefix}:ip:${ip}`;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const result = rateLimit(key, limit, windowMs);

  if (!result.allowed) {
    throw new AppError("RATE_LIMITED", "Слишком много запросов. Попробуйте позже.", {
      status: 429,
      details: { retryAfterSeconds: result.retryAfterSeconds },
    });
  }

  return { allowed: result.allowed, retryAfterSeconds: result.retryAfterSeconds };
}

export function rateLimitHeaders(retryAfterSeconds: number): Record<string, string> {
  return {
    "Retry-After": String(retryAfterSeconds),
  };
}

export function jsonErrorResponse(code: string, message: string, status: number): Response {
  return NextResponse.json(
    { success: false, data: null, error: { code, message } },
    { status },
  );
}
