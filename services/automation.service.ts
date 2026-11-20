import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma, type AutomationEventStatus, type IntegrationStatus } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { AUTOMATION_ROLES } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";
import { AUTOMATION_EVENT_STATUSES } from "@/lib/constants";
import { parseSort } from "@/lib/validation/query";
import {
  automationEventIdSchema,
  automationListQuerySchema,
  type N8nCallbackPayload,
} from "@/lib/validation/automation";
import {
  HttpN8nClient,
  getN8nCallbackSecret,
  getN8nDispatchConfig,
  isTelegramConfigured,
  type N8nClient,
  type N8nDispatchConfig,
} from "@/lib/integrations/n8n";
import {
  LEASE_DURATION_MS,
  MAX_AUTOMATIC_ATTEMPTS,
  MAX_DISPATCH_BATCH,
  STALE_CLAIM_MS,
  classifyHttpStatus,
  isEventExpired,
  nextRetryAt,
  wouldExceedMaxAge,
} from "@/lib/integrations/retry";
import { sanitizeExternalError } from "@/lib/security/sanitize";

const EVENT_SORT_ALLOW_LIST = ["createdAt", "updatedAt", "status", "attempts"] as const;

type EventSortField = (typeof EVENT_SORT_ALLOW_LIST)[number];

