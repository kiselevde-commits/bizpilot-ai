// Must stay first: it refuses an unsafe target before Prisma is imported.
import "./helpers/enforce-test-database";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/database/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { deleteLead, getLead, listLeads, updateLead } from "@/services/lead.service";
import { getContact, listContacts } from "@/services/contact.service";
import { getTask, listTasks } from "@/services/task.service";

/**
 * Real PostgreSQL checks for Workspace isolation (IDOR/BOLA).
 *
 * Two workspaces are created for this file only. A user of workspace A must not
 * be able to read, list, update or delete records of workspace B; everything is
 * removed afterwards.
 */
const suffix = randomUUID();

let workspaceAId = "";
let workspaceBId = "";
let leadBId = "";
let contactBId = "";
let taskBId = "";
let userA: SessionUser;
let userBId = "";

beforeAll(async () => {
  const workspaceA = await prisma.workspace.create({
    data: { name: `Isolation A ${suffix}`, slug: `iso-a-${suffix}` },
  });
  const workspaceB = await prisma.workspace.create({
    data: { name: `Isolation B ${suffix}`, slug: `iso-b-${suffix}` },
  });
  workspaceAId = workspaceA.id;
  workspaceBId = workspaceB.id;

  const adminA = await prisma.user.create({
    data: {
      workspaceId: workspaceAId,
      name: "Admin A",
      email: `admin-a-${suffix}@example.test`,
      passwordHash: "not-used-in-this-test",
      role: "ADMIN",
    },
  });
  const adminB = await prisma.user.create({
    data: {
      workspaceId: workspaceBId,
      name: "Admin B",
      email: `admin-b-${suffix}@example.test`,
      passwordHash: "not-used-in-this-test",
      role: "ADMIN",
    },
  });
  userBId = adminB.id;

  userA = {
    id: adminA.id,
    name: adminA.name,
    email: adminA.email,
    role: "ADMIN",
    workspaceId: workspaceAId,
    workspaceName: workspaceA.name,
  };

  const contactB = await prisma.contact.create({
    data: {
      workspaceId: workspaceBId,
      name: `Foreign Contact ${suffix}`,
      createdById: adminB.id,
      updatedById: adminB.id,
    },
  });
  contactBId = contactB.id;

  const leadB = await prisma.lead.create({
    data: {
      workspaceId: workspaceBId,
      title: `Foreign Lead ${suffix}`,
      message: "Workspace B only",
      contactId: contactB.id,
      createdById: adminB.id,
      updatedById: adminB.id,
    },
  });
  leadBId = leadB.id;

  const taskB = await prisma.task.create({
    data: {
      workspaceId: workspaceBId,
      title: `Foreign Task ${suffix}`,
      leadId: leadB.id,
      createdById: adminB.id,
      updatedById: adminB.id,
    },
  });
  taskBId = taskB.id;
});

afterAll(async () => {
  if (taskBId) await prisma.task.deleteMany({ where: { id: taskBId } });
  if (leadBId) await prisma.lead.deleteMany({ where: { id: leadBId } });
  if (contactBId) await prisma.contact.deleteMany({ where: { id: contactBId } });
  if (workspaceBId) await prisma.user.deleteMany({ where: { workspaceId: workspaceBId } });
  if (workspaceAId) await prisma.user.deleteMany({ where: { workspaceId: workspaceAId } });
  if (workspaceBId) await prisma.workspace.deleteMany({ where: { id: workspaceBId } });
  if (workspaceAId) await prisma.workspace.deleteMany({ where: { id: workspaceAId } });
  await prisma.$disconnect();
});

describe("Workspace isolation (IDOR/BOLA)", () => {
  it("lead: get returns null for another workspace", async () => {
    await expect(getLead(userA, leadBId)).resolves.toBeNull();
  });

  it("lead: list never returns another workspace", async () => {
    const result = await listLeads(userA, {
      page: 1,
      limit: 100,
      search: suffix,
      sort: "createdAt:desc",
    });

    expect(result.items.map((item) => item.id)).not.toContain(leadBId);
  });

  it("lead: update and delete are rejected as NOT_FOUND", async () => {
    await expect(updateLead(userA, leadBId, { title: "Hijacked" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(deleteLead(userA, leadBId)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const lead = await prisma.lead.findUnique({ where: { id: leadBId } });
    expect(lead?.title).toBe(`Foreign Lead ${suffix}`);
    expect(userBId).not.toBe(userA.id);
  });

  it("contact: get returns null and list never leaks another workspace", async () => {
    await expect(getContact(userA, contactBId)).resolves.toBeNull();

    const result = await listContacts(userA, {
      page: 1,
      limit: 100,
      search: suffix,
      sort: "createdAt:desc",
    });

    expect(result.items.map((item) => item.id)).not.toContain(contactBId);
  });

  it("task: get returns null and list never leaks another workspace", async () => {
    await expect(getTask(userA, taskBId)).resolves.toBeNull();

    const result = await listTasks(userA, {
      page: 1,
      limit: 100,
      search: suffix,
      sort: "createdAt:desc",
    });

    expect(result.items.map((item) => item.id)).not.toContain(taskBId);
  });
});
