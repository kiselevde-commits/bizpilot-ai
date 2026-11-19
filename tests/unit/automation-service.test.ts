import { beforeEach, describe, expect, it, vi } from "vitest";
import type { N8nClient, N8nDispatchConfig } from "@/lib/integrations/n8n";
import type { SessionUser } from "@/lib/auth/session";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    automationEvent: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    integration: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/database/prisma";
import {
  dispatchPendingEvents,
  getAutomationStatus,
  handleN8nCallback,
  listAutomationEvents,
  retryAutomationEvent,
} from "@/services/automation.service";

type MockFn = ReturnType<typeof vi.fn>;

const prismaMock = prisma as unknown as {
  automationEvent: {
    findMany: MockFn;
    findFirst: MockFn;
    count: MockFn;
    groupBy: MockFn;
    updateMany: MockFn;
    update: MockFn;
  };
  integration: {
    findMany: MockFn;
    updateMany: MockFn;
  };
  activityLog: {
    create: MockFn;
  };
  $queryRaw: MockFn;
  $transaction: MockFn;
};

const adminUser: SessionUser = {
  id: "admin-1",
  name: "Admin",
  email: "admin@example.com",
  role: "ADMIN",
  workspaceId: "workspace-a",
  workspaceName: "Workspace A",
};

const operatorUser: SessionUser = {
  ...adminUser,
  id: "operator-1",
  role: "OPERATOR",
};

const managerUser: SessionUser = {
  ...adminUser,
  id: "manager-1",
  role: "MANAGER",
};

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-01-01T12:00:00.000Z");

const CONFIG: N8nDispatchConfig = {
  webhookUrl: "http://n8n.test/webhook/lead-created",
  webhookSecret: "webhook-secret",
  timeoutMs: 1_000,
  appBaseUrl: null,
};

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    eventType: "lead.created",
    entityId: "lead-1",
    payload: {
      title: "Test lead",
      priority: "HIGH",
      category: "business_automation",
      summary: null,
      url: null,
    },
    status: "PENDING",
    idempotencyKey: "lead.created:lead-1",
    externalEventId: null,
    attempts: 0,
    lastError: null,
    nextRetryAt: null,
    lockedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    workspaceId: "workspace-a",
    ...overrides,
  };
}

function makeClient(result: unknown): N8nClient {
  return { sendEvent: vi.fn().mockResolvedValue(result) };
}

function lastUpdateData(): Record<string, unknown> {
  const call = prismaMock.automationEvent.updateMany.mock.calls.at(-1)?.[0] as
    { data?: Record<string, unknown> } | undefined;

  return call?.data ?? {};
}

beforeEach(() => {
  vi.clearAllMocks();

  process.env.N8N_WEBHOOK_URL = "";
  process.env.N8N_WEBHOOK_SECRET = "";
  process.env.N8N_CALLBACK_SECRET = "";
  process.env.TELEGRAM_BOT_TOKEN = "";
  process.env.TELEGRAM_CHAT_ID = "";

  prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: unknown) => Promise<unknown>)(prismaMock);
    }

    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }

    return arg;
  });
  prismaMock.automationEvent.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.automationEvent.update.mockResolvedValue(makeEvent());
  prismaMock.activityLog.create.mockResolvedValue({});
  prismaMock.integration.updateMany.mockResolvedValue({ count: 1 });
});

