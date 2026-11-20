import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn(),
  requireRole: vi.fn(),
  getCurrentUser: vi.fn(),
}));

import { prisma } from "@/lib/database/prisma";
import { requireUser } from "@/lib/auth/session";
import { deleteLead, getLead, listLeads } from "@/services/lead.service";
import { getTask, listTasks } from "@/services/task.service";
import { getContact } from "@/services/contact.service";
import { DELETE as deleteLeadHttp, GET as getLeadHttp } from "@/app/api/leads/[id]/route";
import { GET as getTaskHttp } from "@/app/api/tasks/[id]/route";
import { GET as getContactHttp } from "@/app/api/contacts/[id]/route";

/**
 * Real PostgreSQL checks for read-time Workspace isolation.
 *
 * Fixtures intentionally contain legacy cross-workspace relations written
 * directly through Prisma, bypassing the service write checks. This file must
 * run against an isolated test database/schema, never against dev/seed data.
 */

const suffix = randomUUID();
const prefix = `READ_ISO_${suffix}`;

const secrets = {
  contactBName: `SECRET_CONTACT_B_${suffix}`,
  contactBEmail: `secret-contact-b-${suffix}@example.test`,
  contactBPhone: `+7999000${suffix.slice(0, 4)}`,
  userBName: `SECRET_USER_B_${suffix}`,
  userBEmail: `secret-user-b-${suffix}@example.test`,
  leadBTitle: `${prefix} SECRET_LEAD_B_${suffix}`,
  leadBMessage: `${prefix} SECRET_LEAD_B_MESSAGE_${suffix}`,
  taskBTitle: `${prefix} SECRET_TASK_B_${suffix}`,
  taskBForLeadATitle: `${prefix} SECRET_TASK_B_FOR_LEAD_A_${suffix}`,
};

let workspaceAId = "";
let workspaceBId = "";
let adminAId = "";
let adminBId = "";
let userA: SessionUser;
let userB: SessionUser;

let contactAId = "";
let contactBId = "";
let leadAId = "";
let leadBId = "";
let leadAValidId = "";
let taskAId = "";
let taskBId = "";
let taskAValidId = "";
let taskAForLeadAId = "";
let taskBForLeadAId = "";
let leadForDeleteId = "";
let taskForDeleteId = "";

type LeadReadRow = {
  id: string;
  title: string;
  contactId: string | null;
  assignedToId: string | null;
  contact: { id: string; name: string; email: string | null; phone: string | null } | null;
  assignedTo: { id: string; name: string; email: string } | null;
  tasks: Array<{
    id: string;
    title: string;
    assignedTo: { id: string; name: string; email: string } | null;
  }>;
};

type TaskReadRow = {
  id: string;
  title: string;
  leadId: string | null;
  contactId: string | null;
  assignedToId: string | null;
  lead: { id: string; title: string } | null;
  contact: { id: string; name: string; email: string | null; phone: string | null } | null;
  assignedTo: { id: string; name: string; email: string } | null;
};

type ContactReadRow = {
  id: string;
  name: string;
  leads: Array<{ id: string; title: string }>;
  tasks: Array<{ id: string; title: string }>;
};

type JsonBody<T> = {
  success: boolean;
  data: T;
  error: unknown;
};

function asUser(user: SessionUser): void {
  vi.mocked(requireUser).mockResolvedValue(user);
}

function mustLead(value: LeadReadRow | null): LeadReadRow {
  expect(value).not.toBeNull();
  return value as LeadReadRow;
}

function mustTask(value: TaskReadRow | null): TaskReadRow {
  expect(value).not.toBeNull();
  return value as TaskReadRow;
}

function mustContact(value: ContactReadRow | null): ContactReadRow {
  expect(value).not.toBeNull();
  return value as ContactReadRow;
}

