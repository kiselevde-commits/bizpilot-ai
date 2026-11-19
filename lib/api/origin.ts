import { AppError } from "@/lib/errors";

export function assertSameOrigin(request: Request, appBaseUrl: string): void {
  const origin = request.headers.get("origin");

  if (!origin) {
    throw new AppError("FORBIDDEN", "Origin header is required");
  }

  const expectedOrigin = new URL(appBaseUrl).origin;
  const requestOrigin = new URL(request.url).origin;

  if (origin !== expectedOrigin && origin !== requestOrigin) {
    throw new AppError("FORBIDDEN", "Invalid origin");
  }
}
