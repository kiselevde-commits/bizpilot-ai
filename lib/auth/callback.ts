const FALLBACK_URL = "/dashboard";
const MAX_DECODE_PASSES = 5;
const MAX_CALLBACK_LENGTH = 2048;

// Percent-encoded path delimiters would change the route structure once
// decoded (for example `%2F` becoming `/`), so they are never accepted.
const ENCODED_PATH_DELIMITER = /%(?:2f|5c|3f|23)/i;

// A `%` that does not start a two-digit hex escape is malformed.
const MALFORMED_PERCENT_ENCODING = /%(?![0-9a-fA-F]{2})/;

function hasControlCharacters(value: string): boolean {
  // C0 controls, DEL and C1 controls are never meaningful in a callback path.
  // This intentionally covers Unicode category Cc rather than only ASCII.
  return /[\u0000-\u001F\u007F-\u009F]/.test(value);
}

function isInternalPath(value: string): boolean {
  // Must be an absolute path on the current origin, never protocol-relative.
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}

/**
 * Rejects paths whose meaning depends on normalisation: empty interior
 * segments (`/a//b`), dot segments (`/a/./b`, `/a/../b`) and the same forms
 * produced after percent-decoding. A single trailing slash is unambiguous and
 * therefore allowed.
 */
function isAmbiguousPath(path: string): boolean {
  if (!path.startsWith("/")) {
    return true;
  }

  const segments = path.slice(1).split("/");

  if (segments.length > 0 && segments[segments.length - 1] === "") {
    segments.pop();
  }

  return segments.some((segment) => segment === "" || segment === "." || segment === "..");
}

/**
 * Splits the callback into its path and the raw query/fragment suffix. Only
 * the path takes part in repeated decoding; query values such as `100%25`
 * must not be reinterpreted.
 */
function splitPathAndSuffix(value: string): { path: string; suffix: string } {
  const delimiterIndex = value.search(/[?#]/);

  if (delimiterIndex === -1) {
    return { path: value, suffix: "" };
  }

  return { path: value.slice(0, delimiterIndex), suffix: value.slice(delimiterIndex) };
}

/**
 * Returns a safe internal callback URL or the dashboard fallback.
 *
 * Only same-origin relative paths are allowed. Backslashes (normalised to `/`
 * by some browsers), protocol-relative URLs, schemes, credentials, control
 * characters and encoded traversal attempts are rejected. Valid paths, query
 * strings and fragments are returned byte-for-byte, without decoding, so the
 * route semantics never change. Anything ambiguous falls back to `/dashboard`.
 */
export function safeCallbackUrl(value: string | undefined): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_CALLBACK_LENGTH) {
    return FALLBACK_URL;
  }

  if (
    hasControlCharacters(value) ||
    !isInternalPath(value) ||
    MALFORMED_PERCENT_ENCODING.test(value)
  ) {
    return FALLBACK_URL;
  }

  const { path, suffix } = splitPathAndSuffix(value);

  if (isAmbiguousPath(path) || ENCODED_PATH_DELIMITER.test(path)) {
    return FALLBACK_URL;
  }

  // Query and fragment are decoded once only to look for hidden control
  // characters. They are never rewritten or used to decide path ambiguity.
  if (suffix.length > 0) {
    let decodedSuffix: string;

    try {
      decodedSuffix = decodeURIComponent(suffix);
    } catch {
      return FALLBACK_URL;
    }

    if (hasControlCharacters(decodedSuffix)) {
      return FALLBACK_URL;
    }
  }

  let decodedPath = path;

  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    let next: string;

    try {
      next = decodeURIComponent(decodedPath);
    } catch {
      // The first pass reads the raw path, so malformed encoding is rejected.
      // Later passes can only fail on a literal `%` produced by `%25`, which
      // is valid and ends the decoding chain.
      if (pass === 0) {
        return FALLBACK_URL;
      }

      break;
    }

    if (next === decodedPath) {
      break;
    }

    decodedPath = next;

    if (
      decodedPath.length > MAX_CALLBACK_LENGTH ||
      hasControlCharacters(decodedPath) ||
      !isInternalPath(decodedPath) ||
      ENCODED_PATH_DELIMITER.test(decodedPath)
    ) {
      return FALLBACK_URL;
    }
  }

  // The loop is bounded, so a deeply nested payload can still be changing
  // when it exhausts its passes. One more decode must be a no-op or stop on a
  // literal percent; otherwise the remaining encoding is unpredictable.
  try {
    if (decodeURIComponent(decodedPath) !== decodedPath) {
      return FALLBACK_URL;
    }
  } catch {
    // A literal `%` left by `%25` cannot be decoded further; that is valid.
  }

  if (isAmbiguousPath(decodedPath) || decodedPath.includes("\\")) {
    return FALLBACK_URL;
  }

  try {
    const base = new URL("https://internal.invalid");
    const resolved = new URL(value, base);

    if (resolved.origin !== base.origin || resolved.username || resolved.password) {
      return FALLBACK_URL;
    }

    if (resolved.pathname.includes("//") || resolved.pathname.includes("\\")) {
      return FALLBACK_URL;
    }

    if (isAmbiguousPath(resolved.pathname)) {
      return FALLBACK_URL;
    }
  } catch {
    return FALLBACK_URL;
  }

  return value;
}
