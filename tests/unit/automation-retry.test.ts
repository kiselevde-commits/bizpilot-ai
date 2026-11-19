import { describe, expect, it } from "vitest";
import {
  LEASE_DURATION_MS,
  MAX_AUTOMATIC_ATTEMPTS,
  MAX_EVENT_AGE_MS,
  RETRY_DELAYS_MS,
  canRetryAutomatically,
  classifyHttpStatus,
  isEventExpired,
  isLeaseExpired,
  nextRetryAt,
  retryDelayForAttempt,
  wouldExceedMaxAge,
} from "@/lib/integrations/retry";

describe("automation retry policy", () => {
  it("uses 1m, 5m and 30m delays", () => {
    expect(RETRY_DELAYS_MS).toEqual([60_000, 300_000, 1_800_000]);
    expect(retryDelayForAttempt(1)).toBe(60_000);
    expect(retryDelayForAttempt(2)).toBe(300_000);
    expect(retryDelayForAttempt(3)).toBe(1_800_000);
  });

  it("allows exactly one initial attempt plus three automatic retries", () => {
    expect(MAX_AUTOMATIC_ATTEMPTS).toBe(4);
    expect(canRetryAutomatically(1)).toBe(true);
    expect(canRetryAutomatically(2)).toBe(true);
    expect(canRetryAutomatically(3)).toBe(true);
    expect(canRetryAutomatically(4)).toBe(false);
    expect(retryDelayForAttempt(4)).toBeNull();
    expect(retryDelayForAttempt(0)).toBeNull();
  });

  it("computes a retry time from the fixed schedule", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");

    expect(nextRetryAt(now, 1)?.toISOString()).toBe("2026-01-01T12:01:00.000Z");
    expect(nextRetryAt(now, 2)?.toISOString()).toBe("2026-01-01T12:05:00.000Z");
    expect(nextRetryAt(now, 3)?.toISOString()).toBe("2026-01-01T12:30:00.000Z");
    expect(nextRetryAt(now, 4)).toBeNull();
  });

  it("honours Retry-After for HTTP 429 when it is longer than the schedule", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");

    expect(nextRetryAt(now, 1, 120)?.toISOString()).toBe("2026-01-01T12:02:00.000Z");
    expect(nextRetryAt(now, 1, 10)?.toISOString()).toBe("2026-01-01T12:01:00.000Z");
  });

  it("stops at the 24-hour maximum age", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const fresh = new Date(now.getTime() - 1_000);
    const almostExpired = new Date(now.getTime() - MAX_EVENT_AGE_MS + 60_000);
    const expired = new Date(now.getTime() - MAX_EVENT_AGE_MS);

    expect(isEventExpired(fresh, now)).toBe(false);
    expect(isEventExpired(expired, now)).toBe(true);
    expect(wouldExceedMaxAge(fresh, new Date(now.getTime() + 30 * 60_000))).toBe(false);
    expect(wouldExceedMaxAge(almostExpired, new Date(now.getTime() + 30 * 60_000))).toBe(true);
  });

  it("expires a DB lease after five minutes", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");

    expect(isLeaseExpired(null, now)).toBe(true);
    expect(isLeaseExpired(new Date(now.getTime() - LEASE_DURATION_MS + 1_000), now)).toBe(false);
    expect(isLeaseExpired(new Date(now.getTime() - LEASE_DURATION_MS), now)).toBe(true);
  });

  it("classifies HTTP responses for retry decisions", () => {
    expect(classifyHttpStatus(200)).toBe("success");
    expect(classifyHttpStatus(202)).toBe("success");
    expect(classifyHttpStatus(429)).toBe("retry");
    expect(classifyHttpStatus(500)).toBe("retry");
    expect(classifyHttpStatus(503)).toBe("retry");
    expect(classifyHttpStatus(400)).toBe("terminal");
    expect(classifyHttpStatus(401)).toBe("terminal");
    expect(classifyHttpStatus(404)).toBe("terminal");
    expect(classifyHttpStatus(302)).toBe("terminal");
  });
});
