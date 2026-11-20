import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/database/prisma";
import { dispatchPendingEvents, getAutomationStatus } from "@/services/automation.service";
import type { N8nClient, N8nDispatchConfig } from "@/lib/integrations/n8n";
import type { AutomationEvent } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Real PostgreSQL checks for the outbox claim/lease SQL. A fake n8n client is
 * injected, so no network calls are made. Only AutomationEvent rows created by
 * this file are touched and they are deleted after each test.
 */

const CONFIG: N8nDispatchConfig = {
  webhookUrl: "http://n8n.test/webhook/lead-created",
  webhookSecret: "test-secret",
  timeoutMs: 1_000,
  appBaseUrl: null,
};

let workspaceId = "";
const createdIds: string[] = [];
const staleClaimKeys: string[] = [];
const createdWorkspaceIds: string[] = [];

function makeClient(): { client: N8nClient; sendEvent: ReturnType<typeof vi.fn> } {
  const sendEvent = vi.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));

    return {
      kind: "response" as const,
      status: 200,
      retryAfterSeconds: null,
      externalEventId: "exec-integration",
    };
  });

  return { client: { sendEvent }, sendEvent };
}

async function createEvent(
  overrides: Partial<Omit<AutomationEvent, "payload">> = {},
): Promise<AutomationEvent> {
  const event = await prisma.automationEvent.create({
    data: {
      workspaceId,
      eventType: "lead.created",
      entityId: `test-lead-${randomUUID()}`,
      payload: {
        title: "Integration test lead",
        priority: "HIGH",
        category: "business_automation",
        summary: null,
        url: null,
      },
      status: "PENDING",
      idempotencyKey: `test-automation-${randomUUID()}`,
      ...overrides,
    },
  });

  createdIds.push(event.id);

  return event;
}

beforeAll(async () => {
  // Isolate this file from seed/demo/API-smoke data: all events belong to a
  // dedicated workspace created here and removed in afterAll.
  const workspace = await prisma.workspace.create({
    data: { name: "Outbox Integration", slug: `outbox-integration-${randomUUID()}` },
  });

  workspaceId = workspace.id;
});

afterEach(async () => {
  if (staleClaimKeys.length > 0) {
    await prisma.$executeRaw`
      DELETE FROM "n8n_processed"
      WHERE "idempotency_key" = ANY(${staleClaimKeys}::text[])
    `;
    staleClaimKeys.length = 0;
  }

  if (createdIds.length > 0) {
    await prisma.automationEvent.deleteMany({
      where: { id: { in: createdIds } },
    });
    createdIds.length = 0;
  }

  if (createdWorkspaceIds.length > 0) {
    await prisma.workspace.deleteMany({
      where: { id: { in: createdWorkspaceIds } },
    });
    createdWorkspaceIds.length = 0;
  }
});

afterAll(async () => {
  if (workspaceId) {
    await prisma.automationEvent.deleteMany({ where: { workspaceId } });
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
  }

  await prisma.$disconnect();
});

