import { describe, expect, it } from "vitest";
import { safeCallbackUrl } from "@/lib/auth/callback";

describe("safeCallbackUrl", () => {
  it("accepts normal internal paths with query and hash", () => {
    expect(safeCallbackUrl("/dashboard")).toBe("/dashboard");
    expect(safeCallbackUrl("/leads?status=NEW&sort=priority:desc#history")).toBe(
      "/leads?status=NEW&sort=priority:desc#history",
    );
    expect(safeCallbackUrl("/crm/abc?tab=notes")).toBe("/crm/abc?tab=notes");
  });

  it("falls back for empty and non-string values", () => {
    expect(safeCallbackUrl(undefined)).toBe("/dashboard");
    expect(safeCallbackUrl("")).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeCallbackUrl("//evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("///evil.com")).toBe("/dashboard");
  });

  it("rejects backslash and encoded backslash smuggling", () => {
    expect(safeCallbackUrl("\\evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("/\\evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("/%5Cevil.com")).toBe("/dashboard");
  });

  it("rejects encoded protocol-relative URLs", () => {
    expect(safeCallbackUrl("/%2F%2Fevil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("/%252F%252Fevil.com")).toBe("/dashboard");
  });

  it("rejects non-http schemes and foreign origins", () => {
    expect(safeCallbackUrl("javascript:alert(1)")).toBe("/dashboard");
    expect(safeCallbackUrl("data:text/html,<script>alert(1)</script>")).toBe("/dashboard");
    expect(safeCallbackUrl("vbscript:msgbox(1)")).toBe("/dashboard");
    expect(safeCallbackUrl("https://evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("http://evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("https://user:pass@example.com")).toBe("/dashboard");
  });

  it("rejects control characters", () => {
    expect(safeCallbackUrl("/%00")).toBe("/dashboard");
    expect(safeCallbackUrl("/%0d%0aLocation:%20https://evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("/dashboard?next=%0d%0aLocation:%20https://evil.com")).toBe(
      "/dashboard",
    );
    expect(safeCallbackUrl("/dashboard\u0085")).toBe("/dashboard");
  });

  it("rejects malformed percent-encoding", () => {
    expect(safeCallbackUrl("/%E0%A4%A")).toBe("/dashboard");
    expect(safeCallbackUrl("/dashboard%")).toBe("/dashboard");
  });

  it("accepts literal percent signs in paths and queries", () => {
    expect(safeCallbackUrl("/dashboard?discount=100%25")).toBe("/dashboard?discount=100%25");
    expect(safeCallbackUrl("/files/100%25")).toBe("/files/100%25");
  });

  it("still accepts literal percent signs encoded in valid URLs", () => {
    expect(safeCallbackUrl("/files/100%25")).toBe("/files/100%25");
    expect(safeCallbackUrl("/leads?q=100%25")).toBe("/leads?q=100%25");
    expect(safeCallbackUrl("/dashboard?discount=100%25")).toBe("/dashboard?discount=100%25");
  });

  it("rejects double-encoded traversal and delimiters", () => {
    expect(safeCallbackUrl("/%252e%252e/admin")).toBe("/dashboard");
    expect(safeCallbackUrl("/%252Fevil.com")).toBe("/dashboard");
  });

  it("rejects nested encoded delimiters in the middle of a path", () => {
    expect(safeCallbackUrl("/foo%252Fbar")).toBe("/dashboard");
    expect(safeCallbackUrl("/foo%253Fbar")).toBe("/dashboard");
    expect(safeCallbackUrl("/foo%2523bar")).toBe("/dashboard");
    expect(safeCallbackUrl("/dashboard%2523%2523evil")).toBe("/dashboard");
  });

  it("rejects percent-encoding nested deeper than the decode pass limit", () => {
    // Five layers of encoding still change on the next pass, so the value is
    // ambiguous rather than simply decoded.
    expect(safeCallbackUrl("/%25252525252F")).toBe("/dashboard");
  });

  it("rejects traversal attempts", () => {
    expect(safeCallbackUrl("/../admin")).toBe("/dashboard");
    expect(safeCallbackUrl("/%2e%2e/admin")).toBe("/dashboard");
    expect(safeCallbackUrl("/%2e%2e%2fadmin")).toBe("/dashboard");
    expect(safeCallbackUrl("/foo/../admin")).toBe("/dashboard");
  });

  it("rejects ambiguous internal paths instead of rewriting them", () => {
    expect(safeCallbackUrl("/a//b")).toBe("/dashboard");
    expect(safeCallbackUrl("//")).toBe("/dashboard");
    expect(safeCallbackUrl("/./dashboard")).toBe("/dashboard");
    expect(safeCallbackUrl("/a/./b")).toBe("/dashboard");
    expect(safeCallbackUrl("/a/b/")).toBe("/a/b/");
    expect(safeCallbackUrl("/")).toBe("/");
  });

  it("returns valid paths without decoding them", () => {
    expect(safeCallbackUrl("/leads?q=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0")).toBe(
      "/leads?q=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0",
    );
    expect(safeCallbackUrl("/dashboard?next=%2F%2Fevil.com")).toBe(
      "/dashboard?next=%2F%2Fevil.com",
    );
  });

  it("keeps encoded query and fragment values byte-for-byte", () => {
    expect(safeCallbackUrl("/dashboard?next=%2Fdashboard%3Ftab%3D1")).toBe(
      "/dashboard?next=%2Fdashboard%3Ftab%3D1",
    );
    expect(safeCallbackUrl("/leads?q=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0#top")).toBe(
      "/leads?q=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0#top",
    );
  });

  it("does not return a URL with a foreign origin", () => {
    const values = [
      "/a//b",
      "/%2F%2Fevil.com",
      "/%5Cevil.com",
      "/dashboard?next=%2F%2Fevil.com",
    ];

    for (const value of values) {
      const result = safeCallbackUrl(value);
      expect(result.startsWith("/")).toBe(true);
      expect(result.startsWith("//")).toBe(false);
      expect(result).not.toContain("\\");
    }
  });
});
