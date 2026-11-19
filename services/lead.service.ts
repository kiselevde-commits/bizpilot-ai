import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import {
  LEAD_STATUSES,
  PRIORITIES,
  LEAD_CATEGORIES,
  LEAD_INTENTS,
  CUSTOMER_TYPES,
} from "@/lib/constants";
import {
  parseSort,
  paginationQuerySchema,
  type PaginationQuery,
} from "@/lib/validation/query";
import type { Lead } from "@prisma/client";

const LEAD_SORT_ALLOW_LIST: readonly string[] = [
  "createdAt",
  "updatedAt",
  "title",
  "status",
  "priority",
  "leadScore",
];

export type LeadListQuery = PaginationQuery & {
  status?: string;
  priority?: string;
  assignedToId?: string;
  contactId?: string;
};

export type LeadListResult = {
  items: Lead[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function listLeads(
  user: SessionUser,
  query: LeadListQuery,
): Promise<LeadListResult> {
  const parsed = paginationQuerySchema.safeParse({
    page: query.page,
    limit: query.limit,
    search: query.search,
    sort: query.sort,
  });

  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Некорректные параметры запроса");
  }

  const { page, limit, search, sort } = parsed.data;
  const sortSpec = parseSort(
    sort,
    LEAD_SORT_ALLOW_LIST,
    { field: "createdAt", direction: "desc" },
  );

  const where: Prisma.LeadWhereInput = {
    workspaceId: user.workspaceId,
  };

  if (query.status && LEAD_STATUSES.includes(query.status as (typeof LEAD_STATUSES)[number])) {
    where.status = query.status as typeof where.status;
  }

  if (query.priority && PRIORITIES.includes(query.priority as (typeof PRIORITIES)[number])) {
    where.priority = query.priority as typeof where.priority;
  }

  if (query.assignedToId) {
    where.assignedToId = query.assignedToId;
  }

  if (query.contactId) {
    where.contactId = query.contactId;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { message: { contains: search, mode: "insensitive" } },
      { source: { contains: search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { [sortSpec.field]: sortSpec.direction },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        contact: { select: { id: true, name: true, email: true, phone: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit) || 0;

  return { items, pagination: { page, limit, total, totalPages } };
}

export async function getLead(
  user: SessionUser,
  id: string,
): Promise<Lead | null> {
  if (!id) {
    throw new AppError("VALIDATION_ERROR", "Не указан ID заявки");
  }

  return prisma.lead.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          company: true,
          email: true,
          phone: true,
          emailNormalized: true,
          phoneNormalized: true,
          status: true,
        },
      },
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      updatedBy: { select: { id: true, name: true, email: true } },
      tasks: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      },
      analyses: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          provider: true,
          model: true,
          resultJson: true,
          errorMessage: true,
          createdAt: true,
        },
      },
    },
  });
}

export type LeadCreateInput = {
  title: string;
  message: string;
  source?: string | null;
  status?: string;
  priority?: string;
  category?: string | null;
  intent?: string | null;
  customerType?: string | null;
  contactId?: string | null;
  assignedToId?: string | null;
};

export async function createLead(
  user: SessionUser,
  input: LeadCreateInput,
): Promise<Lead> {
  if (!input.title || input.title.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", "Название заявки обязательно");
  }

  if (input.title.length > 255) {
    throw new AppError("VALIDATION_ERROR", "Название слишком длинное");
  }

  if (!input.message || input.message.length === 0) {
    throw new AppError("VALIDATION_ERROR", "Текст заявки обязателен");
  }

  if (input.message.length > 20000) {
    throw new AppError("VALIDATION_ERROR", "Текст заявки слишком длинный");
  }

  if (input.source && input.source.length > 100) {
    throw new AppError("VALIDATION_ERROR", "Источник слишком длинный");
  }

  const status = input.status && LEAD_STATUSES.includes(input.status as (typeof LEAD_STATUSES)[number])
    ? (input.status as (typeof LEAD_STATUSES)[number])
    : "NEW";

  const priority = input.priority && PRIORITIES.includes(input.priority as (typeof PRIORITIES)[number])
    ? (input.priority as (typeof PRIORITIES)[number])
    : "MEDIUM";

  const category =
    input.category && LEAD_CATEGORIES.includes(input.category as (typeof LEAD_CATEGORIES)[number])
      ? (input.category as (typeof LEAD_CATEGORIES)[number] | null)
      : null;

  const intent =
    input.intent && LEAD_INTENTS.includes(input.intent as (typeof LEAD_INTENTS)[number])
      ? (input.intent as (typeof LEAD_INTENTS)[number] | null)
      : null;

  const customerType =
    input.customerType && CUSTOMER_TYPES.includes(input.customerType as (typeof CUSTOMER_TYPES)[number])
      ? (input.customerType as (typeof CUSTOMER_TYPES)[number] | null)
      : null;

  const lead = await prisma.$transaction(async (tx) => {
    const created = await tx.lead.create({
      data: {
        title: input.title.trim(),
        message: input.message,
        source: input.source || null,
        status,
        priority,
        category,
        intent,
        customerType,
        contactId: input.contactId || null,
        assignedToId: input.assignedToId || null,
        workspaceId: user.workspaceId,
        createdById: user.id,
        updatedById: user.id,
      },
    });

    await tx.activityLog.create({
      data: {
        workspaceId: user.workspaceId,
        entityType: "lead",
        entityId: created.id,
        action: "lead.created",
        actorId: user.id,
        metadata: { title: input.title.trim() },
      },
    });

    return created;
  });

  return lead;
}

