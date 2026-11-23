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

export type DashboardLeadPreview = {
  id: string;
  title: string;
  status: string;
  priority: string;
  leadScore: number | null;
  createdAt: Date;
  contact: { name: string } | null;
};

export type DashboardTaskPreview = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  assignedTo: { name: string } | null;
};

export type DashboardData = {
  metrics: DashboardMetrics;
  leadsByDay: LeadByDay[];
  leadsByStatus: LeadByStatus[];
  priorityLeads: DashboardLeadPreview[];
  attentionTasks: DashboardTaskPreview[];
};

export async function getDashboardData(user: SessionUser): Promise<DashboardData> {
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
    priorityLeads,
    attentionTasks,
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
    // Read-only previews for the executive dashboard. Metrics above stay the
    // single source of truth for KPI values.
    prisma.lead.findMany({
      where: {
        workspaceId,
        status: { notIn: ["CONVERTED", "REJECTED"] },
        priority: { in: ["HIGH", "URGENT"] },
      },
      // Product order stays `priority DESC, createdAt DESC`. The final `id`
      // tie-break only makes rows with identical keys deterministic across
      // requests (and therefore testable) without changing the product rule.
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        leadScore: true,
        createdAt: true,
        // Relations are filtered on read: a legacy cross-Workspace link must
        // never surface a foreign Contact in this Workspace.
        contact: {
          where: { workspaceId },
          select: { name: true },
        },
      },
    }),
    // The Dashboard attention block must surface overdue HIGH/URGENT tasks
    // first, followed by the nearest upcoming tasks. DONE/CANCELLED tasks are
    // excluded, but there is no upper due-date cutoff: an overdue task must not
    // disappear from the preview merely because it is late.
    prisma.task.findMany({
      where: {
        workspaceId,
        status: { in: ["TODO", "IN_PROGRESS"] },
        priority: { in: ["HIGH", "URGENT"] },
        dueDate: { not: null },
      },
      // Due-date order already puts overdue tasks first (earlier dates), then
      // the nearest upcoming tasks. Priority and `createdAt`/`id` tie-breaks
      // keep the preview deterministic for identical due dates.
      orderBy: [
        { dueDate: "asc" },
        { priority: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        // Same read-time guard for a legacy foreign assignee.
        assignedTo: {
          where: { workspaceId },
          select: { name: true },
        },
      },
    }),
  ]);

  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

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
    priorityLeads,
    attentionTasks,
  };
}

function utcDateString(value: Date): string {
  const year = value.getUTCFullYear().toString().padStart(4, "0");
  const month = (value.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = value.getUTCDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function getLeadsByDay(workspaceId: string): Promise<LeadByDay[]> {
  const now = new Date();
  const windowStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 13),
  );
  const endDateExclusive = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );

  // `createdAt` is `timestamp without time zone` and Prisma stores the UTC wall
  // clock there. Build both bounds explicitly as `timestamp without time zone`
  // with make_timestamp(year, month, day, ...) so the comparison does not depend
  // on the PostgreSQL session TimeZone and does not rely on an implicit
  // timestamptz/date cast. Formatting `createdAt` directly is therefore UTC
  // grouping, not session-timezone grouping.
  const windowStartYear = windowStart.getUTCFullYear();
  const windowStartMonth = windowStart.getUTCMonth() + 1;
  const windowStartDay = windowStart.getUTCDate();
  const endYear = endDateExclusive.getUTCFullYear();
  const endMonth = endDateExclusive.getUTCMonth() + 1;
  const endDay = endDateExclusive.getUTCDate();

  const rows = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
    SELECT to_char("createdAt", 'YYYY-MM-DD') AS date, count(*)::bigint AS count
    FROM "Lead"
    WHERE "workspaceId" = ${workspaceId}
      AND "createdAt" >= make_timestamp(
        ${windowStartYear}::int,
        ${windowStartMonth}::int,
        ${windowStartDay}::int,
        0, 0, 0
      )
      AND "createdAt" < make_timestamp(
        ${endYear}::int,
        ${endMonth}::int,
        ${endDay}::int,
        0, 0, 0
      )
    GROUP BY date
    ORDER BY date ASC
  `;

  const byDate = new Map<string, number>();
  for (const row of rows) {
    byDate.set(row.date, Number(row.count));
  }

  const result: LeadByDay[] = [];
  // A separate cursor keeps the query arguments immutable while filling the
  // fixed 14-day series.
  const cursor = new Date(windowStart);

  for (let i = 0; i < 14; i += 1) {
    const dateKey = utcDateString(cursor);
    result.push({ date: dateKey, count: byDate.get(dateKey) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

export async function hasDemoData(user: SessionUser): Promise<boolean> {
  const count = await prisma.lead.count({
    where: { workspaceId: user.workspaceId, title: { startsWith: "[DEMO]" } },
  });
  return count > 0;
}
