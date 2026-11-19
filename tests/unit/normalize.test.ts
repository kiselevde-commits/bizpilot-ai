import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizePhone } from "@/lib/utils/normalize";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ivan@Example.COM ")).toBe("ivan@example.com");
  });

  it("returns null for empty/whitespace", () => {
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("keeps digits for unknown formats", () => {
    expect(normalizePhone("123-456")).toBe("123456");
  });

  it("normalizes Russian 11-digit 7/8 prefix to +7", () => {
    expect(normalizePhone("+7 900 111-22-33")).toBe("+79001112233");
    expect(normalizePhone("89004445566")).toBe("+79004445566");
    expect(normalizePhone("8-900-123-45-67")).toBe("+79001234567");
  });

  it("returns null for empty", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});
