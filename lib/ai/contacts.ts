import "server-only";
import type { ExtractedContacts } from "@/lib/ai/schema";

/**
 * Normalizes a free-text value for containment checks: lowercase, collapse
 * whitespace, strip punctuation/symbols. Cyrillic letters are preserved.
 */
function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function toDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Keeps a text field (name/company/email) only when it is mentioned in the
 * source lead text. Returns the trimmed original value or `null`.
 */
function verifyMentioned(
  sourceNormalized: string,
  value: string | null | undefined,
): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length === 0) {
    return null;
  }

  const normalized = normalizeForMatch(trimmed);
  if (normalized.length === 0) {
    return null;
  }

  if (!sourceNormalized.includes(normalized)) {
    return null;
  }

  return trimmed;
}

/**
 * Keeps a phone number only when its digit sequence occurs in the source text
 * (e.g. source `+7 999 000-11-22` matches extracted `+79990001122`).
 * Returns the trimmed original value or `null`.
 */
function verifyPhone(sourceDigits: string, value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  const digits = toDigits(trimmed);
  if (digits.length === 0) {
    return null;
  }

  if (!sourceDigits.includes(digits)) {
    return null;
  }

  return trimmed;
}

/**
 * Filters AI-extracted contact data against the original lead text.
 *
 * The model may hallucinate contact details, so only values that are actually
 * present in the source text are kept; everything else is dropped (null) before
 * the result reaches the user interface or is persisted.
 */
export function filterExtractedContacts(
  sourceText: string,
  extracted: ExtractedContacts | null | undefined,
): ExtractedContacts {
  const source = sourceText ?? "";
  const sourceNormalized = normalizeForMatch(source);
  const sourceDigits = toDigits(source);

  const name = verifyMentioned(sourceNormalized, extracted?.name);
  const company = verifyMentioned(sourceNormalized, extracted?.company);
  const email = verifyMentioned(sourceNormalized, extracted?.email);
  const phone = verifyPhone(sourceDigits, extracted?.phone);

  return { name, company, email, phone };
}
