import { describe, expect, it } from "vitest";
import { sanitizeExternalError } from "@/lib/security/sanitize";

describe("sanitizeExternalError", () => {
  it("redacts Telegram bot tokens, URLs and database URLs", () => {
    const input =
      "Request failed https://api.telegram.org/bot123456:AAH-secret-token/sendMessage " +
      "Bearer abc.def.ghi postgresql://bizpilot:password@db:5432/bizpilot";
    const sanitized = sanitizeExternalError(input);

    expect(sanitized).not.toContain("AAH-secret-token");
    expect(sanitized).not.toContain("abc.def.ghi");
    expect(sanitized).not.toContain("password");
    expect(sanitized).toContain("[REDACTED]");
  });

  it("removes control characters and collapses whitespace", () => {
    expect(sanitizeExternalError("line1\n\tline2\u0000")).toBe("line1 line2");
  });

  it("returns null for empty values", () => {
    expect(sanitizeExternalError(null)).toBeNull();
    expect(sanitizeExternalError(undefined)).toBeNull();
    expect(sanitizeExternalError("   ")).toBeNull();
  });

  it("truncates long messages", () => {
    const sanitized = sanitizeExternalError("x".repeat(1000), 100);

    expect(sanitized).not.toBeNull();
    expect(sanitized?.length).toBeLessThanOrEqual(100);
  });
});
