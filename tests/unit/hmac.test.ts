import { describe, expect, it } from "vitest";
import {
  HMAC_TIMESTAMP_WINDOW_SECONDS,
  checkTimestamp,
  computeHmacSignature,
  currentTimestampSeconds,
  verifyHmacSignature,
} from "@/lib/security/hmac";

const SECRET = "test-secret-value";
const TIMESTAMP = "1700000000";
const BODY = '{"eventId":"evt-1","status":"delivered"}';

describe("HMAC signatures", () => {
  it("accepts a signature computed over the exact raw body", () => {
    const signature = computeHmacSignature(SECRET, TIMESTAMP, BODY);

    expect(signature).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyHmacSignature(SECRET, TIMESTAMP, BODY, signature)).toBe(true);
  });

  it("accepts a signature computed over raw bytes", () => {
    const bytes = new TextEncoder().encode(BODY);
    const signature = computeHmacSignature(SECRET, TIMESTAMP, bytes);

    expect(verifyHmacSignature(SECRET, TIMESTAMP, BODY, signature)).toBe(true);
    expect(verifyHmacSignature(SECRET, TIMESTAMP, bytes, signature)).toBe(true);
  });

  it("rejects a signature when the raw body changed by one byte", () => {
    const signature = computeHmacSignature(SECRET, TIMESTAMP, BODY);
    const tampered = BODY.replace("delivered", "failed");

    expect(verifyHmacSignature(SECRET, TIMESTAMP, tampered, signature)).toBe(false);
  });

  it("rejects a signature with the wrong secret", () => {
    const signature = computeHmacSignature(SECRET, TIMESTAMP, BODY);

    expect(verifyHmacSignature("other-secret", TIMESTAMP, BODY, signature)).toBe(false);
  });

  it("rejects malformed, empty and length-mismatched signatures without throwing", () => {
    const signature = computeHmacSignature(SECRET, TIMESTAMP, BODY);

    expect(verifyHmacSignature(SECRET, TIMESTAMP, BODY, null)).toBe(false);
    expect(verifyHmacSignature(SECRET, TIMESTAMP, BODY, "")).toBe(false);
    expect(verifyHmacSignature(SECRET, TIMESTAMP, BODY, "not-hex")).toBe(false);
    expect(verifyHmacSignature(SECRET, TIMESTAMP, BODY, signature.slice(0, 32))).toBe(false);
  });

  it("produces a lowercase hex timestamp in seconds", () => {
    expect(currentTimestampSeconds(1_700_000_000_123)).toBe("1700000000");
  });
});

describe("HMAC timestamp window", () => {
  const nowMs = Number(TIMESTAMP) * 1000;

  it("accepts timestamps inside ±5 minutes, including boundaries", () => {
    expect(checkTimestamp(TIMESTAMP, { nowMs }).valid).toBe(true);
    expect(
      checkTimestamp(String(Number(TIMESTAMP) - HMAC_TIMESTAMP_WINDOW_SECONDS), { nowMs }).valid,
    ).toBe(true);
    expect(
      checkTimestamp(String(Number(TIMESTAMP) + HMAC_TIMESTAMP_WINDOW_SECONDS), { nowMs }).valid,
    ).toBe(true);
  });

  it("rejects expired timestamps", () => {
    const stale = String(Number(TIMESTAMP) - HMAC_TIMESTAMP_WINDOW_SECONDS - 1);

    expect(checkTimestamp(stale, { nowMs })).toEqual({
      valid: false,
      reason: "expired",
    });
  });

  it("rejects timestamps too far in the future", () => {
    const future = String(Number(TIMESTAMP) + HMAC_TIMESTAMP_WINDOW_SECONDS + 1);

    expect(checkTimestamp(future, { nowMs })).toEqual({
      valid: false,
      reason: "future",
    });
  });

  it("rejects non-numeric and empty timestamps", () => {
    expect(checkTimestamp("abc", { nowMs }).valid).toBe(false);
    expect(checkTimestamp(null, { nowMs }).valid).toBe(false);
    expect(checkTimestamp("", { nowMs }).valid).toBe(false);
    expect(checkTimestamp("1e9", { nowMs }).valid).toBe(false);
  });
});
