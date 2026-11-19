const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;
const TELEGRAM_BOT_TOKEN = /bot\d+:[A-Za-z0-9_-]+/gi;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const DATABASE_URL = /\bpostgres(?:ql)?:\/\/[^\s"']+/gi;
const GENERIC_URL = /\bhttps?:\/\/[^\s"']+/gi;

const DEFAULT_MAX_LENGTH = 500;

/**
 * Produces a short, control-character-free error message suitable for storing in
 * `AutomationEvent.lastError` and returning to authenticated users.
 *
 * URLs and common credential shapes are redacted because provider errors may echo
 * request URLs (Telegram bot token is part of the API URL, DB credentials are part
 * of connection strings).
 */
export function sanitizeExternalError(
  value: unknown,
  maxLength: number = DEFAULT_MAX_LENGTH,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const text = typeof value === "string" ? value : String(value);
  const sanitized = text
    .replace(CONTROL_CHARACTERS, " ")
    .replace(TELEGRAM_BOT_TOKEN, "bot[REDACTED]")
    .replace(BEARER_TOKEN, "Bearer [REDACTED]")
    .replace(DATABASE_URL, "postgres://[REDACTED]")
    .replace(GENERIC_URL, "[URL]")
    .replace(/\s+/g, " ")
    .trim();

  if (sanitized.length === 0) {
    return null;
  }

  return sanitized.length > maxLength ? `${sanitized.slice(0, maxLength - 1)}…` : sanitized;
}