const EVENT_SELECT = {
  id: true,
  eventType: true,
  entityId: true,
  payload: true,
  status: true,
  idempotencyKey: true,
  externalEventId: true,
  attempts: true,
  lastError: true,
  nextRetryAt: true,
  lockedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AutomationEventSelect;

export type AutomationEventDto = Prisma.AutomationEventGetPayload<{
  select: typeof EVENT_SELECT;
}>;

type ClaimedEvent = AutomationEventDto & { workspaceId: string };

export type AutomationEventListResult = {
  items: AutomationEventDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type StaleClaimDto = {
  idempotencyKey: string;
  claimedAt: Date;
  externalEventId: string | null;
  lastError: string | null;
};

export type AutomationStatusResult = {
  n8n: {
    configured: boolean;
    callbackConfigured: boolean;
    integrationStatus: IntegrationStatus | null;
    lastCheckedAt: Date | null;
  };
  telegram: {
    configured: boolean;
    integrationStatus: IntegrationStatus | null;
    lastCheckedAt: Date | null;
  };
  counts: Record<AutomationEventStatus, number>;
  total: number;
  lastEventAt: Date | null;
  staleClaims: StaleClaimDto[];
  policy: {
    maxBatch: number;
    leaseMinutes: number;
    staleClaimMinutes: number;
    maxAutomaticAttempts: number;
    maxAgeHours: number;
  };
};

export type DispatchSummary = {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  skipped: number;
};

export type DispatchOptions = {
  limit?: number;
  eventId?: string;
  /** Optional scope for callers that dispatch a single workspace (tests, jobs). */
  workspaceId?: string;
  now?: Date;
  client?: N8nClient | null;
  config?: N8nDispatchConfig | null;
};

type ProcessOutcome = "sent" | "retried" | "failed" | "skipped";

function requireAutomationRole(user: SessionUser): void {
  if (!(AUTOMATION_ROLES as readonly string[]).includes(user.role)) {
    throw new AppError("FORBIDDEN", "Insufficient permissions");
  }
}

function parseEventId(id: string): string {
  const parsed = automationEventIdSchema.safeParse(id);

  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Некорректный идентификатор события");
  }

  return parsed.data;
}

function asPayloadRecord(value: Prisma.JsonValue): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function logDispatcherError(message: string, details: Record<string, unknown>): void {
  // Never include payload, lead message or contact data here.
  console.error(message, details);
}

export async function listAutomationEvents(
  user: SessionUser,
  query: { page?: number; limit?: number; status?: string; sort?: string },
): Promise<AutomationEventListResult> {
  requireAutomationRole(user);

  const parsed = automationListQuerySchema.safeParse({
    page: query.page,
    limit: query.limit,
    status: query.status,
    sort: query.sort,
  });

  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Некорректные параметры запроса");
  }

  const { page, limit, status, sort } = parsed.data;
  const sortSpec = parseSort<EventSortField>(sort, EVENT_SORT_ALLOW_LIST, {
    field: "createdAt",
    direction: "desc",
  });

  const where: Prisma.AutomationEventWhereInput = {
    workspaceId: user.workspaceId,
    ...(status ? { status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.automationEvent.findMany({
      where,
      select: EVENT_SELECT,
      orderBy: { [sortSpec.field]: sortSpec.direction },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.automationEvent.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
}

export async function getAutomationEvent(
  user: SessionUser,
  id: string,
): Promise<AutomationEventDto> {
  requireAutomationRole(user);

  const eventId = parseEventId(id);
  const event = await prisma.automationEvent.findFirst({
    where: { id: eventId, workspaceId: user.workspaceId },
    select: EVENT_SELECT,
  });

  if (!event) {
    throw new AppError("NOT_FOUND", "Событие автоматизации не найдено");
  }

  return event;
}

export async function getAutomationStatus(user: SessionUser): Promise<AutomationStatusResult> {
  requireAutomationRole(user);

  const staleCutoff = new Date(Date.now() - STALE_CLAIM_MS);

  const [grouped, total, lastEvent, integrations, staleClaims] = await Promise.all([
    prisma.automationEvent.groupBy({
      by: ["status"],
      where: { workspaceId: user.workspaceId },
      _count: { status: true },
    }),
    prisma.automationEvent.count({ where: { workspaceId: user.workspaceId } }),
    prisma.automationEvent.findFirst({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.integration.findMany({
      where: { workspaceId: user.workspaceId },
      select: { type: true, status: true, lastCheckedAt: true },
    }),
    prisma.$queryRaw<StaleClaimDto[]>(Prisma.sql`
      SELECT
        processed."idempotency_key" AS "idempotencyKey",
        processed."claimed_at" AS "claimedAt",
        processed."external_event_id" AS "externalEventId",
        processed."last_error" AS "lastError"
      FROM "n8n_processed" AS processed
      WHERE processed."status" = 'CLAIMED'
        AND processed."claimed_at" < ${staleCutoff}
        AND EXISTS (
          SELECT 1
          FROM "AutomationEvent" AS event
          WHERE event."idempotencyKey" = processed."idempotency_key"
            AND event."workspaceId" = ${user.workspaceId}
        )
      ORDER BY processed."claimed_at" ASC
      LIMIT 20
    `),
  ]);

  const counts = Object.fromEntries(
    AUTOMATION_EVENT_STATUSES.map((status) => [status, 0]),
  ) as Record<AutomationEventStatus, number>;

  for (const row of grouped) {
    counts[row.status] = row._count.status;
  }

  const n8nIntegration = integrations.find((row) => row.type === "n8n") ?? null;
  const telegramIntegration = integrations.find((row) => row.type === "telegram") ?? null;
  const n8nConfigured = getN8nDispatchConfig() !== null;
  const telegramIntegrationStatus = telegramIntegration?.status ?? null;
  // The app doesn't send Telegram messages; a successful/failed callback is the
  // only reliable proof that n8n's Telegram credential works.
  const telegramConfigured =
    isTelegramConfigured() ||
    telegramIntegrationStatus === "ACTIVE" ||
    telegramIntegrationStatus === "ERROR";

  return {
    n8n: {
      configured: n8nConfigured,
      callbackConfigured: getN8nCallbackSecret() !== null,
      integrationStatus: n8nConfigured ? (n8nIntegration?.status ?? null) : "NOT_CONFIGURED",
      lastCheckedAt: n8nIntegration?.lastCheckedAt ?? null,
    },
    telegram: {
      configured: telegramConfigured,
      integrationStatus: telegramConfigured
        ? (telegramIntegrationStatus ?? "NOT_CONFIGURED")
        : "NOT_CONFIGURED",
      lastCheckedAt: telegramIntegration?.lastCheckedAt ?? null,
    },
    counts,
    total,
    lastEventAt: lastEvent?.createdAt ?? null,
    staleClaims,
    policy: {
      maxBatch: MAX_DISPATCH_BATCH,
      leaseMinutes: LEASE_DURATION_MS / 60_000,
      staleClaimMinutes: STALE_CLAIM_MS / 60_000,
      maxAutomaticAttempts: MAX_AUTOMATIC_ATTEMPTS,
      maxAgeHours: 24,
    },
  };
}

/**
 * Atomically claims up to `limit` due events using a PostgreSQL lease.
 *
 * `FOR UPDATE SKIP LOCKED` makes concurrent dispatchers safe. A lease left by a
 * crashed process becomes claimable again after LEASE_DURATION_MS; there is no
 * in-memory lock anywhere in this path.
 */
async function claimEvents(
  limit: number,
  now: Date,
  lockToken: string,
  eventId?: string,
  workspaceId?: string,
): Promise<ClaimedEvent[]> {
  const leaseCutoff = new Date(now.getTime() - LEASE_DURATION_MS);
  const eventFilter = eventId ? Prisma.sql`AND "id" = ${eventId}` : Prisma.empty;
  const workspaceFilter = workspaceId
    ? Prisma.sql`AND "workspaceId" = ${workspaceId}`
    : Prisma.empty;

  return prisma.$queryRaw<ClaimedEvent[]>(Prisma.sql`
    WITH candidates AS (
      SELECT "id"
      FROM "AutomationEvent"
      WHERE "status" IN (
        'PENDING'::"AutomationEventStatus",
        'RETRYING'::"AutomationEventStatus"
      )
        AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= (${now} AT TIME ZONE 'UTC'))
        AND ("lockedAt" IS NULL OR "lockedAt" < (${leaseCutoff} AT TIME ZONE 'UTC'))
        ${eventFilter}
        ${workspaceFilter}
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "AutomationEvent" AS event
    SET
      "lockedAt" = (${now} AT TIME ZONE 'UTC'),
      "lockToken" = ${lockToken},
      "updatedAt" = (${now} AT TIME ZONE 'UTC')
    FROM candidates
    WHERE event."id" = candidates."id"
    RETURNING event.*
  `);
}

async function finishEvent(
  eventId: string,
  lockToken: string,
  data: Prisma.AutomationEventUpdateManyMutationInput,
): Promise<boolean> {
  const result = await prisma.automationEvent.updateMany({
    where: { id: eventId, lockToken },
    data: {
      ...data,
      lockedAt: null,
      lockToken: null,
    },
  });

  if (result.count === 0) {
    logDispatcherError("Automation lease was lost before status update", {
      eventId,
    });
    return false;
  }

  return true;
}

async function setIntegrationStatus(
  workspaceId: string,
  type: "n8n" | "telegram",
  status: IntegrationStatus,
  checked: boolean,
): Promise<void> {
  try {
    await prisma.integration.updateMany({
      where: { workspaceId, type },
      data: {
        status,
        ...(checked ? { lastCheckedAt: new Date() } : {}),
      },
    });
  } catch (error) {
    logDispatcherError("Failed to update integration status", {
      type,
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

async function recordTransientFailure(
  event: ClaimedEvent,
  lockToken: string,
  now: Date,
  attempts: number,
  baseError: string,
  retryAfterSeconds: number | null = null,
): Promise<ProcessOutcome> {
  const retryAt = nextRetryAt(now, attempts, retryAfterSeconds);
  const expired = wouldExceedMaxAge(event.createdAt, retryAt);
  const sanitized = sanitizeExternalError(baseError) ?? "Ошибка доставки в n8n";

  if (!retryAt) {
    await finishEvent(event.id, lockToken, {
      status: "FAILED",
      attempts,
      lastError: `${sanitized} Лимит автоматических попыток исчерпан.`,
      nextRetryAt: null,
    });

    return "failed";
  }

  if (expired) {
    await finishEvent(event.id, lockToken, {
      status: "FAILED",
      attempts,
      lastError: `${sanitized} Истёк 24-часовой лимит автоматической доставки.`,
      nextRetryAt: null,
    });

    return "failed";
  }

  await finishEvent(event.id, lockToken, {
    status: "RETRYING",
    attempts,
    lastError: sanitized,
    nextRetryAt: retryAt,
  });

  return "retried";
}

async function processClaimedEvent(
  event: ClaimedEvent,
  lockToken: string,
  options: {
    now: Date;
    config: N8nDispatchConfig | null;
    client: N8nClient | null;
  },
): Promise<ProcessOutcome> {
  const { now, config, client } = options;

  if (!config || !client) {
    await finishEvent(event.id, lockToken, {
      status: event.status,
      lastError: "n8n не настроен: событие ожидает настройки интеграции",
      nextRetryAt: new Date(now.getTime() + 60_000),
    });
    await setIntegrationStatus(event.workspaceId, "n8n", "NOT_CONFIGURED", false);

    return "skipped";
  }

  if (isEventExpired(event.createdAt, now)) {
    await finishEvent(event.id, lockToken, {
      status: "FAILED",
      lastError: "Событие старше 24 часов: автоматическая отправка остановлена",
      nextRetryAt: null,
    });

    return "failed";
  }

  const result = await client.sendEvent({
    eventId: event.id,
    idempotencyKey: event.idempotencyKey,
    eventType: event.eventType,
    occurredAt: event.createdAt.toISOString(),
    payload: asPayloadRecord(event.payload),
  });

  const attempts = event.attempts + 1;

  if (result.kind === "network_error") {
    const outcome = await recordTransientFailure(
      event,
      lockToken,
      now,
      attempts,
      "Сетевая ошибка при вызове n8n.",
    );
    await setIntegrationStatus(event.workspaceId, "n8n", "ERROR", true);

    return outcome;
  }

  if (result.kind === "timeout") {
    const outcome = await recordTransientFailure(
      event,
      lockToken,
      now,
      attempts,
      "Таймаут при вызове n8n.",
    );
    await setIntegrationStatus(event.workspaceId, "n8n", "ERROR", true);

    return outcome;
  }

  const classification = classifyHttpStatus(result.status);

  if (classification === "success") {
    await finishEvent(event.id, lockToken, {
      status: "SENT",
      attempts,
      lastError: null,
      nextRetryAt: null,
      externalEventId: result.externalEventId,
    });
    await setIntegrationStatus(event.workspaceId, "n8n", "ACTIVE", true);

    return "sent";
  }

  if (classification === "retry") {
    const reason =
      result.status === 429
        ? "n8n вернул HTTP 429 (rate limit)."
        : `n8n вернул временную ошибку HTTP ${result.status}.`;
    const outcome = await recordTransientFailure(
      event,
      lockToken,
      now,
      attempts,
      reason,
      result.retryAfterSeconds,
    );
    await setIntegrationStatus(event.workspaceId, "n8n", "ERROR", true);

    return outcome;
  }

  await finishEvent(event.id, lockToken, {
    status: "FAILED",
    attempts,
    lastError: `n8n отклонил событие: HTTP ${result.status}.`,
    nextRetryAt: null,
  });
  await setIntegrationStatus(event.workspaceId, "n8n", "ERROR", true);

  return "failed";
}

/**
 * Best-effort outbox dispatcher. Reliability is provided by PostgreSQL rows and
 * leases, not by this promise. Callers may fire-and-forget it.
 */
export async function dispatchPendingEvents(
  options: DispatchOptions = {},
): Promise<DispatchSummary> {
  const limit = Math.min(
    Math.max(1, Math.trunc(options.limit ?? MAX_DISPATCH_BATCH)),
    MAX_DISPATCH_BATCH,
  );
  const now = options.now ?? new Date();
  const config = options.config !== undefined ? options.config : getN8nDispatchConfig();
  const client =
    options.client !== undefined ? options.client : config ? new HttpN8nClient(config) : null;
  const lockToken = randomUUID();
  const claimed = await claimEvents(limit, now, lockToken, options.eventId, options.workspaceId);

  const summary: DispatchSummary = {
    claimed: claimed.length,
    sent: 0,
    retried: 0,
    failed: 0,
    skipped: 0,
  };

  for (const event of claimed) {
    try {
      const outcome = await processClaimedEvent(event, lockToken, {
        now,
        config,
        client,
      });
      summary[outcome] += 1;
    } catch (error) {
      logDispatcherError("Automation event processing crashed", {
        eventId: event.id,
        name: error instanceof Error ? error.name : "UnknownError",
      });

      try {
        await finishEvent(event.id, lockToken, {
          status: event.status === "PENDING" ? "PENDING" : "RETRYING",
          lastError: "Внутренняя ошибка dispatcher. Событие будет повторено.",
          nextRetryAt: new Date(now.getTime() + 60_000),
        });
      } catch (releaseError) {
        logDispatcherError("Failed to release automation lease", {
          eventId: event.id,
          name: releaseError instanceof Error ? releaseError.name : "UnknownError",
        });
      }

      summary.retried += 1;
    }
  }

  return summary;
}

/** Fire-and-forget invocation used after commit, on Dashboard and automation API. */
export function queueAutomationDispatch(): void {
  void dispatchPendingEvents({ limit: MAX_DISPATCH_BATCH }).catch((error) => {
    logDispatcherError("Automation dispatcher invocation failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  });
}

export async function retryAutomationEvent(
  user: SessionUser,
  id: string,
  now: Date = new Date(),
): Promise<AutomationEventDto> {
  requireAutomationRole(user);

  const eventId = parseEventId(id);
  const event = await prisma.automationEvent.findFirst({
    where: { id: eventId, workspaceId: user.workspaceId },
    select: { id: true, status: true, createdAt: true, idempotencyKey: true },
  });

  if (!event) {
    throw new AppError("NOT_FOUND", "Событие автоматизации не найдено");
  }

  if (event.status !== "FAILED") {
    throw new AppError("CONFLICT", "Ручной повтор доступен только для событий в статусе FAILED");
  }

  if (isEventExpired(event.createdAt, now)) {
    throw new AppError("CONFLICT", "Событие старше 24 часов: ручной повтор запрещён");
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.automationEvent.updateMany({
      where: {
        id: event.id,
        workspaceId: user.workspaceId,
        status: "FAILED",
      },
      data: {
        status: "RETRYING",
        attempts: 0,
        nextRetryAt: now,
        lastError: null,
        lockedAt: null,
        lockToken: null,
      },
    });

    if (updated.count === 0) {
      throw new AppError("CONFLICT", "Событие уже обрабатывается или изменило статус");
    }

    await tx.activityLog.create({
      data: {
        workspaceId: user.workspaceId,
        entityType: "automation",
        entityId: event.id,
        action: "automation.retry_requested",
        actorId: user.id,
        // The idempotency key is not a secret; it is the stable delivery key.
        metadata: { idempotencyKey: event.idempotencyKey },
      },
    });
  });

  const updated = await prisma.automationEvent.findFirst({
    where: { id: event.id, workspaceId: user.workspaceId },
    select: EVENT_SELECT,
  });

  if (!updated) {
    throw new AppError("NOT_FOUND", "Событие автоматизации не найдено");
  }

  return updated;
}

export type N8nCallbackResult = {
  eventId: string;
  status: "DELIVERED" | "FAILED";
  duplicate: boolean;
};

/**
 * Processes a signed n8n callback idempotently.
 *
 * The workspace is derived from the stored AutomationEvent; any workspaceId sent
 * by n8n is ignored. A delivered callback is never downgraded by a late failure.
 */
export async function handleN8nCallback(payload: N8nCallbackPayload): Promise<N8nCallbackResult> {
  const targetStatus = payload.status === "delivered" ? "DELIVERED" : "FAILED";
  const safeError =
    targetStatus === "FAILED"
      ? (sanitizeExternalError(payload.error) ?? "n8n сообщил об ошибке доставки уведомления")
      : null;

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        workspaceId: string;
        status: AutomationEventStatus;
        externalEventId: string | null;
      }>
    >(Prisma.sql`
      SELECT "id", "workspaceId", "status", "externalEventId"
      FROM "AutomationEvent"
      WHERE "idempotencyKey" = ${payload.idempotencyKey}
      FOR UPDATE
    `);

    const event = rows[0];

    if (!event) {
      throw new AppError("NOT_FOUND", "Событие автоматизации не найдено");
    }

    if (event.status === targetStatus) {
      return { eventId: event.id, status: targetStatus, duplicate: true };
    }

    // Never downgrade a confirmed delivery because a late failure callback arrived.
    if (event.status === "DELIVERED" && targetStatus === "FAILED") {
      return { eventId: event.id, status: "DELIVERED", duplicate: true };
    }

    const now = new Date();

    await tx.automationEvent.update({
      where: { id: event.id },
      data: {
        status: targetStatus,
        externalEventId: payload.externalEventId ?? event.externalEventId,
        lastError: targetStatus === "FAILED" ? safeError : null,
        nextRetryAt: null,
        lockedAt: null,
        lockToken: null,
      },
    });

    await tx.integration.updateMany({
      where: { workspaceId: event.workspaceId, type: "telegram" },
      data: {
        status: targetStatus === "DELIVERED" ? "ACTIVE" : "ERROR",
        lastCheckedAt: now,
      },
    });

    // A valid callback is proof that n8n processed the event.
    await tx.integration.updateMany({
      where: { workspaceId: event.workspaceId, type: "n8n" },
      data: { status: "ACTIVE", lastCheckedAt: now },
    });

    await tx.activityLog.create({
      data: {
        workspaceId: event.workspaceId,
        entityType: "automation",
        entityId: event.id,
        action: targetStatus === "DELIVERED" ? "automation.delivered" : "automation.failed",
        actorId: null,
        metadata: { idempotencyKey: payload.idempotencyKey },
      },
    });

    return {
      eventId: event.id,
      status: targetStatus,
      duplicate: false,
    };
  });
}
