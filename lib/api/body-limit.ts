import { AppError } from "@/lib/errors";

const JSON_CONTENT_TYPE = "application/json";

export function assertJsonContentType(request: Request): void {
  const contentType = request.headers.get("content-type");

  if (!contentType) {
    throw new AppError("VALIDATION_ERROR", "Content-Type application/json is required");
  }

  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();

  if (mediaType !== JSON_CONTENT_TYPE) {
    throw new AppError("VALIDATION_ERROR", "Content-Type application/json is required");
  }
}

/**
 * Reads the request body as raw bytes with an actual byte counter.
 * Content-Length is checked first, then every chunk is counted before buffering.
 * The raw bytes must be used as-is for webhook HMAC verification.
 */
export async function readRawBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const contentLengthHeader = request.headers.get("content-length");

  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);

    if (!Number.isFinite(contentLength) || contentLength < 0) {
      throw new AppError("VALIDATION_ERROR", "Invalid Content-Length header");
    }

    if (contentLength > maxBytes) {
      throw new AppError("PAYLOAD_TOO_LARGE", "Request body is too large");
    }
  }

  if (!request.body) {
    throw new AppError("VALIDATION_ERROR", "Request body is required");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new AppError("PAYLOAD_TOO_LARGE", "Request body is too large");
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const bytes = await readRawBody(request, maxBytes);
  const text = new TextDecoder().decode(bytes);

  if (text.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", "Request body is required");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON body");
  }
}
