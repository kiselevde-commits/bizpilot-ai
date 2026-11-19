import "server-only";
import { prisma } from "@/lib/database/prisma";
import type { SessionUser } from "@/lib/auth/session";

export type DashboardMetrics = {
  totalLeads: number;
  newLeads: number;
  inProgressLeads: number;
  convertedLeads: number;
  totalContacts: number;
  totalTasks: number;
  overdueTasks: number;
  conversionRate: number;
};

export type LeadByDay = { date: string; count: number };
export type LeadByStatus = { status: string; count: number };

export type DashboardData = {
  metrics: DashboardMetrics;
  leadsByDay: LeadByDay[];
  leadsByStatus: LeadByStatus[];
};

export async function getDashboardData(
  user: SessionUser,
): Promise<DashboardData> {
  const workspaceId = user.workspaceId;

  const [
    totalLeads,
    newLeads,
    inProgressLeads,
    convertedLeads,
    totalContacts,
    totalTasks,
    overdueTasks,
    leadsByDay,
    leadsByStatus,
  ] = await Promise.all([
    prisma.lead.count({ where: { workspaceId } }),
    prisma.lead.count({ where: { workspaceId, status: "NEW" } }),
    prisma.lead.count({ where: { workspaceId, status: "IN_PROGRESS" } }),
    prisma.lead.count({ where: { workspaceId, status: "CONVERTED" } }),
    prisma.contact.count({ where: { workspaceId } }),
    prisma.task.count({ where: { workspaceId } }),
    prisma.task.count({
      where: {
        workspaceId,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { lt: new Date() },
      },
    }),
    getLeadsByDay(workspaceId),
    prisma.lead.groupBy({
      by: ["status"],
      where: { workspaceId },
      _count: { status: true },
    }),
  ]);

  const conversionRate =
    totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  return {
    metrics: {
      totalLeads,
      newLeads,
      inProgressLeads,
      convertedLeads,
      totalContacts,
      totalTasks,
      overdueTasks,
      conversionRate,
    },
    leadsByDay,
    leadsByStatus: leadsByStatus.map((row) => ({
      status: String(row.status),
      count: row._count.status,
    })),
  };
}

async function getLeadsByDay(
  workspaceId: string,
): Promise<LeadByDay[]> {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 13);
  startDate.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
    SELECT to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date, count(*)::bigint AS count
    FROM "Lead"
    WHERE "workspaceId" = ${workspaceId} AND "createdAt" >= ${startDate}
    GROUP BY date
    ORDER BY date ASC
  `;

  const byDate = new Map<string, number>();
  for (const row of rows) {
    byDate.set(row.date, Number(row.count));
  }

  const result: LeadByDay[] = [];
  const current = new Date(startDate);

  for (let i = 0; i < 14; i++) {
    const dateKey = current.toISOString().split("T")[0] ?? "";
    result.push({ date: dateKey, count: byDate.get(dateKey) ?? 0 });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

export async function hasDemoData(user: SessionUser): Promise<boolean> {
  const count = await prisma.lead.count({
    where: { workspaceId: user.workspaceId, title: { startsWith: "[DEMO]" } },
  });
  return count > 0;
}
