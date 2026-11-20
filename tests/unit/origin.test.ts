import { describe, expect, it } from "vitest";
import { assertSameOrigin } from "@/lib/api/origin";
import { AppError } from "@/lib/errors";

function request(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { method: "POST", headers });
}

describe("assertSameOrigin", () => {
  it("accepts the origin configured in APP_BASE_URL", () => {
    expect(() =>
      assertSameOrigin(
        request("http://localhost:3000/api/leads", { origin: "http://localhost:3000" }),
        "http://localhost:3000",
      ),
    ).not.toThrow();
  });

  it("accepts the origin the request was actually served on", () => {
    expect(() =>
      assertSameOrigin(
        request("http://127.0.0.1:3000/api/leads", { origin: "http://127.0.0.1:3000" }),
        "http://localhost:3000",
      ),
    ).not.toThrow();
  });

  it("accepts an origin matching the Host header (same deployment, other host)", () => {
    expect(() =>
      assertSameOrigin(
        request("http://app:3000/api/leads", {
          origin: "https://crm.example.com",
          host: "crm.example.com",
        }),
        "http://localhost:3000",
      ),
    ).not.toThrow();
  });

  it("accepts the first entry of a proxy chain in x-forwarded-host", () => {
    expect(() =>
      assertSameOrigin(
        request("http://app:3000/api/leads", {
          origin: "https://crm.example.com",
          "x-forwarded-host": "crm.example.com, internal-lb",
        }),
        "http://localhost:3000",
      ),
    ).not.toThrow();
  });

  it("rejects a cross-site origin", () => {
    expect(() =>
      assertSameOrigin(
        request("http://localhost:3000/api/leads", {
          origin: "https://evil.example",
          host: "localhost:3000",
        }),
        "http://localhost:3000",
      ),
    ).toThrowError(AppError);
  });

  it("rejects a missing Origin header", () => {
    expect(() =>
      assertSameOrigin(request("http://localhost:3000/api/leads"), "http://localhost:3000"),
    ).toThrowError(AppError);
  });

  it("rejects a malformed Origin header", () => {
    expect(() =>
      assertSameOrigin(
        request("http://localhost:3000/api/leads", { origin: "not-a-url" }),
        "http://localhost:3000",
      ),
    ).toThrowError(AppError);
  });

  it("does not treat protocol smuggling in Origin as same origin", () => {
    expect(() =>
      assertSameOrigin(
        request("http://localhost:3000/api/leads", { origin: "javascript://localhost:3000" }),
        "http://localhost:3000",
      ),
    ).toThrowError(AppError);
  });
});
