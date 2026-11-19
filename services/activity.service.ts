import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import {
  parseSort,
  paginationQuerySchema,
  type PaginationQuery,
} from "@/lib/validation/query";
import type { ActivityLog } from "@prisma/client";

const ACTIVITY_SORT_ALLOW_LIST: readonly string[] = ["createdAt"];

export type ActivityListQuery = PaginationQuery & {
  entityType?: string;
  entityId?: string;
};

export type ActivityListResult = {
  items: ActivityLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function listActivityLogs(
  user: SessionUser,
  query: ActivityListQuery,
): Promise<ActivityListResult> {
  const parsed = paginationQuerySchema.safeParse({
    page: query.page,
    limit: query.limit,
    search: query.search,
    sort: query.sort,
  });

  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Некорректные параметры запроса");
  }

  const { page, limit, sort } = parsed.data;
  const sortSpec = parseSort(
    sort,
    ACTIVITY_SORT_ALLOW_LIST,
    { field: "createdAt", direction: "desc" },
  );

  const where: Prisma.ActivityLogWhereInput = {
    workspaceId: user.workspaceId,
  };

  if (query.entityType) {
    where.entityType = query.entityType;
  }

  if (query.entityId) {
    where.entityId = query.entityId;
  }

  const [items, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { [sortSpec.field]: sortSpec.direction },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit) || 0;

  return { items, pagination: { page, limit, total, totalPages } };
}

export async function getActivityLogsForEntity(
  user: SessionUser,
  entityType: string,
  entityId: string,
): Promise<ActivityLog[]> {
  return prisma.activityLog.findMany({
    where: {
      workspaceId: user.workspaceId,
      entityType,
      entityId,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
  });
}
