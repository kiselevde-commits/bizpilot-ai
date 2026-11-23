// Must stay first: it refuses an unsafe target before Prisma is imported.
import "./helpers/enforce-test-database";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/database/prisma";

/**
 * Real PostgreSQL checks for the n8n_processed deduplication table.
 * These tests use the configured DATABASE_URL and only touch keys prefixed
 * with `test-n8n-processed-`; they never read or write CRM tables.
 */

const createdKeys = new Set<string>();

function testKey(label: string): string {
  const key = `test-n8n-processed-${label}-${randomUUID()}`;
  createdKeys.add(key);

  return key;
}

async function insertClaimed(key: string): Promise<Array<{ idempotency_key: string }>> {
  return prisma.$queryRaw<Array<{ idempotency_key: string }>>`
    INSERT INTO "n8n_processed" ("idempotency_key", "status", "claimed_at")
    VALUES (${key}, 'CLAIMED', now())
    ON CONFLICT ("idempotency_key") DO NOTHING
    RETURNING "idempotency_key"
  `;
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

afterAll(async () => {
  if (createdKeys.size > 0) {
    await prisma.$executeRaw`
      DELETE FROM "n8n_processed"
      WHERE "idempotency_key" = ANY(${Array.from(createdKeys)})
    `;
  }

  await prisma.$disconnect();
});

describe("n8n_processed PostgreSQL dedupe", () => {
  it("uses INSERT ... ON CONFLICT DO NOTHING RETURNING", async () => {
    const key = testKey("single");

    const first = await insertClaimed(key);
    const second = await insertClaimed(key);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });

  it("allows exactly one concurrent claim for the same key", async () => {
    const key = testKey("concurrent");

    const results = await Promise.all([
      insertClaimed(key),
      insertClaimed(key),
      insertClaimed(key),
      insertClaimed(key),
    ]);

    expect(results.filter((rows) => rows.length === 1)).toHaveLength(1);
    expect(results.filter((rows) => rows.length === 0)).toHaveLength(3);
  });

  it("detects CLAIMED rows older than 15 minutes for manual reconciliation", async () => {
    const key = testKey("stale");

    await prisma.$executeRaw`
      INSERT INTO "n8n_processed" ("idempotency_key", "status", "claimed_at")
      VALUES (${key}, 'CLAIMED', now() - interval '20 minutes')
    `;

    const stale = await prisma.$queryRaw<Array<{ idempotency_key: string }>>`
      SELECT "idempotency_key"
      FROM "n8n_processed"
      WHERE "status" = 'CLAIMED'
        AND "claimed_at" < now() - interval '15 minutes'
        AND "idempotency_key" = ${key}
    `;

    expect(stale).toHaveLength(1);
  });

  it("reclaims a FAILED row atomically for manual retry, only once", async () => {
    const key = testKey("reclaim");

    await prisma.$executeRaw`
      INSERT INTO "n8n_processed" ("idempotency_key", "status", "claimed_at", "processed_at", "last_error")
      VALUES (${key}, 'FAILED', now(), now(), 'telegram failed')
    `;

    const first = await prisma.$queryRaw<Array<{ idempotency_key: string }>>`
      UPDATE "n8n_processed"
      SET
        "status" = 'CLAIMED',
        "claimed_at" = now(),
        "processed_at" = NULL,
        "last_error" = NULL
      WHERE "idempotency_key" = ${key} AND "status" = 'FAILED'
      RETURNING "idempotency_key"
    `;

    const second = await prisma.$queryRaw<Array<{ idempotency_key: string }>>`
      UPDATE "n8n_processed"
      SET
        "status" = 'CLAIMED',
        "claimed_at" = now(),
        "processed_at" = NULL,
        "last_error" = NULL
      WHERE "idempotency_key" = ${key} AND "status" = 'FAILED'
      RETURNING "idempotency_key"
    `;

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });

  it("does not reclaim SENT or CLAIMED rows", async () => {
    const sentKey = testKey("sent");
    await prisma.$executeRaw`
      INSERT INTO "n8n_processed" ("idempotency_key", "status", "claimed_at")
      VALUES (${sentKey}, 'SENT', now())
    `;

    const result = await prisma.$queryRaw<Array<{ idempotency_key: string }>>`
      UPDATE "n8n_processed"
      SET "status" = 'CLAIMED', "claimed_at" = now()
      WHERE "idempotency_key" = ${sentKey} AND "status" = 'FAILED'
      RETURNING "idempotency_key"
    `;

    expect(result).toHaveLength(0);
  });
});
