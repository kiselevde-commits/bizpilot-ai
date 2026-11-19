import { describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/api/request-ip";
import { assertSameOrigin } from "@/lib/api/origin";
import { rateLimit, resetRateLimitStore } from "@/lib/security/rate-limit";

describe("getClientIp", () => {
  it("prefers the first x-forwarded-for address", () => {
    const request = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });

    expect(getClientIp(request)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip and then unknown", () => {
    expect(
      getClientIp(new Request("http://localhost/api", { headers: { "x-real-ip": "198.51.100.9" } })),
    ).toBe("198.51.100.9");
    expect(getClientIp(new Request("http://localhost/api"))).toBe("unknown");
  });
});

describe("rateLimit", () => {
  it("blocks requests above the limit", () => {
    resetRateLimitStore();

    for (let i = 0; i < 5; i += 1) {
      expect(rateLimit("login:test", 5, 60_000).allowed).toBe(true);
    }

    const blocked = rateLimit("login:test", 5, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("assertSameOrigin", () => {
  it("accepts matching origin", () => {
    const request = new Request("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });

    expect(() => assertSameOrigin(request, "http://localhost:3000")).not.toThrow();
  });

  it("rejects missing or foreign origin", () => {
    const noOrigin = new Request("http://localhost:3000/api/leads", { method: "POST" });
    expect(() => assertSameOrigin(noOrigin, "http://localhost:3000")).toThrow();

    const foreign = new Request("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { origin: "http://evil.example" },
    });
    expect(() => assertSameOrigin(foreign, "http://localhost:3000")).toThrow();
  });
});
