// Must stay first: it refuses an unsafe target before Prisma is imported.
import "./helpers/enforce-test-database";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/database/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { getDashboardData } from "@/services/dashboard.service";

/**
 * Regression checks for the Dashboard attention block.
 *
 * Product requirement: overdue HIGH/URGENT tasks must surface first, followed
 * by the nearest upcoming HIGH/URGENT tasks. MEDIUM and LOW tasks, as well as
 * DONE/CANCELLED tasks, must stay out. The preview is bounded.
 *
 * Real PostgreSQL checks on Workspaces created for this file only; everything
 * is removed afterwards. Never run against demo or production data.
 */

const suffix = randomUUID();
const prefix = `DASH_PRIO_${suffix}`;

const ATTENTION_LIMIT = 5;

let workspaceId = "";
let foreignWorkspaceId = "";
let emptyWorkspaceId = "";
let adminId = "";
let foreignAdminId = "";
let user: SessionUser;
let foreignUser: SessionUser;
let emptyUser: SessionUser;

const taskIds = {
  overdueUrgent: "",
  overdueHigh: "",
  upcomingHigh: "",
  upcomingUrgent: "",
  extraHigh3: "",
  extraHigh4: "",
  extraHigh5: "",
  medium: "",
  low: "",
  doneUrgent: "",
  cancelledHigh: "",
  foreignUrgent: "",
};

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

beforeAll(async () => {
  const workspace = await prisma.workspace.create({
    data: { name: `Dash Priority ${suffix}`, slug: `dash-priority-${suffix}` },
  });
  const foreignWorkspace = await prisma.workspace.create({
    data: { name: `Dash Priority Foreign ${suffix}`, slug: `dash-priority-foreign-${suffix}` },
  });
  const emptyWorkspace = await prisma.workspace.create({
    data: { name: `Dash Priority Empty ${suffix}`, slug: `dash-priority-empty-${suffix}` },
  });
  workspaceId = workspace.id;
  foreignWorkspaceId = foreignWorkspace.id;
  emptyWorkspaceId = emptyWorkspace.id;

  const admin = await prisma.user.create({
    data: {
      workspaceId,
      name: `Admin ${suffix}`,
      email: `dash-priority-admin-${suffix}@example.test`,
      passwordHash: "not-used-in-this-test",
      role: "ADMIN",
    },
  });
  const foreignAdmin = await prisma.user.create({
    data: {
      workspaceId: foreignWorkspaceId,
      name: `Foreign Admin ${suffix}`,
      email: `dash-priority-foreign-admin-${suffix}@example.test`,
      passwordHash: "not-used-in-this-test",
      role: "ADMIN",
    },
  });
  const emptyAdmin = await prisma.user.create({
    data: {
      workspaceId: emptyWorkspaceId,
      name: `Admin Empty ${suffix}`,
      email: `dash-priority-admin-empty-${suffix}@example.test`,
      passwordHash: "not-used-in-this-test",
      role: "ADMIN",
    },
  });
  adminId = admin.id;
  foreignAdminId = foreignAdmin.id;

  user = {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: "ADMIN",
    workspaceId,
    workspaceName: workspace.name,
  };
  foreignUser = {
    id: foreignAdmin.id,
    name: foreignAdmin.name,
    email: foreignAdmin.email,
    role: "ADMIN",
    workspaceId: foreignWorkspaceId,
    workspaceName: foreignWorkspace.name,
  };
  emptyUser = {
    id: emptyAdmin.id,
    name: emptyAdmin.name,
    email: emptyAdmin.email,
    role: "ADMIN",
    workspaceId: emptyWorkspaceId,
    workspaceName: emptyWorkspace.name,
  };

  const createTask = (
    title: string,
    priority: "HIGH" | "URGENT" | "MEDIUM" | "LOW",
    dueInDays: number,
    status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED" = "TODO",
  ) =>
    prisma.task.create({
      data: {
        workspaceId,
        title: `${prefix} ${title}`,
        status,
        priority,
        dueDate: daysFromNow(dueInDays),
        createdById: adminId,
        updatedById: adminId,
      },
    });

  const [
    overdueUrgent,
    overdueHigh,
    upcomingHigh,
    upcomingUrgent,
    extraHigh3,
    extraHigh4,
    extraHigh5,
    medium,
    low,
    doneUrgent,
    cancelledHigh,
  ] = await Promise.all([
    createTask("Task overdue URGENT", "URGENT", -5),
    createTask("Task overdue HIGH", "HIGH", -1),
    createTask("Task upcoming HIGH", "HIGH", 1),
    createTask("Task upcoming URGENT", "URGENT", 2),
    createTask("Task extra HIGH 3", "HIGH", 3),
    createTask("Task extra HIGH 4", "HIGH", 4),
    createTask("Task extra HIGH 5", "HIGH", 5),
    createTask("Task MEDIUM overdue", "MEDIUM", -3),
    createTask("Task LOW upcoming", "LOW", 0.5),
    createTask("Task DONE URGENT", "URGENT", -2, "DONE"),
    createTask("Task CANCELLED HIGH", "HIGH", -2, "CANCELLED"),
  ]);
  taskIds.overdueUrgent = overdueUrgent.id;
  taskIds.overdueHigh = overdueHigh.id;
  taskIds.upcomingHigh = upcomingHigh.id;
  taskIds.upcomingUrgent = upcomingUrgent.id;
  taskIds.extraHigh3 = extraHigh3.id;
  taskIds.extraHigh4 = extraHigh4.id;
  taskIds.extraHigh5 = extraHigh5.id;
  taskIds.medium = medium.id;
  taskIds.low = low.id;
  taskIds.doneUrgent = doneUrgent.id;
  taskIds.cancelledHigh = cancelledHigh.id;

  const foreignUrgent = await prisma.task.create({
    data: {
      workspaceId: foreignWorkspaceId,
      title: `${prefix} SECRET foreign URGENT`,
      status: "TODO",
      priority: "URGENT",
      dueDate: daysFromNow(-4),
      createdById: foreignAdminId,
      updatedById: foreignAdminId,
    },
  });
  taskIds.foreignUrgent = foreignUrgent.id;
});

