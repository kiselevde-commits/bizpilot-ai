/** Retry policy for outbound n8n delivery (TZ 24.13). */

export const MAX_AUTOMATIC_ATTEMPTS = 4; // 1 initial + 3 automatic retries
export const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000] as const; // 1m, 5m, 30m
export const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000;
export const LEASE_DURATION_MS = 5 * 60 * 1000;
export const STALE_CLAIM_MS = 15 * 60 * 1000;
export const MAX_DISPATCH_BATCH = 10;

export type HttpClassification = "success" | "retry" | "terminal";

/**
 * Classifies an n8n HTTP response.
 * - 2xx: accepted by n8n.
 * - 429 and 5xx: transient, retry.
 * - other statuses (permanent 4xx, unexpected 3xx): terminal.
 */
export function classifyHttpStatus(status: number): HttpClassification {
  if (status >= 200 && status < 300) {
    return "success";
  }

  if (status === 429 || status >= 500) {
    return "retry";
  }

  return "terminal";
}

/**
 * Delay before the next automatic attempt.
 *
 * @param attemptsPerformed total HTTP attempts already made, including the one
 * that just failed (1 after the initial attempt).
 * @returns delay in milliseconds, or null when no automatic retry is allowed.
 */
export function retryDelayForAttempt(attemptsPerformed: number): number | null {
  if (!Number.isInteger(attemptsPerformed) || attemptsPerformed < 1) {
    return null;
  }

  if (attemptsPerformed >= MAX_AUTOMATIC_ATTEMPTS) {
    return null;
  }

  return RETRY_DELAYS_MS[attemptsPerformed - 1] ?? null;
}

export function canRetryAutomatically(attemptsPerformed: number): boolean {
  return retryDelayForAttempt(attemptsPerformed) !== null;
}

export function isEventExpired(createdAt: Date, now: Date = new Date()): boolean {
  return createdAt.getTime() + MAX_EVENT_AGE_MS <= now.getTime();
}

export function isLeaseExpired(
  lockedAt: Date | null,
  now: Date = new Date(),
  leaseMs: number = LEASE_DURATION_MS,
): boolean {
  if (!lockedAt) {
    return true;
  }

  return lockedAt.getTime() + leaseMs <= now.getTime();
}

/**
 * Computes the next retry time, respecting both the fixed schedule and an
 * optional `Retry-After` value for HTTP 429.
 */
export function nextRetryAt(
  now: Date,
  attemptsPerformed: number,
  retryAfterSeconds: number | null = null,
): Date | null {
  const scheduleDelay = retryDelayForAttempt(attemptsPerformed);

  if (scheduleDelay === null) {
    return null;
  }

  const retryAfterDelay =
    retryAfterSeconds !== null && Number.isFinite(retryAfterSeconds)
      ? Math.max(0, Math.ceil(retryAfterSeconds)) * 1000
      : 0;

  return new Date(now.getTime() + Math.max(scheduleDelay, retryAfterDelay));
}

export function wouldExceedMaxAge(createdAt: Date, retryAt: Date | null): boolean {
  if (!retryAt) {
    return true;
  }

  return retryAt.getTime() >= createdAt.getTime() + MAX_EVENT_AGE_MS;
}
