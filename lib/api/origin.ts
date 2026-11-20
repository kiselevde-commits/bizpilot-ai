import { AppError } from "@/lib/errors";

const DEFAULT_PORTS: Record<string, string> = { "http:": "80", "https:": "443" };

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    const port = url.port || DEFAULT_PORTS[url.protocol] || "";

    return `${url.protocol}//${url.hostname.toLowerCase()}:${port}`;
  } catch {
    return null;
  }
}

/**
 * CSRF / cross-origin guard for cookie-authenticated mutations.
 *
 * The request is accepted when its `Origin` is a same-origin origin, i.e. it
 * matches one of:
 * - `APP_BASE_URL` (canonical deployment URL),
 * - the origin the server actually received the request on (`request.url`),
 * - the `Host` / `X-Forwarded-Host` header, restricted to http/https protocols.
 *
 * Comparing only to `APP_BASE_URL` would break legitimate same-origin traffic
 * whenever the app is reached through another host of the same deployment
 * (localhost vs 127.0.0.1, Docker/ingress host, custom domain), so the allowed
 * set is derived from the request itself instead of the client payload.
 * `Origin` itself is always attacker-supplied in cross-site requests, so a
 * cross-origin forgery still fails the comparison.
 */
export function assertSameOrigin(request: Request, appBaseUrl: string): void {
  const origin = request.headers.get("origin");

  if (!origin) {
    throw new AppError("FORBIDDEN", "Origin header is required");
  }

  const allowed = new Set<string>();

  const configured = normalizeOrigin(appBaseUrl);
  if (configured) allowed.add(configured);

  const requestOrigin = normalizeOrigin(request.url);
  if (requestOrigin) allowed.add(requestOrigin);

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedProtos = [forwardedProto, "https", "http"].filter(
    (proto): proto is string => Boolean(proto),
  );

  for (const headerName of ["x-forwarded-host", "host"]) {
    const host = request.headers.get(headerName);
    if (!host) continue;

    // `x-forwarded-host` may contain a comma-separated proxy chain.
    const firstHost = host.split(",")[0]?.trim();
    if (!firstHost) continue;

    for (const proto of forwardedProtos) {
      const candidate = normalizeOrigin(`${proto}://${firstHost}`);
      if (candidate) allowed.add(candidate);
    }
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin || !allowed.has(normalizedOrigin)) {
    throw new AppError("FORBIDDEN", "Invalid origin");
  }
}