describe("dispatchPendingEvents", () => {
  it("sends a claimed event and stores SENT with attempts", async () => {
    prismaMock.$queryRaw.mockResolvedValue([makeEvent()]);
    const client = makeClient({
      kind: "response",
      status: 200,
      retryAfterSeconds: null,
      externalEventId: "exec-1",
    });

    const summary = await dispatchPendingEvents({
      client,
      config: CONFIG,
      now: NOW,
    });

    expect(summary).toEqual({
      claimed: 1,
      sent: 1,
      retried: 0,
      failed: 0,
      skipped: 0,
    });
    expect(client.sendEvent).toHaveBeenCalledTimes(1);
    expect(lastUpdateData()).toMatchObject({
      status: "SENT",
      attempts: 1,
      lastError: null,
      nextRetryAt: null,
      externalEventId: "exec-1",
      lockedAt: null,
      lockToken: null,
    });
  });

  it("retries 5xx after one minute and increments attempts", async () => {
    prismaMock.$queryRaw.mockResolvedValue([makeEvent()]);
    const client = makeClient({
      kind: "response",
      status: 503,
      retryAfterSeconds: null,
      externalEventId: null,
    });

    const summary = await dispatchPendingEvents({
      client,
      config: CONFIG,
      now: NOW,
    });

    expect(summary.retried).toBe(1);
    expect(lastUpdateData()).toMatchObject({
      status: "RETRYING",
      attempts: 1,
    });
    expect((lastUpdateData().nextRetryAt as Date).toISOString()).toBe("2026-01-01T12:01:00.000Z");
  });

  it("honours Retry-After for HTTP 429", async () => {
    prismaMock.$queryRaw.mockResolvedValue([makeEvent()]);
    const client = makeClient({
      kind: "response",
      status: 429,
      retryAfterSeconds: 120,
      externalEventId: null,
    });

    await dispatchPendingEvents({ client, config: CONFIG, now: NOW });

    expect(lastUpdateData()).toMatchObject({
      status: "RETRYING",
      attempts: 1,
    });
    expect((lastUpdateData().nextRetryAt as Date).toISOString()).toBe("2026-01-01T12:02:00.000Z");
  });

  it("marks permanent 4xx as FAILED immediately", async () => {
    prismaMock.$queryRaw.mockResolvedValue([makeEvent()]);
    const client = makeClient({
      kind: "response",
      status: 400,
      retryAfterSeconds: null,
      externalEventId: null,
    });

    const summary = await dispatchPendingEvents({
      client,
      config: CONFIG,
      now: NOW,
    });

    expect(summary.failed).toBe(1);
    expect(lastUpdateData()).toMatchObject({
      status: "FAILED",
      attempts: 1,
      nextRetryAt: null,
    });
    expect(String(lastUpdateData().lastError)).toContain("HTTP 400");
  });

  it("stops after the fourth HTTP attempt", async () => {
    prismaMock.$queryRaw.mockResolvedValue([makeEvent({ attempts: 3 })]);
    const client = makeClient({
      kind: "response",
      status: 500,
      retryAfterSeconds: null,
      externalEventId: null,
    });

    await dispatchPendingEvents({ client, config: CONFIG, now: NOW });

    expect(lastUpdateData()).toMatchObject({
      status: "FAILED",
      attempts: 4,
      nextRetryAt: null,
    });
    expect(String(lastUpdateData().lastError)).toContain("Лимит");
  });

  it("fails expired events without making an HTTP call", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      makeEvent({ createdAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000) }),
    ]);
    const client = makeClient({
      kind: "response",
      status: 200,
      retryAfterSeconds: null,
      externalEventId: null,
    });

    const summary = await dispatchPendingEvents({
      client,
      config: CONFIG,
      now: NOW,
    });

    expect(summary.failed).toBe(1);
    expect(client.sendEvent).not.toHaveBeenCalled();
    expect(lastUpdateData()).toMatchObject({
      status: "FAILED",
      nextRetryAt: null,
    });
  });

  it("keeps events pending with a diagnostic error when n8n is not configured", async () => {
    prismaMock.$queryRaw.mockResolvedValue([makeEvent()]);

    const summary = await dispatchPendingEvents({
      client: null,
      config: null,
      now: NOW,
    });

    expect(summary.skipped).toBe(1);
    expect(lastUpdateData()).toMatchObject({
      status: "PENDING",
    });
    expect(String(lastUpdateData().lastError)).toContain("n8n не настроен");
    expect(prismaMock.integration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "NOT_CONFIGURED" }),
      }),
    );
  });

  it("does not resend an event that another dispatcher already claimed", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([makeEvent()]).mockResolvedValueOnce([]);
    const client = makeClient({
      kind: "response",
      status: 200,
      retryAfterSeconds: null,
      externalEventId: null,
    });

    const [first, second] = await Promise.all([
      dispatchPendingEvents({ client, config: CONFIG, now: NOW }),
      dispatchPendingEvents({ client, config: CONFIG, now: NOW }),
    ]);

    expect(first.claimed + second.claimed).toBe(1);
    expect(client.sendEvent).toHaveBeenCalledTimes(1);
  });

  it("clears the lease after a successful dispatch", async () => {
    prismaMock.$queryRaw.mockResolvedValue([makeEvent()]);
    const client = makeClient({
      kind: "response",
      status: 202,
      retryAfterSeconds: null,
      externalEventId: null,
    });

    await dispatchPendingEvents({ client, config: CONFIG, now: NOW });

    const where = prismaMock.automationEvent.updateMany.mock.calls[0]?.[0]?.where as Record<
      string,
      unknown
    >;

    expect(where.id).toBe(EVENT_ID);
    expect(typeof where.lockToken).toBe("string");
  });
});

