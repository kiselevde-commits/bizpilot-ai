-- n8n deduplication table (TZ 24.12).
-- This table is intentionally not part of the Prisma schema.
CREATE TABLE "n8n_processed" (
  "idempotency_key" text PRIMARY KEY,
  "status" text NOT NULL CHECK ("status" IN ('CLAIMED', 'SENT', 'FAILED')),
  "claimed_at" timestamptz NOT NULL DEFAULT now(),
  "processed_at" timestamptz NULL,
  "external_event_id" text NULL,
  "last_error" text NULL
);

CREATE INDEX "n8n_processed_status_claimed_at_idx"
  ON "n8n_processed" ("status", "claimed_at");
