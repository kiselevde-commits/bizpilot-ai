// Must stay first: it refuses an unsafe target before Prisma is imported.
import "./helpers/enforce-test-database";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/database/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { getDashboardData, hasDemoData } from "@/services/dashboard.service";
import { listTasks } from "@/services/task.service";

/**
 * Real PostgreSQL checks for Dashboard Workspace isolation.
 *
 * Two populated Workspaces plus one empty Workspace are created for this file
 * only. Legacy cross-Workspace relations are written directly through Prisma to
 * prove that Dashboard aggregates and previews never surface foreign data.
 * Everything is removed afterwards; this file must never run against demo data.
 */

const suffix = randomUUID();
const prefix = `DASH_ISO_${suffix}`;

const secrets = {
  contactBName: `SECRET_DASH_CONTACT_B_${suffix}`,
  contactBEmail: `secret-dash-contact-b-${suffix}@example.test`,
  userBName: `SECRET_DASH_USER_B_${suffix}`,
  userBEmail: `secret-dash-user-b-${suffix}@example.test`,
  leadBTitle: `${prefix} SECRET_LEAD_B_${suffix}`,
  leadBMessage: `${prefix} SECRET_LEAD_B_MESSAGE_${suffix}`,
  taskBTitle: `${prefix} SECRET_TASK_B_${suffix}`,
};

let workspaceAId = "";
let workspaceBId = "";
let workspaceEmptyId = "";
let workspaceTrendId = "";
let adminAId = "";
let adminBId = "";
let adminTrendId = "";
let userA: SessionUser;
let userB: SessionUser;
let userEmpty: SessionUser;
let userTrend: SessionUser;

let leadAValidId = "";
let leadALegacyId = "";
let leadBId = "";
let leadBOldId = "";
let leadBDemoId = "";
let taskAValidId = "";
let taskALegacyId = "";

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