describe("automation role checks", () => {
  it("forbids OPERATOR from listing events and reading status", async () => {
    await expect(listAutomationEvents(operatorUser, { page: 1, limit: 20 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(getAutomationStatus(operatorUser)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    expect(prismaMock.automationEvent.findMany).not.toHaveBeenCalled();
    expect(prismaMock.automationEvent.groupBy).not.toHaveBeenCalled();
  });

  it("allows MANAGER to list events with workspace scope", async () => {
    prismaMock.automationEvent.findMany.mockResolvedValue([makeEvent()]);
    prismaMock.automationEvent.count.mockResolvedValue(1);

    const result = await listAutomationEvents(managerUser, {
      page: 1,
      limit: 20,
      sort: "createdAt:desc",
    });

    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    const where = prismaMock.automationEvent.findMany.mock.calls[0]?.[0]?.where as Record<
      string,
      unknown
    >;
    expect(where.workspaceId).toBe("workspace-a");
  });

  it("builds full status counts and stale claims", async () => {
    process.env.N8N_WEBHOOK_URL = "http://n8n.test/webhook/lead-created";
    process.env.N8N_WEBHOOK_SECRET = "webhook-secret";

    prismaMock.automationEvent.groupBy.mockResolvedValue([
      { status: "PENDING", _count: { status: 1 } },
      { status: "DELIVERED", _count: { status: 2 } },
    ]);
    prismaMock.automationEvent.count.mockResolvedValue(3);
    prismaMock.automationEvent.findFirst.mockResolvedValue({ createdAt: NOW });
    prismaMock.integration.findMany.mockResolvedValue([
      { type: "n8n", status: "ACTIVE", lastCheckedAt: NOW },
      { type: "telegram", status: "ACTIVE", lastCheckedAt: NOW },
    ]);
    prismaMock.$queryRaw.mockResolvedValue([
      {
        idempotencyKey: "lead.created:stale",
        claimedAt: NOW,
        externalEventId: null,
        lastError: "timeout",
      },
    ]);

    const status = await getAutomationStatus(adminUser);

    expect(status.total).toBe(3);
    expect(status.counts).toMatchObject({
      PENDING: 1,
      DELIVERED: 2,
      SENT: 0,
      RETRYING: 0,
      FAILED: 0,
    });
    expect(status.n8n.integrationStatus).toBe("ACTIVE");
    expect(status.telegram.configured).toBe(true);
    expect(status.telegram.integrationStatus).toBe("ACTIVE");
    expect(status.staleClaims).toHaveLength(1);
  });
});

describe("retryAutomationEvent", () => {
  it("resets a FAILED event to RETRYING while preserving the idempotency key", async () => {
    prismaMock.automationEvent.findFirst
      .mockResolvedValueOnce({
        id: EVENT_ID,
        status: "FAILED",
        createdAt: NOW,
        idempotencyKey: "lead.created:lead-1",
      })
      .mockResolvedValueOnce(makeEvent({ status: "RETRYING", attempts: 0 }));

    const result = await retryAutomationEvent(adminUser, EVENT_ID, NOW);

    expect(result.status).toBe("RETRYING");
    expect(lastUpdateData()).toMatchObject({
      status: "RETRYING",
      attempts: 0,
      nextRetryAt: NOW,
      lastError: null,
      lockedAt: null,
      lockToken: null,
    });
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "automation.retry_requested",
          entityId: EVENT_ID,
        }),
      }),
    );
  });

  it("forbids OPERATOR and MANAGER is allowed", async () => {
    await expect(retryAutomationEvent(operatorUser, EVENT_ID)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(prismaMock.automationEvent.findFirst).not.toHaveBeenCalled();

    prismaMock.automationEvent.findFirst
      .mockResolvedValueOnce({
        id: EVENT_ID,
        status: "FAILED",
        createdAt: NOW,
        idempotencyKey: "lead.created:lead-1",
      })
      .mockResolvedValueOnce(makeEvent({ status: "RETRYING" }));

    await expect(retryAutomationEvent(managerUser, EVENT_ID, NOW)).resolves.toMatchObject({
      status: "RETRYING",
    });
  });

  it("rejects non-FAILED and older-than-24h events", async () => {
    prismaMock.automationEvent.findFirst.mockResolvedValueOnce({
      id: EVENT_ID,
      status: "SENT",
      createdAt: NOW,
      idempotencyKey: "lead.created:lead-1",
    });

    await expect(retryAutomationEvent(adminUser, EVENT_ID, NOW)).rejects.toMatchObject({
      code: "CONFLICT",
    });

    prismaMock.automationEvent.findFirst.mockResolvedValueOnce({
      id: EVENT_ID,
      status: "FAILED",
      createdAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000),
      idempotencyKey: "lead.created:lead-1",
    });

    await expect(retryAutomationEvent(adminUser, EVENT_ID, NOW)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});

describe("handleN8nCallback", () => {
  const basePayload = {
    idempotencyKey: "lead.created:lead-1",
    status: "delivered" as const,
    externalEventId: "tg-42",
  };

  it("marks SENT as DELIVERED and activates integrations", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      {
        id: EVENT_ID,
        workspaceId: "workspace-a",
        status: "SENT",
        externalEventId: null,
      },
    ]);

    const result = await handleN8nCallback(basePayload);

    expect(result).toEqual({
      eventId: EVENT_ID,
      status: "DELIVERED",
      duplicate: false,
    });
    expect(prismaMock.automationEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DELIVERED",
          externalEventId: "tg-42",
          lastError: null,
        }),
      }),
    );

    const integrationCalls = prismaMock.integration.updateMany.mock.calls.map(
      (call) => call[0] as { where: { type: string; workspaceId: string } },
    );
    expect(integrationCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          where: { workspaceId: "workspace-a", type: "telegram" },
        }),
        expect.objectContaining({
          where: { workspaceId: "workspace-a", type: "n8n" },
        }),
      ]),
    );
  });

  it("is idempotent for a repeated delivered callback", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      {
        id: EVENT_ID,
        workspaceId: "workspace-a",
        status: "DELIVERED",
        externalEventId: "tg-42",
      },
    ]);

    const result = await handleN8nCallback(basePayload);

    expect(result.duplicate).toBe(true);
    expect(prismaMock.automationEvent.update).not.toHaveBeenCalled();
    expect(prismaMock.activityLog.create).not.toHaveBeenCalled();
  });

  it("never downgrades DELIVERED to FAILED", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      {
        id: EVENT_ID,
        workspaceId: "workspace-a",
        status: "DELIVERED",
        externalEventId: "tg-42",
      },
    ]);

    const result = await handleN8nCallback({
      idempotencyKey: basePayload.idempotencyKey,
      status: "failed",
      error: "late failure",
    });

    expect(result).toEqual({
      eventId: EVENT_ID,
      status: "DELIVERED",
      duplicate: true,
    });
    expect(prismaMock.automationEvent.update).not.toHaveBeenCalled();
  });

  it("allows a manual retry to become DELIVERED after FAILED", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      {
        id: EVENT_ID,
        workspaceId: "workspace-a",
        status: "FAILED",
        externalEventId: null,
      },
    ]);

    const result = await handleN8nCallback(basePayload);

    expect(result.status).toBe("DELIVERED");
    expect(prismaMock.automationEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DELIVERED" }),
      }),
    );
  });

  it("uses the stored workspace and ignores a forged workspaceId", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      {
        id: EVENT_ID,
        workspaceId: "workspace-a",
        status: "SENT",
        externalEventId: null,
      },
    ]);

    await handleN8nCallback({
      ...basePayload,
      workspaceId: "workspace-evil",
    } as typeof basePayload & { workspaceId: string });

    const integrationCall = prismaMock.integration.updateMany.mock.calls[0]?.[0] as {
      where: { workspaceId: string };
    };
    expect(integrationCall.where.workspaceId).toBe("workspace-a");
  });

  it("redacts secrets from a failed callback error", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      {
        id: EVENT_ID,
        workspaceId: "workspace-a",
        status: "SENT",
        externalEventId: null,
      },
    ]);

    await handleN8nCallback({
      idempotencyKey: basePayload.idempotencyKey,
      status: "failed",
      error: "Telegram failed: bot123456:AAH-secret",
    });

    const data = prismaMock.automationEvent.update.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >;
    expect(data.status).toBe("FAILED");
    expect(String(data.lastError)).not.toContain("AAH-secret");
    expect(String(data.lastError)).toContain("[REDACTED]");
  });

  it("returns NOT_FOUND for an unknown idempotency key", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    await expect(handleN8nCallback(basePayload)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