beforeAll(async () => {
  const workspaceA = await prisma.workspace.create({
    data: { name: `Read Isolation A ${suffix}`, slug: `read-iso-a-${suffix}` },
  });
  const workspaceB = await prisma.workspace.create({
    data: { name: `Read Isolation B ${suffix}`, slug: `read-iso-b-${suffix}` },
  });
  workspaceAId = workspaceA.id;
  workspaceBId = workspaceB.id;

  const adminA = await prisma.user.create({
    data: {
      workspaceId: workspaceAId,
      name: `Admin A ${suffix}`,
      email: `admin-a-${suffix}@example.test`,
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
  adminAId = adminA.id;
  adminBId = adminB.id;

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

  const contactA = await prisma.contact.create({
    data: {
      workspaceId: workspaceAId,
      name: `Contact A ${suffix}`,
      email: `contact-a-${suffix}@example.test`,
      phone: `+7999111${suffix.slice(0, 4)}`,
      createdById: adminAId,
      updatedById: adminAId,
    },
  });
  const contactB = await prisma.contact.create({
    data: {
      workspaceId: workspaceBId,
      name: secrets.contactBName,
      email: secrets.contactBEmail,
      phone: secrets.contactBPhone,
      createdById: adminBId,
      updatedById: adminBId,
    },
  });
  contactAId = contactA.id;
  contactBId = contactB.id;

  const leadA = await prisma.lead.create({
    data: {
      workspaceId: workspaceAId,
      title: `${prefix} Lead A`,
      message: `${prefix} message A`,
      contactId: contactBId,
      assignedToId: adminBId,
      createdById: adminAId,
      updatedById: adminAId,
    },
  });
  const leadB = await prisma.lead.create({
    data: {
      workspaceId: workspaceBId,
      title: secrets.leadBTitle,
      message: secrets.leadBMessage,
      contactId: contactAId,
      assignedToId: adminAId,
      createdById: adminBId,
      updatedById: adminBId,
    },
  });
  const leadAValid = await prisma.lead.create({
    data: {
      workspaceId: workspaceAId,
      title: `${prefix} Lead A Valid`,
      message: `${prefix} message A valid`,
      contactId: contactAId,
      assignedToId: adminAId,
      createdById: adminAId,
      updatedById: adminAId,
    },
  });
  const leadForDelete = await prisma.lead.create({
    data: {
      workspaceId: workspaceAId,
      title: `${prefix} Lead For Delete`,
      message: `${prefix} message delete`,
      createdById: adminAId,
      updatedById: adminAId,
    },
  });
  leadAId = leadA.id;
  leadBId = leadB.id;
  leadAValidId = leadAValid.id;
  leadForDeleteId = leadForDelete.id;

  const taskA = await prisma.task.create({
    data: {
      workspaceId: workspaceAId,
      title: `${prefix} Task A`,
      leadId: leadBId,
      contactId: contactBId,
      assignedToId: adminBId,
      createdById: adminAId,
      updatedById: adminAId,
    },
  });
  const taskB = await prisma.task.create({
    data: {
      workspaceId: workspaceBId,
      title: secrets.taskBTitle,
      leadId: leadAId,
      contactId: contactAId,
      assignedToId: adminAId,
      createdById: adminBId,
      updatedById: adminBId,
    },
  });
  const taskAValid = await prisma.task.create({
    data: {
      workspaceId: workspaceAId,
      title: `${prefix} Task A Valid`,
      leadId: leadAValidId,
      contactId: contactAId,
      assignedToId: adminAId,
      createdById: adminAId,
      updatedById: adminAId,
    },
  });
  const taskAForLeadA = await prisma.task.create({
    data: {
      workspaceId: workspaceAId,
      title: `${prefix} Task A For Lead A`,
      leadId: leadAId,
      contactId: contactAId,
      assignedToId: adminBId,
      createdById: adminAId,
      updatedById: adminAId,
    },
  });
  const taskBForLeadA = await prisma.task.create({
    data: {
      workspaceId: workspaceBId,
      title: secrets.taskBForLeadATitle,
      leadId: leadAId,
      contactId: contactBId,
      assignedToId: adminBId,
      createdById: adminBId,
      updatedById: adminBId,
    },
  });
  const taskForDelete = await prisma.task.create({
    data: {
      workspaceId: workspaceAId,
      title: `${prefix} Task For Delete`,
      leadId: leadForDeleteId,
      contactId: contactAId,
      assignedToId: adminAId,
      createdById: adminAId,
      updatedById: adminAId,
    },
  });
  taskAId = taskA.id;
  taskBId = taskB.id;
  taskAValidId = taskAValid.id;
  taskAForLeadAId = taskAForLeadA.id;
  taskBForLeadAId = taskBForLeadA.id;
  taskForDeleteId = taskForDelete.id;
});

beforeEach(() => {
  asUser(userA);
});

afterAll(async () => {
  try {
    const workspaceIds = [workspaceAId, workspaceBId].filter(Boolean);

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

describe("read-time Workspace isolation", () => {
  it("listLeads hides foreign Contact and User but keeps the Lead", async () => {
    const result = await listLeads(userA, {
      page: 1,
      limit: 100,
      search: prefix,
      sort: "createdAt:desc",
    });
    const items = result.items as unknown as LeadReadRow[];
    const leadA = items.find((item) => item.id === leadAId);
    const leadValid = items.find((item) => item.id === leadAValidId);

    expect(leadA).toBeDefined();
    expect(leadA?.contactId).toBeNull();
    expect(leadA?.assignedToId).toBeNull();
    expect(leadA?.contact).toBeNull();
    expect(leadA?.assignedTo).toBeNull();

    expect(leadValid).toBeDefined();
    expect(leadValid?.contactId).toBe(contactAId);
    expect(leadValid?.assignedToId).toBe(adminAId);
    expect(leadValid?.contact?.id).toBe(contactAId);
    expect(leadValid?.assignedTo?.id).toBe(adminAId);

    expect(items.some((item) => item.id === leadBId)).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secrets.contactBName);
    expect(JSON.stringify(result)).not.toContain(secrets.contactBEmail);
    expect(JSON.stringify(result)).not.toContain(secrets.userBEmail);
  });

  it("getLead hides foreign Contact/User and foreign nested Tasks", async () => {
    const lead = mustLead((await getLead(userA, leadAId)) as unknown as LeadReadRow | null);

    expect(lead.id).toBe(leadAId);
    expect(lead.contactId).toBeNull();
    expect(lead.assignedToId).toBeNull();
    expect(lead.contact).toBeNull();
    expect(lead.assignedTo).toBeNull();
    expect(lead.tasks.some((task) => task.id === taskAForLeadAId)).toBe(true);
    expect(lead.tasks.find((task) => task.id === taskAForLeadAId)?.assignedTo).toBeNull();
    expect(lead.tasks.some((task) => task.id === taskBForLeadAId)).toBe(false);
    expect(JSON.stringify(lead)).not.toContain(secrets.contactBName);
    expect(JSON.stringify(lead)).not.toContain(secrets.contactBEmail);
    expect(JSON.stringify(lead)).not.toContain(secrets.userBEmail);
    expect(JSON.stringify(lead)).not.toContain(secrets.taskBForLeadATitle);
  });

  it("listTasks hides foreign Lead, Contact and User but keeps the Task", async () => {
    const result = await listTasks(userA, {
      page: 1,
      limit: 100,
      search: prefix,
      sort: "createdAt:desc",
    });
    const items = result.items as unknown as TaskReadRow[];
    const taskA = items.find((item) => item.id === taskAId);
    const taskValid = items.find((item) => item.id === taskAValidId);

    expect(taskA).toBeDefined();
    expect(taskA?.leadId).toBeNull();
    expect(taskA?.contactId).toBeNull();
    expect(taskA?.assignedToId).toBeNull();
    expect(taskA?.lead).toBeNull();
    expect(taskA?.contact).toBeNull();
    expect(taskA?.assignedTo).toBeNull();

    expect(taskValid).toBeDefined();
    expect(taskValid?.leadId).toBe(leadAValidId);
    expect(taskValid?.contactId).toBe(contactAId);
    expect(taskValid?.assignedToId).toBe(adminAId);
    expect(taskValid?.lead?.id).toBe(leadAValidId);
    expect(taskValid?.contact?.id).toBe(contactAId);
    expect(taskValid?.assignedTo?.id).toBe(adminAId);

    expect(items.some((item) => item.id === taskBId)).toBe(false);
    expect(items.some((item) => item.id === taskBForLeadAId)).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secrets.leadBTitle);
    expect(JSON.stringify(result)).not.toContain(secrets.contactBName);
    expect(JSON.stringify(result)).not.toContain(secrets.userBEmail);
  });

  it("getTask hides foreign Lead, Contact and User but keeps the Task", async () => {
    const task = mustTask((await getTask(userA, taskAId)) as unknown as TaskReadRow | null);

    expect(task.id).toBe(taskAId);
    expect(task.leadId).toBeNull();
    expect(task.contactId).toBeNull();
    expect(task.assignedToId).toBeNull();
    expect(task.lead).toBeNull();
    expect(task.contact).toBeNull();
    expect(task.assignedTo).toBeNull();
    expect(JSON.stringify(task)).not.toContain(secrets.leadBTitle);
    expect(JSON.stringify(task)).not.toContain(secrets.contactBName);
    expect(JSON.stringify(task)).not.toContain(secrets.userBEmail);
  });

  it("getContact hides foreign Leads and Tasks but keeps its own rows", async () => {
    const contact = mustContact(
      (await getContact(userA, contactAId)) as unknown as ContactReadRow | null,
    );

    expect(contact.id).toBe(contactAId);
    expect(contact.leads.some((lead) => lead.id === leadAValidId)).toBe(true);
    expect(contact.leads.some((lead) => lead.id === leadBId)).toBe(false);
    expect(contact.tasks.some((task) => task.id === taskAValidId)).toBe(true);
    expect(contact.tasks.some((task) => task.id === taskBId)).toBe(false);
    expect(JSON.stringify(contact)).not.toContain(secrets.leadBTitle);
    expect(JSON.stringify(contact)).not.toContain(secrets.taskBTitle);
  });

  it("getContact hides rows from the other side of a legacy relation", async () => {
    const contact = mustContact(
      (await getContact(userB, contactBId)) as unknown as ContactReadRow | null,
    );

    expect(contact.leads.some((lead) => lead.id === leadAId)).toBe(false);
    expect(contact.tasks.some((task) => task.id === taskAId)).toBe(false);
    expect(contact.tasks.some((task) => task.id === taskBForLeadAId)).toBe(true);
    expect(JSON.stringify(contact)).not.toContain(`${prefix} Lead A`);
    expect(JSON.stringify(contact)).not.toContain(`${prefix} Task A`);
  });
});

describe("deleteLead with legacy cross-workspace Task", () => {
  it("refuses deletion with 409 and leaves every task and the lead unchanged", async () => {
    const leadBefore = await prisma.lead.findUnique({ where: { id: leadAId } });
    const ownTaskBefore = await prisma.task.findUnique({ where: { id: taskAForLeadAId } });
    const foreignTaskBefore = await prisma.task.findUnique({ where: { id: taskBForLeadAId } });
    const logsBefore = await prisma.activityLog.count({
      where: { entityType: "lead", entityId: leadAId, action: "lead.deleted" },
    });

    await expect(deleteLead(userA, leadAId)).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });

    const leadAfter = await prisma.lead.findUnique({ where: { id: leadAId } });
    const ownTaskAfter = await prisma.task.findUnique({ where: { id: taskAForLeadAId } });
    const foreignTaskAfter = await prisma.task.findUnique({ where: { id: taskBForLeadAId } });
    const logsAfter = await prisma.activityLog.count({
      where: { entityType: "lead", entityId: leadAId, action: "lead.deleted" },
    });

    expect(leadBefore).not.toBeNull();
    expect(leadAfter).not.toBeNull();
    expect(ownTaskBefore?.leadId).toBe(leadAId);
    expect(ownTaskAfter?.leadId).toBe(leadAId);
    expect(foreignTaskBefore?.leadId).toBe(leadAId);
    expect(foreignTaskAfter?.leadId).toBe(leadAId);
    expect(logsAfter).toBe(logsBefore);
  });

  it("deletes a Lead normally when all linked Tasks belong to the same Workspace", async () => {
    await deleteLead(userA, leadForDeleteId);

    const lead = await prisma.lead.findUnique({ where: { id: leadForDeleteId } });
    const task = await prisma.task.findUnique({ where: { id: taskForDeleteId } });
    const log = await prisma.activityLog.findFirst({
      where: {
        entityType: "lead",
        entityId: leadForDeleteId,
        action: "lead.deleted",
      },
    });

    expect(lead).toBeNull();
    expect(task?.leadId).toBeNull();
    expect(log).not.toBeNull();
  });
});

describe("HTTP read responses", () => {
  it("GET /api/leads/:id does not expose foreign relation data", async () => {
    asUser(userA);

    const response = await getLeadHttp(new NextRequest(`http://localhost/api/leads/${leadAId}`), {
      params: Promise.resolve({ id: leadAId }),
    });
    const body = (await response.json()) as JsonBody<LeadReadRow>;
    const payload = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.contactId).toBeNull();
    expect(body.data.assignedToId).toBeNull();
    expect(body.data.contact).toBeNull();
    expect(body.data.assignedTo).toBeNull();
    expect(body.data.tasks.some((task) => task.id === taskBForLeadAId)).toBe(false);
    expect(payload).not.toContain(secrets.contactBName);
    expect(payload).not.toContain(secrets.contactBEmail);
    expect(payload).not.toContain(secrets.userBEmail);
    expect(payload).not.toContain(secrets.taskBForLeadATitle);
  });

  it("GET /api/tasks/:id does not expose foreign Lead, Contact or User data", async () => {
    asUser(userA);

    const response = await getTaskHttp(new NextRequest(`http://localhost/api/tasks/${taskAId}`), {
      params: Promise.resolve({ id: taskAId }),
    });
    const body = (await response.json()) as JsonBody<TaskReadRow>;
    const payload = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.leadId).toBeNull();
    expect(body.data.contactId).toBeNull();
    expect(body.data.assignedToId).toBeNull();
    expect(body.data.lead).toBeNull();
    expect(body.data.contact).toBeNull();
    expect(body.data.assignedTo).toBeNull();
    expect(payload).not.toContain(secrets.leadBTitle);
    expect(payload).not.toContain(secrets.contactBName);
    expect(payload).not.toContain(secrets.userBEmail);
  });

  it("GET /api/contacts/:id does not expose foreign Leads or Tasks", async () => {
    asUser(userA);

    const response = await getContactHttp(
      new NextRequest(`http://localhost/api/contacts/${contactAId}`),
      { params: Promise.resolve({ id: contactAId }) },
    );
    const body = (await response.json()) as JsonBody<ContactReadRow>;
    const payload = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.leads.some((lead) => lead.id === leadBId)).toBe(false);
    expect(body.data.tasks.some((task) => task.id === taskBId)).toBe(false);
    expect(payload).not.toContain(secrets.leadBTitle);
    expect(payload).not.toContain(secrets.taskBTitle);
  });

  it("DELETE /api/leads/:id returns a generic 409 for a legacy foreign Task", async () => {
    asUser(userA);

    const response = await deleteLeadHttp(
      new NextRequest(`http://localhost:3000/api/leads/${leadAId}`, {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      }),
      { params: Promise.resolve({ id: leadAId }) },
    );
    const body = (await response.json()) as JsonBody<null>;
    const payload = JSON.stringify(body);

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error).toMatchObject({
      code: "CONFLICT",
      message: "Невозможно безопасно удалить заявку",
    });
    expect(payload).not.toContain(secrets.contactBName);
    expect(payload).not.toContain(secrets.userBEmail);
  });
});