beforeAll(async () => {
  const workspaceA = await prisma.workspace.create({
    data: { name: `Dash Isolation A ${suffix}`, slug: `dash-iso-a-${suffix}` },
  });
  const workspaceB = await prisma.workspace.create({
    data: { name: `Dash Isolation B ${suffix}`, slug: `dash-iso-b-${suffix}` },
  });
  const workspaceEmpty = await prisma.workspace.create({
    data: { name: `Dash Isolation Empty ${suffix}`, slug: `dash-iso-empty-${suffix}` },
  });
  const workspaceTrend = await prisma.workspace.create({
    data: { name: `Dash Isolation Trend ${suffix}`, slug: `dash-iso-trend-${suffix}` },
  });
  workspaceAId = workspaceA.id;
  workspaceBId = workspaceB.id;
  workspaceEmptyId = workspaceEmpty.id;
  workspaceTrendId = workspaceTrend.id;

  const adminA = await prisma.user.create({
    data: {
      workspaceId: workspaceAId,
      name: `Admin A ${suffix}`,
      email: `dash-admin-a-${suffix}@example.test`,
      passwordHash: "not-used-in-this-test",
      role: "ADMIN",
    },
  });
  const adminB = await prisma.user.create({
    data: {
      workspaceId: workspaceBId,
      name: secrets.userBName,
      email: secrets.userBEmail,
      passwordHash: "not-used-in-this-test",
      role: "ADMIN",
    },
  });
  const adminEmpty = await prisma.user.create({
    data: {
      workspaceId: workspaceEmptyId,
      name: `Admin Empty ${suffix}`,
      email: `dash-admin-empty-${suffix}@example.test`,
      passwordHash: "not-used-in-this-test",
      role: "ADMIN",
    },
  });
  const adminTrend = await prisma.user.create({
    data: {
      workspaceId: workspaceTrendId,
      name: `Admin Trend ${suffix}`,
      email: `dash-admin-trend-${suffix}@example.test`,
      passwordHash: "not-used-in-this-test",
      role: "ADMIN",
    },
  });
  adminAId = adminA.id;
  adminBId = adminB.id;
  adminTrendId = adminTrend.id;

  userA = {
    id: adminA.id,
    name: adminA.name,
    email: adminA.email,
    role: "ADMIN",
    workspaceId: workspaceAId,
    workspaceName: workspaceA.name,
  };
  userB = {
    id: adminB.id,
    name: adminB.name,
    email: adminB.email,
    role: "ADMIN",
    workspaceId: workspaceBId,
    workspaceName: workspaceB.name,
  };
  userEmpty = {
    id: adminEmpty.id,
    name: adminEmpty.name,
    email: adminEmpty.email,
    role: "ADMIN",
    workspaceId: workspaceEmptyId,
    workspaceName: workspaceEmpty.name,
  };
  userTrend = {
    id: adminTrend.id,
    name: adminTrend.name,
    email: adminTrend.email,
    role: "ADMIN",
    workspaceId: workspaceTrendId,
    workspaceName: workspaceTrend.name,
  };

  const contactA = await prisma.contact.create({
    data: {
      workspaceId: workspaceAId,
      name: `Contact A ${suffix}`,
      email: `dash-contact-a-${suffix}@example.test`,
      createdById: adminAId,
      updatedById: adminAId,
    },
  });
  const contactB = await prisma.contact.create({
    data: {
      workspaceId: workspaceBId,
      name: secrets.contactBName,
      email: secrets.contactBEmail,
      createdById: adminBId,
      updatedById: adminBId,
    },
  });

  const leadAValid = await prisma.lead.create({
    data: {
      workspaceId: workspaceAId,
      title: `${prefix} Lead A Valid`,
      message: `${prefix} message A valid`,
      priority: "HIGH",
      status: "IN_PROGRESS",
      contactId: contactA.id,
      assignedToId: adminAId,
      // Safely inside the 14-day window regardless of the day boundary.
      createdAt: daysFromNow(-2),
      createdById: adminAId,
      updatedById: adminAId,
    },
  });
  const leadALegacy = await prisma.lead.create({
    data: {
      workspaceId: workspaceAId,
      title: `${prefix} Lead A Legacy`,
      message: `${prefix} message A legacy`,
      priority: "URGENT",
      status: "NEW",
      contactId: contactB.id,
      assignedToId: adminBId,
      // Distinct in-window day, so the trend proves per-Workspace scoping.
      createdAt: daysFromNow(-6),
      createdById: adminAId,
      updatedById: adminAId,
    },
  });
  const leadB = await prisma.lead.create({
    data: {
      workspaceId: workspaceBId,
      title: secrets.leadBTitle,
      message: secrets.leadBMessage,
      priority: "URGENT",
      status: "QUALIFIED",
      contactId: contactA.id,
      assignedToId: adminAId,
      // Same in-window day as leadAValid: A's trend must not count it.
      createdAt: daysFromNow(-2),
      createdById: adminBId,
      updatedById: adminBId,
    },
  });
  const leadBOld = await prisma.lead.create({
    data: {
      workspaceId: workspaceBId,
      title: `${prefix} SECRET_LEAD_B_OLD_${suffix}`,
      message: `${prefix} message B old`,
      priority: "URGENT",
      status: "NEW",
      createdAt: daysFromNow(-30),
      createdById: adminBId,
      updatedById: adminBId,
    },
  });
  const leadBDemo = await prisma.lead.create({
    data: {
      workspaceId: workspaceBId,
      title: `[DEMO] ${prefix} B demo ${suffix}`,
      message: `${prefix} message B demo`,
      // Defaults to MEDIUM priority: must never appear in the priority block.
      createdById: adminBId,
      updatedById: adminBId,
    },
  });
  leadAValidId = leadAValid.id;
  leadALegacyId = leadALegacy.id;
  leadBId = leadB.id;
  leadBOldId = leadBOld.id;
  leadBDemoId = leadBDemo.id;

  const taskAValid = await prisma.task.create({
    data: {
      workspaceId: workspaceAId,
      title: `${prefix} Task A Valid`,
      status: "TODO",
      priority: "HIGH",
      dueDate: daysFromNow(1),
      leadId: leadAValidId,
      contactId: contactA.id,
      assignedToId: adminAId,
      createdById: adminAId,
      updatedById: adminAId,
    },
  });
  const taskALegacy = await prisma.task.create({
    data: {
      workspaceId: workspaceAId,
      title: `${prefix} Task A Legacy`,
      status: "IN_PROGRESS",
      priority: "URGENT",
      dueDate: daysFromNow(2),
      leadId: leadB.id,
      contactId: contactB.id,
      assignedToId: adminBId,
      createdById: adminAId,
      updatedById: adminAId,
    },
  });
  await prisma.task.create({
    data: {
      workspaceId: workspaceBId,
      title: secrets.taskBTitle,
      status: "TODO",
      priority: "URGENT",
      dueDate: daysFromNow(-3),
      leadId: leadAValidId,
      contactId: contactA.id,
      assignedToId: adminAId,
      createdById: adminBId,
      updatedById: adminBId,
    },
  });
  taskAValidId = taskAValid.id;
  taskALegacyId = taskALegacy.id;
});

