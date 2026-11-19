import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const HMAC_TIMESTAMP_WINDOW_SECONDS = 300;
export const HMAC_SIGNATURE_HEX_LENGTH = 64;

const HEX_SIGNATURE_PATTERN = /^[0-9a-f]{64}$/i;
const UNIX_TIMESTAMP_PATTERN = /^\d{1,12}$/;

export type TimestampCheckReason = "invalid" | "expired" | "future";

export type TimestampCheck = { valid: true } | { valid: false; reason: TimestampCheckReason };

/**
 * HMAC-SHA256(secret, timestamp + "." + rawBody).
 *
 * The timestamp is a Unix epoch value in seconds encoded as a decimal string.
 * The caller must pass the exact raw request body bytes (never a re-serialized JSON).
 */
export function computeHmacSignature(
  secret: string,
  timestamp: string,
  rawBody: string | Uint8Array,
): string {
  if (!secret) {
    throw new Error("HMAC secret is not configured");
  }

  const prefix = Buffer.from(`${timestamp}.`, "utf8");
  const body = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : Buffer.from(rawBody);

  return createHmac("sha256", secret)
    .update(Buffer.concat([prefix, body]))
    .digest("hex");
}

/**
 * Constant-time verification of a lowercase/uppercase hex HMAC signature.
 * Invalid signature format (length or non-hex) is rejected before comparison.
 */
export function verifyHmacSignature(
  secret: string,
  timestamp: string,
  rawBody: string | Uint8Array,
  signature: string | null | undefined,
): boolean {
  if (!secret || !signature) {
    return false;
  }

  const candidate = signature.trim();

  if (!HEX_SIGNATURE_PATTERN.test(candidate)) {
    return false;
  }

  const expected = computeHmacSignature(secret, timestamp, rawBody);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const candidateBuffer = Buffer.from(candidate.toLowerCase(), "utf8");

  if (expectedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, candidateBuffer);
}

/** Validates a Unix timestamp (seconds) against a symmetric ± window. */
export function checkTimestamp(
  timestamp: string | null | undefined,
  options: { nowMs?: number; windowSeconds?: number } = {},
): TimestampCheck {
  if (!timestamp || !UNIX_TIMESTAMP_PATTERN.test(timestamp.trim())) {
    return { valid: false, reason: "invalid" };
  }

  const seconds = Number(timestamp.trim());

  if (!Number.isSafeInteger(seconds)) {
    return { valid: false, reason: "invalid" };
  }

  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const windowSeconds = options.windowSeconds ?? HMAC_TIMESTAMP_WINDOW_SECONDS;

  if (seconds < nowSeconds - windowSeconds) {
    return { valid: false, reason: "expired" };
  }

  if (seconds > nowSeconds + windowSeconds) {
    return { valid: false, reason: "future" };
  }

  return { valid: true };
}

/** Unix epoch seconds as a string, used in outbound signatures. */
export function currentTimestampSeconds(nowMs: number = Date.now()): string {
  return String(Math.floor(nowMs / 1000));
}
