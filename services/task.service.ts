import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import {
  PRIORITIES,
  TASK_STATUSES,
} from "@/lib/constants";
import {
  parseSort,
  paginationQuerySchema,
  type PaginationQuery,
} from "@/lib/validation/query";
import { assertTaskRelationsInWorkspace } from "@/services/workspace-relations.service";
import type { Task } from "@prisma/client";

const TASK_SORT_ALLOW_LIST: readonly string[] = [
  "createdAt",
  "updatedAt",
  "title",
  "status",
  "priority",
  "dueDate",
];

export type TaskListQuery = PaginationQuery & {
  status?: string;
  priority?: string;
  assignedToId?: string;
  leadId?: string;
  contactId?: string;
  overdue?: boolean;
};

export type TaskListResult = {
  items: Task[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function listTasks(
  user: SessionUser,
  query: TaskListQuery,
): Promise<TaskListResult> {
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
    TASK_SORT_ALLOW_LIST,
    { field: "createdAt", direction: "desc" },
  );

  const where: Prisma.TaskWhereInput = {
    workspaceId: user.workspaceId,
  };

  if (query.status && TASK_STATUSES.includes(query.status as (typeof TASK_STATUSES)[number])) {
    where.status = query.status as typeof where.status;
  }

  if (query.priority && PRIORITIES.includes(query.priority as (typeof PRIORITIES)[number])) {
    where.priority = query.priority as typeof where.priority;
  }

  if (query.assignedToId) {
    where.assignedToId = query.assignedToId;
  }

  if (query.leadId) {
    where.leadId = query.leadId;
  }

  if (query.contactId) {
    where.contactId = query.contactId;
  }

  if (query.overdue === true) {
    where.status = { in: ["TODO", "IN_PROGRESS"] };
    where.dueDate = { lt: new Date() };
  } else if (query.overdue === false) {
    const now = new Date();
    where.OR = [
      { status: { notIn: ["TODO", "IN_PROGRESS"] } },
      { dueDate: null },
      { dueDate: { gte: now } },
    ];
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: { [sortSpec.field]: sortSpec.direction },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        lead: { select: { id: true, title: true, status: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit) || 0;

  return { items, pagination: { page, limit, total, totalPages } };
}

export async function getTask(
  user: SessionUser,
  id: string,
): Promise<Task | null> {
  if (!id) {
    throw new AppError("VALIDATION_ERROR", "Не указан ID задачи");
  }

  return prisma.task.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: {
      lead: { select: { id: true, title: true, status: true, priority: true } },
      contact: {
        select: { id: true, name: true, email: true, phone: true, status: true },
      },
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      updatedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export type TaskCreateInput = {
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  assignedToId?: string | null;
  leadId?: string | null;
  contactId?: string | null;
};

export async function createTask(
  user: SessionUser,
  input: TaskCreateInput,
): Promise<Task> {
  if (!input.title || input.title.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", "Название задачи обязательно");
  }

  if (input.title.length > 255) {
    throw new AppError("VALIDATION_ERROR", "Название слишком длинное");
  }

  const status =
    input.status && TASK_STATUSES.includes(input.status as (typeof TASK_STATUSES)[number])
      ? (input.status as (typeof TASK_STATUSES)[number])
      : "TODO";

  const priority =
    input.priority && PRIORITIES.includes(input.priority as (typeof PRIORITIES)[number])
      ? (input.priority as (typeof PRIORITIES)[number])
      : "MEDIUM";

  const dueDate = input.dueDate ? new Date(input.dueDate) : null;

  if (dueDate && isNaN(dueDate.getTime())) {
    throw new AppError("VALIDATION_ERROR", "Некорректная дата выполнения");
  }

  return prisma.$transaction(async (tx) => {
    await assertTaskRelationsInWorkspace(tx, user.workspaceId, input);

    const created = await tx.task.create({
      data: {
        title: input.title.trim(),
        description: input.description || null,
        status,
        priority,
        dueDate,
        assignedToId: input.assignedToId || null,
        leadId: input.leadId || null,
        contactId: input.contactId || null,
        workspaceId: user.workspaceId,
        createdById: user.id,
        updatedById: user.id,
      },
      include: {
        lead: { select: { id: true, title: true, status: true } },
        contact: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    await tx.activityLog.create({
      data: {
        workspaceId: user.workspaceId,
        entityType: "task",
        entityId: created.id,
        action: "task.created",
        actorId: user.id,
        metadata: { title: input.title.trim() },
      },
    });

    return created;
  });
}

export type TaskUpdateInput = Partial<TaskCreateInput>;

export async function updateTask(
  user: SessionUser,
  id: string,
  input: TaskUpdateInput,
): Promise<Task> {
  const existing = await prisma.task.findFirst({
    where: { id, workspaceId: user.workspaceId },
  });

  if (!existing) {
    throw new AppError("NOT_FOUND", "Задача не найдена");
  }

  const status =
    input.status !== undefined
      ? TASK_STATUSES.includes(input.status as (typeof TASK_STATUSES)[number])
        ? (input.status as (typeof TASK_STATUSES)[number])
        : existing.status
      : existing.status;

  const priority =
    input.priority !== undefined
      ? PRIORITIES.includes(input.priority as (typeof PRIORITIES)[number])
        ? (input.priority as (typeof PRIORITIES)[number])
        : existing.priority
      : existing.priority;

  const dueDate =
    input.dueDate !== undefined
      ? input.dueDate === null || input.dueDate === ""
        ? null
        : new Date(input.dueDate)
      : existing.dueDate;

  if (dueDate && isNaN(dueDate.getTime())) {
    throw new AppError("VALIDATION_ERROR", "Некорректная дата выполнения");
  }

  return prisma.$transaction(async (tx) => {
    await assertTaskRelationsInWorkspace(tx, user.workspaceId, input);

    const updated = await tx.task.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(input.description !== undefined && {
          description: input.description || null,
        }),
        ...(input.status !== undefined && { status }),
        ...(input.priority !== undefined && { priority }),
        ...(input.dueDate !== undefined && { dueDate }),
        ...(input.assignedToId !== undefined && {
          assignedToId: input.assignedToId || null,
        }),
        ...(input.leadId !== undefined && { leadId: input.leadId || null }),
        ...(input.contactId !== undefined && {
          contactId: input.contactId || null,
        }),
        updatedById: user.id,
      },
      include: {
        lead: { select: { id: true, title: true, status: true } },
        contact: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    await tx.activityLog.create({
      data: {
        workspaceId: user.workspaceId,
        entityType: "task",
        entityId: id,
        action: "task.updated",
        actorId: user.id,
        metadata: { fields: Object.keys(input) },
      },
    });

    return updated;
  });
}

export async function deleteTask(
  user: SessionUser,
  id: string,
): Promise<void> {
  const existing = await prisma.task.findFirst({
    where: { id, workspaceId: user.workspaceId },
  });

  if (!existing) {
    throw new AppError("NOT_FOUND", "Задача не найдена");
  }

  await prisma.$transaction(async (tx) => {
    await tx.activityLog.create({
      data: {
        workspaceId: user.workspaceId,
        entityType: "task",
        entityId: id,
        action: "task.deleted",
        actorId: user.id,
        metadata: { title: existing.title },
      },
    });

    await tx.task.delete({ where: { id } });
  });
}

export async function getTaskStats(
  user: SessionUser,
): Promise<{
  total: number;
  overdue: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}> {
  const now = new Date();

  const [total, overdue, byStatusRows, byPriorityRows] = await Promise.all([
    prisma.task.count({ where: { workspaceId: user.workspaceId } }),
    prisma.task.count({
      where: {
        workspaceId: user.workspaceId,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { lt: now },
      },
    }),
    prisma.task.groupBy({
      by: ["status"],
      where: { workspaceId: user.workspaceId },
      _count: { status: true },
    }),
    prisma.task.groupBy({
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

  return { total, overdue, byStatus, byPriority };
}