afterAll(async () => {
  try {
    const workspaceIds = [workspaceAId, workspaceBId, workspaceEmptyId, workspaceTrendId].filter(
      Boolean,
    );

    if (workspaceIds.length > 0) {
      await prisma.task.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await prisma.lead.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await prisma.contact.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await prisma.activityLog.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await prisma.automationEvent.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await prisma.user.deleteMany({ where: { workspaceId: { in: workspaceIds } } });
      await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    }
  } finally {
    await prisma.$disconnect();
  }
});

describe("Dashboard Workspace isolation", () => {
  it("counts only the current Workspace in KPIs", async () => {
    const data = await getDashboardData(userA);

    expect(data.metrics.totalLeads).toBe(2);
    expect(data.metrics.newLeads).toBe(1);
    expect(data.metrics.inProgressLeads).toBe(1);
    expect(data.metrics.convertedLeads).toBe(0);
    expect(data.metrics.totalContacts).toBe(1);
    expect(data.metrics.totalTasks).toBe(2);
    // Workspace B has an overdue task; it must not raise A's counter.
    expect(data.metrics.overdueTasks).toBe(0);
    expect(data.metrics.conversionRate).toBe(0);
  });

  it("keeps the status funnel and the 14-day trend inside the Workspace", async () => {
    const data = await getDashboardData(userA);

    expect(data.leadsByStatus).toEqual([
      { status: "NEW", count: 1 },
      { status: "IN_PROGRESS", count: 1 },
    ]);

    expect(data.leadsByDay).toHaveLength(14);
    const periodTotal = data.leadsByDay.reduce((sum, row) => sum + row.count, 0);
    // A has two in-window leads; B has a third lead on the same UTC day as one
    // of them and must not be added to A's series.
    expect(periodTotal).toBe(2);

    const sharedUtcDay = daysFromNow(-2).toISOString().slice(0, 10);
    const legacyUtcDay = daysFromNow(-6).toISOString().slice(0, 10);
    const byDay = new Map(data.leadsByDay.map((row) => [row.date, row.count]));

    expect(byDay.get(sharedUtcDay)).toBe(1);
    expect(byDay.get(legacyUtcDay)).toBe(1);
    expect(data.leadsByDay.filter((row) => row.count > 0)).toHaveLength(2);
  });

  it("returns only Workspace previews and hides foreign related names", async () => {
    const data = await getDashboardData(userA);

    expect(data.priorityLeads.map((lead) => lead.id).sort()).toEqual(
      [leadAValidId, leadALegacyId].sort(),
    );
    expect(
      data.priorityLeads.every((lead) => lead.priority === "HIGH" || lead.priority === "URGENT"),
    ).toBe(true);
    expect(data.priorityLeads.some((lead) => lead.id === leadBOldId)).toBe(false);

    const legacyLead = data.priorityLeads.find((lead) => lead.id === leadALegacyId);
    expect(legacyLead).toBeDefined();
    expect(legacyLead?.contact).toBeNull();

    const validLead = data.priorityLeads.find((lead) => lead.id === leadAValidId);
    expect(validLead?.contact).toEqual({ name: `Contact A ${suffix}` });

    expect(data.attentionTasks.map((task) => task.id).sort()).toEqual(
      [taskAValidId, taskALegacyId].sort(),
    );

    const legacyTask = data.attentionTasks.find((task) => task.id === taskALegacyId);
    expect(legacyTask).toBeDefined();
    expect(legacyTask?.assignedTo).toBeNull();

    const validTask = data.attentionTasks.find((task) => task.id === taskAValidId);
    expect(validTask?.assignedTo).toEqual({ name: `Admin A ${suffix}` });

    const payload = JSON.stringify(data);
    for (const secret of Object.values(secrets)) {
      expect(payload).not.toContain(secret);
    }
    expect(payload).not.toContain(`${prefix} SECRET_LEAD_B_OLD_${suffix}`);
    expect(payload).not.toContain(`[DEMO] ${prefix} B demo ${suffix}`);
  });

  it("shows the nearest due tasks and the due-date-sorted list contains them", async () => {
    const data = await getDashboardData(userA);

    // The preview intentionally includes upcoming tasks, nearest first.
    expect(data.attentionTasks.map((task) => task.id)).toEqual([taskAValidId, taskALegacyId]);
    expect(
      data.attentionTasks.every(
        (task) => task.dueDate !== null && task.dueDate.getTime() > Date.now(),
      ),
    ).toBe(true);

    // The dashboard link uses `/tasks?sort=dueDate:asc`. This Workspace has only
    // the two preview tasks, so the list contains the same rows in the same
    // order; the link itself is not equivalent to the preview filters in a
    // general Workspace.
    const list = await listTasks(userA, {
      page: 1,
      limit: 20,
      search: "",
      sort: "dueDate:asc",
    });

    expect(list.pagination.total).toBe(2);
    expect(list.items.map((task) => task.id)).toEqual([taskAValidId, taskALegacyId]);
  });

  it("returns B data to B and no A data", async () => {
    const data = await getDashboardData(userB);

    expect(data.metrics.totalLeads).toBe(3);
    expect(data.metrics.totalContacts).toBe(1);
    expect(data.metrics.totalTasks).toBe(1);
    expect(data.metrics.overdueTasks).toBe(1);

    expect(data.priorityLeads.map((lead) => lead.id).sort()).toEqual([leadBId, leadBOldId].sort());
    expect(data.priorityLeads.some((lead) => lead.id === leadBDemoId)).toBe(false);
    expect(data.priorityLeads.some((lead) => lead.id === leadAValidId)).toBe(false);
    expect(data.priorityLeads.some((lead) => lead.id === leadALegacyId)).toBe(false);
    expect(data.attentionTasks).toHaveLength(1);

    // B's own in-window lead shares a UTC day with A's lead; the series must
    // count exactly one lead for that day, not two.
    const sharedUtcDay = daysFromNow(-2).toISOString().slice(0, 10);
    const byDay = new Map(data.leadsByDay.map((row) => [row.date, row.count]));
    expect(byDay.get(sharedUtcDay)).toBe(1);

    const payload = JSON.stringify(data);
    expect(payload).not.toContain(`${prefix} Lead A Valid`);
    expect(payload).not.toContain(`${prefix} Lead A Legacy`);
    expect(payload).not.toContain(`${prefix} Task A Valid`);
    expect(payload).not.toContain(`Contact A ${suffix}`);
    expect(payload).not.toContain(`Admin A ${suffix}`);
  });

  it("gives an empty Workspace zero metrics and no previews", async () => {
    const data = await getDashboardData(userEmpty);

    expect(data.metrics).toEqual({
      totalLeads: 0,
      newLeads: 0,
      inProgressLeads: 0,
      convertedLeads: 0,
      totalContacts: 0,
      totalTasks: 0,
      overdueTasks: 0,
      conversionRate: 0,
    });
    expect(data.leadsByStatus).toEqual([]);
    expect(data.leadsByDay).toHaveLength(14);
    expect(data.leadsByDay.every((row) => row.count === 0)).toBe(true);
    expect(data.priorityLeads).toEqual([]);
    expect(data.attentionTasks).toEqual([]);
  });

  it("scopes the demo-data banner check to the current Workspace", async () => {
    expect(await hasDemoData(userA)).toBe(false);
    expect(await hasDemoData(userB)).toBe(true);
    expect(await hasDemoData(userEmpty)).toBe(false);
  });

  it("uses UTC wall-clock day boundaries for the 14-day trend", async () => {
    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const firstDayUtc = todayUtc - 13 * DAY_MS;

    // The service builds both bounds with make_timestamp(year, month, day, ...),
    // which returns `timestamp without time zone`. Prisma stores these Date
    // fixtures as the same UTC wall clock, so the assertions pin inclusive start
    // and exclusive end semantics without any session-TimeZone conversion.
    const atFirstDayStart = new Date(firstDayUtc);
    const atFirstDay0459 = new Date(firstDayUtc + 4 * 60 * 60 * 1000 + 59 * 60 * 1000);
    const atPreviousDay2330 = new Date(firstDayUtc - 30 * 60 * 1000);
    const atLastDay2330 = new Date(todayUtc + 23 * 60 * 60 * 1000 + 30 * 60 * 1000);
    const atLastDayEnd = new Date(todayUtc + DAY_MS - 1);
    const atExactNextMidnight = new Date(todayUtc + DAY_MS);

    const lead = (workspaceId: string, userId: string, title: string, createdAt: Date) => ({
      workspaceId,
      title: `${prefix} ${title}`,
      message: `${prefix} boundary probe`,
      createdAt,
      createdById: userId,
      updatedById: userId,
    });

    await prisma.lead.createMany({
      data: [
        // First day of the window: both records belong to the same UTC day.
        lead(workspaceTrendId, adminTrendId, "trend 00:00 UTC", atFirstDayStart),
        lead(workspaceTrendId, adminTrendId, "trend 04:59 UTC", atFirstDay0459),
        // 23:30 UTC on the day before the window must be excluded.
        lead(workspaceTrendId, adminTrendId, "trend previous day 23:30 UTC", atPreviousDay2330),
        // Last day of the window, late UTC evening: must stay on that day.
        lead(workspaceTrendId, adminTrendId, "trend last day 23:30 UTC", atLastDay2330),
        // The final millisecond of the current UTC day is still inside.
        lead(workspaceTrendId, adminTrendId, "trend last day 23:59:59.999 UTC", atLastDayEnd),
        // Exactly at the next UTC midnight is outside the half-open window.
        lead(workspaceTrendId, adminTrendId, "trend exact next UTC midnight", atExactNextMidnight),
        // Same instant in another Workspace must not be counted here.
        lead(workspaceBId, adminBId, "trend foreign same instant", atFirstDayStart),
      ],
    });

    const data = await getDashboardData(userTrend);
    const byDay = new Map(data.leadsByDay.map((row) => [row.date, row.count]));
    const firstDayKey = utcDayKey(firstDayUtc);
    const lastDayKey = utcDayKey(todayUtc);

    expect(data.leadsByDay).toHaveLength(14);
    expect(data.leadsByDay[0]?.date).toBe(firstDayKey);
    expect(data.leadsByDay[13]?.date).toBe(lastDayKey);

    // 00:00 and 04:59 UTC are the same UTC day; the foreign lead is excluded.
    expect(byDay.get(firstDayKey)).toBe(2);
    // 23:30 and 23:59:59.999 UTC both belong to the last day.
    expect(byDay.get(lastDayKey)).toBe(2);

    // 23:30 UTC on the previous day and the exact next UTC midnight are out.
    expect(byDay.has(utcDayKey(firstDayUtc - DAY_MS))).toBe(false);
    expect(byDay.has(utcDayKey(todayUtc + DAY_MS))).toBe(false);
    expect(data.leadsByDay.reduce((sum, row) => sum + row.count, 0)).toBe(4);

    const windowStart = new Date(firstDayUtc);
    const windowEnd = new Date(todayUtc + DAY_MS);

    // getDashboardData exposes only 14 buckets, so an out-of-window row is not
    // visible in the series even if the end bound were inclusive. Verify the
    // exact half-open point with the same make_timestamp(<) construction used
    // by the service; the unit test pins the service SQL text.
    const boundaryCount = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count
      FROM "Lead"
      WHERE "workspaceId" = ${workspaceTrendId}
        AND "createdAt" >= make_timestamp(
          ${windowStart.getUTCFullYear()}::int,
          ${windowStart.getUTCMonth() + 1}::int,
          ${windowStart.getUTCDate()}::int,
          0, 0, 0
        )
        AND "createdAt" < make_timestamp(
          ${windowEnd.getUTCFullYear()}::int,
          ${windowEnd.getUTCMonth() + 1}::int,
          ${windowEnd.getUTCDate()}::int,
          0, 0, 0
        )
    `;

    expect(Number(boundaryCount[0]?.count)).toBe(4);

    // The other Workspace sees its own record at the shared instant, and only
    // its own: the trend Workspace's boundary leads never leak into it.
    const foreign = await getDashboardData(userB);
    const foreignByDay = new Map(foreign.leadsByDay.map((row) => [row.date, row.count]));
    expect(foreignByDay.get(firstDayKey)).toBe(1);
  });
});