describe("outbox dispatcher against PostgreSQL", () => {
  it("claims an event with FOR UPDATE SKIP LOCKED and stores SENT", async () => {
    const event = await createEvent();
    const { client, sendEvent } = makeClient();

    const summary = await dispatchPendingEvents({
      client,
      config: CONFIG,
      eventId: event.id,
    });

    const stored = await prisma.automationEvent.findUniqueOrThrow({
      where: { id: event.id },
    });

    expect(summary).toMatchObject({ claimed: 1, sent: 1 });
    expect(sendEvent).toHaveBeenCalledTimes(1);
    expect(stored.status).toBe("SENT");
    expect(stored.attempts).toBe(1);
    expect(stored.lockedAt).toBeNull();
    expect(stored.lockToken).toBeNull();
    expect(stored.lastError).toBeNull();
    expect(stored.externalEventId).toBe("exec-integration");
  });

  it("does not send the same event twice under concurrent dispatch", async () => {
    const first = await createEvent();
    const second = await createEvent();
    const { client, sendEvent } = makeClient();

    await Promise.all([
      dispatchPendingEvents({ client, config: CONFIG, limit: 10, workspaceId }),
      dispatchPendingEvents({ client, config: CONFIG, limit: 10, workspaceId }),
    ]);

    const stored = await prisma.automationEvent.findMany({
      where: { id: { in: [first.id, second.id] } },
    });
    const calledIds = sendEvent.mock.calls.map((call) => (call[0] as { eventId: string }).eventId);

    expect(stored.every((event) => event.status === "SENT")).toBe(true);
    expect(calledIds.sort()).toEqual([first.id, second.id].sort());
  });

  it("respects an active lease and reclaims an expired lease", async () => {
    const event = await createEvent({
      lockedAt: new Date(Date.now() - 60_000),
      lockToken: "old-lock",
      attempts: 1,
    });
    const { client, sendEvent } = makeClient();

    const activeLease = await dispatchPendingEvents({
      client,
      config: CONFIG,
      eventId: event.id,
    });

    expect(activeLease.claimed).toBe(0);
    expect(sendEvent).not.toHaveBeenCalled();

    await prisma.automationEvent.update({
      where: { id: event.id },
      data: { lockedAt: new Date(Date.now() - 6 * 60_000) },
    });

    const expiredLease = await dispatchPendingEvents({
      client,
      config: CONFIG,
      eventId: event.id,
    });
    const stored = await prisma.automationEvent.findUniqueOrThrow({
      where: { id: event.id },
    });

    expect(expiredLease).toMatchObject({ claimed: 1, sent: 1 });
    expect(stored.attempts).toBe(2);
    expect(stored.status).toBe("SENT");
  });

  it("waits for nextRetryAt and then claims the event", async () => {
    const event = await createEvent({
      status: "RETRYING",
      attempts: 1,
      nextRetryAt: new Date(Date.now() + 10 * 60_000),
    });
    const { client, sendEvent } = makeClient();

    const before = await dispatchPendingEvents({
      client,
      config: CONFIG,
      eventId: event.id,
    });

    expect(before.claimed).toBe(0);
    expect(sendEvent).not.toHaveBeenCalled();

    await prisma.automationEvent.update({
      where: { id: event.id },
      data: { nextRetryAt: new Date(Date.now() - 1_000) },
    });

    const after = await dispatchPendingEvents({
      client,
      config: CONFIG,
      eventId: event.id,
    });

    expect(after).toMatchObject({ claimed: 1, sent: 1 });
  });

  it("fails an event older than 24 hours without calling n8n", async () => {
    const event = await createEvent({
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });
    const { client, sendEvent } = makeClient();

    const summary = await dispatchPendingEvents({
      client,
      config: CONFIG,
      eventId: event.id,
    });
    const stored = await prisma.automationEvent.findUniqueOrThrow({
      where: { id: event.id },
    });

    expect(summary).toMatchObject({ claimed: 1, failed: 1 });
    expect(sendEvent).not.toHaveBeenCalled();
    expect(stored.status).toBe("FAILED");
    expect(stored.lastError).toContain("24");
  });

  it("scopes stale CLAIMED rows to the current workspace", async () => {
    const eventA = await createEvent({ status: "SENT" });

    const workspaceB = await prisma.workspace.create({
      data: { name: "Test Workspace B", slug: `test-b-${randomUUID()}` },
    });
    createdWorkspaceIds.push(workspaceB.id);

    const eventB = await prisma.automationEvent.create({
      data: {
        workspaceId: workspaceB.id,
        eventType: "lead.created",
        entityId: `test-lead-${randomUUID()}`,
        payload: { title: "Workspace B" },
        status: "SENT",
        idempotencyKey: `test-automation-b-${randomUUID()}`,
      },
    });
    createdIds.push(eventB.id);

    staleClaimKeys.push(eventA.idempotencyKey, eventB.idempotencyKey);

    await prisma.$executeRaw`
      INSERT INTO "n8n_processed" ("idempotency_key", "status", "claimed_at")
      VALUES
        (${eventA.idempotencyKey}, 'CLAIMED', now() - interval '20 minutes'),
        (${eventB.idempotencyKey}, 'CLAIMED', now() - interval '20 minutes')
    `;

    const user: SessionUser = {
      id: "admin-1",
      name: "Admin",
      email: "admin@demo.local",
      role: "ADMIN",
      workspaceId,
      workspaceName: "Demo",
    };
    const status = await getAutomationStatus(user);
    const keys = status.staleClaims.map((claim) => claim.idempotencyKey);

    expect(keys).toContain(eventA.idempotencyKey);
    expect(keys).not.toContain(eventB.idempotencyKey);
  });
});