afterAll(async () => {
  try {
    const workspaceIds = [workspaceId, foreignWorkspaceId, emptyWorkspaceId].filter(Boolean);

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

describe("Dashboard attention tasks block", () => {
  it("includes overdue and upcoming HIGH/URGENT tasks only", async () => {
    const data = await getDashboardData(user);
    const ids = data.attentionTasks.map((task) => task.id);

    expect(ids).toContain(taskIds.overdueUrgent);
    expect(ids).toContain(taskIds.overdueHigh);
    expect(ids).toContain(taskIds.upcomingHigh);
    expect(ids).toContain(taskIds.upcomingUrgent);

    expect(ids).not.toContain(taskIds.medium);
    expect(ids).not.toContain(taskIds.low);
    expect(ids).not.toContain(taskIds.doneUrgent);
    expect(ids).not.toContain(taskIds.cancelledHigh);
    expect(ids).not.toContain(taskIds.foreignUrgent);

    expect(
      data.attentionTasks.every((task) => task.priority === "HIGH" || task.priority === "URGENT"),
    ).toBe(true);
    expect(
      data.attentionTasks.every((task) => task.status === "TODO" || task.status === "IN_PROGRESS"),
    ).toBe(true);
  });

  it("orders overdue tasks first, then the nearest upcoming tasks", async () => {
    const data = await getDashboardData(user);

    expect(data.attentionTasks.map((task) => task.id)).toEqual([
      taskIds.overdueUrgent,
      taskIds.overdueHigh,
      taskIds.upcomingHigh,
      taskIds.upcomingUrgent,
      taskIds.extraHigh3,
    ]);
  });

  it("bounds the preview instead of returning every matching task", async () => {
    const data = await getDashboardData(user);

    expect(data.attentionTasks).toHaveLength(ATTENTION_LIMIT);
    expect(data.attentionTasks.some((task) => task.id === taskIds.extraHigh4)).toBe(false);
    expect(data.attentionTasks.some((task) => task.id === taskIds.extraHigh5)).toBe(false);
  });

  it("never returns attention tasks from another Workspace", async () => {
    const own = await getDashboardData(user);
    expect(own.attentionTasks.some((task) => task.id === taskIds.foreignUrgent)).toBe(false);

    const foreign = await getDashboardData(foreignUser);
    expect(foreign.attentionTasks.map((task) => task.id)).toEqual([taskIds.foreignUrgent]);
  });

  it("returns an empty attention block for a Workspace without tasks", async () => {
    const data = await getDashboardData(emptyUser);

    expect(data.attentionTasks).toEqual([]);
  });
});