export type LeadUpdateInput = Partial<
  Omit<LeadCreateInput, "title" | "message"> & { title?: string; message?: string }
>;

export async function updateLead(
  user: SessionUser,
  id: string,
  input: LeadUpdateInput,
): Promise<Lead> {
  const existing = await prisma.lead.findFirst({
    where: { id, workspaceId: user.workspaceId },
  });

  if (!existing) {
    throw new AppError("NOT_FOUND", "Заявка не найдена");
  }

  const status =
    input.status && LEAD_STATUSES.includes(input.status as (typeof LEAD_STATUSES)[number])
      ? (input.status as (typeof LEAD_STATUSES)[number])
      : existing.status;

  const priority =
    input.priority && PRIORITIES.includes(input.priority as (typeof PRIORITIES)[number])
      ? (input.priority as (typeof PRIORITIES)[number])
      : existing.priority;

  const category =
    input.category !== undefined
      ? input.category === null || LEAD_CATEGORIES.includes(input.category as (typeof LEAD_CATEGORIES)[number])
        ? (input.category as (typeof LEAD_CATEGORIES)[number] | null)
        : existing.category
      : existing.category;

  const intent =
    input.intent !== undefined
      ? input.intent === null || LEAD_INTENTS.includes(input.intent as (typeof LEAD_INTENTS)[number])
        ? (input.intent as (typeof LEAD_INTENTS)[number] | null)
        : existing.intent
      : existing.intent;

  const customerType =
    input.customerType !== undefined
      ? input.customerType === null ||
        CUSTOMER_TYPES.includes(input.customerType as (typeof CUSTOMER_TYPES)[number])
        ? (input.customerType as (typeof CUSTOMER_TYPES)[number] | null)
        : existing.customerType
      : existing.customerType;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.lead.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(input.message !== undefined && { message: input.message }),
        ...(input.source !== undefined && { source: input.source || null }),
        status,
        priority,
        category,
        intent,
        customerType,
        ...(input.contactId !== undefined && {
          contactId: input.contactId || null,
        }),
        ...(input.assignedToId !== undefined && {
          assignedToId: input.assignedToId || null,
        }),
        updatedById: user.id,
      },
      include: {
        contact: {
          select: { id: true, name: true, email: true, phone: true },
        },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    await tx.activityLog.create({
      data: {
        workspaceId: user.workspaceId,
        entityType: "lead",
        entityId: id,
        action: "lead.updated",
        actorId: user.id,
        metadata: { fields: Object.keys(input) },
      },
    });

    return updated;
  });
}

export async function deleteLead(
  user: SessionUser,
  id: string,
): Promise<void> {
  const existing = await prisma.lead.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: { tasks: true },
  });

  if (!existing) {
    throw new AppError("NOT_FOUND", "Заявка не найдена");
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: { leadId: id },
      data: { leadId: null },
    });

    await tx.activityLog.create({
      data: {
        workspaceId: user.workspaceId,
        entityType: "lead",
        entityId: id,
        action: "lead.deleted",
        actorId: user.id,
        metadata: { title: existing.title },
      },
    });

    await tx.lead.delete({ where: { id } });
  });
}

export async function getLeadStats(
  user: SessionUser,
): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}> {
  const [total, byStatusRows, byPriorityRows] = await Promise.all([
    prisma.lead.count({ where: { workspaceId: user.workspaceId } }),
    prisma.lead.groupBy({
      by: ["status"],
      where: { workspaceId: user.workspaceId },
      _count: { status: true },
    }),
    prisma.lead.groupBy({
      by: ["priority"],
      where: { workspaceId: user.workspaceId },
      _count: { priority: true },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of byStatusRows) {
    byStatus[row.status] = row._count.status;
  }

  const byPriority: Record<string, number> = {};
  for (const row of byPriorityRows) {
    byPriority[row.priority] = row._count.priority;
  }

  return { total, byStatus, byPriority };
}
