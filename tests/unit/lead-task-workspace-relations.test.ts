import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/session";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    lead: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    task: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    contact: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    automationEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/services/automation.service", () => ({
  queueAutomationDispatch: vi.fn(),
}));

import { prisma } from "@/lib/database/prisma";
import { createLead, updateLead } from "@/services/lead.service";
import { createTask, updateTask } from "@/services/task.service";

type MockFn = ReturnType<typeof vi.fn>;

type PrismaMock = {
  lead: {
    findFirst: MockFn;
    create: MockFn;
    update: MockFn;
  };
  task: {
    findFirst: MockFn;
    create: MockFn;
    update: MockFn;
  };
  contact: {
    findFirst: MockFn;
  };
  user: {
    findFirst: MockFn;
  };
  activityLog: {
    create: MockFn;
  };
  automationEvent: {
    create: MockFn;
  };
  $transaction: MockFn;
};

const prismaMock = prisma as unknown as PrismaMock;

const WORKSPACE_A = "workspace-a";
const WORKSPACE_B = "workspace-b";
const USER_A = "user-a";
const USER_B = "user-b";
const CONTACT_A = "contact-a";
const CONTACT_B = "contact-b";
const LEAD_A = "lead-a";
const LEAD_B = "lead-b";
const TASK_A = "task-a";

const userA: SessionUser = {
  id: USER_A,
  name: "User A",
  email: "user-a@example.test",
  role: "ADMIN",
  workspaceId: WORKSPACE_A,
  workspaceName: "Workspace A",
};

const contactOwners = new Map<string, string>([
  [CONTACT_A, WORKSPACE_A],
  [CONTACT_B, WORKSPACE_B],
]);
const userOwners = new Map<string, string>([
  [USER_A, WORKSPACE_A],
  [USER_B, WORKSPACE_B],
]);
const leadOwners = new Map<string, string>([
  [LEAD_A, WORKSPACE_A],
  [LEAD_B, WORKSPACE_B],
]);

type Where = {
  id?: string;
  workspaceId?: string;
};

function findOwned(owners: ReadonlyMap<string, string>, where: Where): boolean {
  return where.id !== undefined && owners.get(where.id) === where.workspaceId;
}

function leadRow(id: string) {
  return {
    id,
    title: "Lead",
    message: "Message",
    source: null,
    status: "NEW",
    priority: "MEDIUM",
    category: null,
    intent: null,
    customerType: null,
    summary: null,
    leadScore: null,
    scoreBreakdown: null,
    contactId: null,
    assignedToId: null,
    workspaceId: WORKSPACE_A,
    createdById: USER_A,
    updatedById: USER_A,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function taskRow(id: string) {
  return {
    id,
    title: "Task",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    dueDate: null,
    assignedToId: null,
    leadId: null,
    contactId: null,
    workspaceId: WORKSPACE_A,
    createdById: USER_A,
    updatedById: USER_A,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function lastWriteData(mock: MockFn): Record<string, unknown> {
  const call = mock.mock.calls.at(-1)?.[0] as { data?: Record<string, unknown> } | undefined;

  return call?.data ?? {};
}

function expectNoLeadWrites(): void {
  expect(prismaMock.lead.create).not.toHaveBeenCalled();
  expect(prismaMock.lead.update).not.toHaveBeenCalled();
  expect(prismaMock.activityLog.create).not.toHaveBeenCalled();
  expect(prismaMock.automationEvent.create).not.toHaveBeenCalled();
}

function expectNoTaskWrites(): void {
  expect(prismaMock.task.create).not.toHaveBeenCalled();
  expect(prismaMock.task.update).not.toHaveBeenCalled();
  expect(prismaMock.activityLog.create).not.toHaveBeenCalled();
  expect(prismaMock.automationEvent.create).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();

  prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: PrismaMock) => Promise<unknown>)(prismaMock);
    }

    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }

    return arg;
  });

  prismaMock.contact.findFirst.mockImplementation(async ({ where }: { where: Where }) =>
    findOwned(contactOwners, where) ? { id: where.id } : null,
  );
  prismaMock.user.findFirst.mockImplementation(async ({ where }: { where: Where }) =>
    findOwned(userOwners, where) ? { id: where.id } : null,
  );
  prismaMock.lead.findFirst.mockImplementation(async ({ where }: { where: Where }) =>
    findOwned(leadOwners, where) ? leadRow(where.id ?? "") : null,
  );
  prismaMock.task.findFirst.mockImplementation(async ({ where }: { where: Where }) =>
    where.id === TASK_A && where.workspaceId === WORKSPACE_A ? taskRow(TASK_A) : null,
  );

  prismaMock.lead.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      ...leadRow(LEAD_A),
      ...data,
    }),
  );
  prismaMock.lead.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      ...leadRow(LEAD_A),
      ...data,
    }),
  );
  prismaMock.task.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      ...taskRow(TASK_A),
      ...data,
    }),
  );
  prismaMock.task.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      ...taskRow(TASK_A),
      ...data,
    }),
  );

  prismaMock.activityLog.create.mockResolvedValue({});
  prismaMock.automationEvent.create.mockResolvedValue({});
});

describe("Lead Workspace relation checks", () => {
  it("creates a Lead with a Contact from the same Workspace", async () => {
    const lead = await createLead(userA, {
      title: "New lead",
      message: "Message",
      contactId: CONTACT_A,
    });

    expect(lead.id).toBe(LEAD_A);
    expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
      where: { id: CONTACT_A, workspaceId: WORKSPACE_A },
      select: { id: true },
    });
    expect(lastWriteData(prismaMock.lead.create)).toMatchObject({
      contactId: CONTACT_A,
      workspaceId: WORKSPACE_A,
    });
    expect(prismaMock.activityLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.automationEvent.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a Contact from another Workspace on create", async () => {
    await expect(
      createLead(userA, {
        title: "New lead",
        message: "Message",
        contactId: CONTACT_B,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
      where: { id: CONTACT_B, workspaceId: WORKSPACE_A },
      select: { id: true },
    });
    expectNoLeadWrites();
  });

  it("rejects an assignee from another Workspace on create", async () => {
    await expect(
      createLead(userA, {
        title: "New lead",
        message: "Message",
        assignedToId: USER_B,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { id: USER_B, workspaceId: WORKSPACE_A },
      select: { id: true },
    });
    expectNoLeadWrites();
  });

  it("rejects a Contact from another Workspace on update without side effects", async () => {
    await expect(updateLead(userA, LEAD_A, { contactId: CONTACT_B })).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });

    expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
      where: { id: CONTACT_B, workspaceId: WORKSPACE_A },
      select: { id: true },
    });
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
    expect(prismaMock.activityLog.create).not.toHaveBeenCalled();
    expect(prismaMock.automationEvent.create).not.toHaveBeenCalled();
  });

  it("rejects an assignee from another Workspace on update without side effects", async () => {
    await expect(updateLead(userA, LEAD_A, { assignedToId: USER_B })).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { id: USER_B, workspaceId: WORKSPACE_A },
      select: { id: true },
    });
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
    expect(prismaMock.activityLog.create).not.toHaveBeenCalled();
    expect(prismaMock.automationEvent.create).not.toHaveBeenCalled();
  });

  it.each([
    ["contactId", "missing-contact"],
    ["assignedToId", "missing-user"],
  ])("rejects a non-existent Lead %s", async (field, value) => {
    await expect(
      createLead(userA, {
        title: "New lead",
        message: "Message",
        [field]: value,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expectNoLeadWrites();
  });

  it("keeps valid Lead relations inside the Workspace on update", async () => {
    await updateLead(userA, LEAD_A, {
      contactId: CONTACT_A,
      assignedToId: USER_A,
    });

    expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
      where: { id: CONTACT_A, workspaceId: WORKSPACE_A },
      select: { id: true },
    });
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { id: USER_A, workspaceId: WORKSPACE_A },
      select: { id: true },
    });
    expect(lastWriteData(prismaMock.lead.update)).toMatchObject({
      contactId: CONTACT_A,
      assignedToId: USER_A,
    });
    expect(prismaMock.activityLog.create).toHaveBeenCalledTimes(1);
  });

  it("does not change omitted Lead relations on PATCH", async () => {
    await updateLead(userA, LEAD_A, { title: "Updated title" });

    const data = lastWriteData(prismaMock.lead.update);
    expect(data).not.toHaveProperty("contactId");
    expect(data).not.toHaveProperty("assignedToId");
    expect(prismaMock.contact.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("clears optional Lead relations with explicit null", async () => {
    await updateLead(userA, LEAD_A, {
      contactId: null,
      assignedToId: null,
    });

    expect(lastWriteData(prismaMock.lead.update)).toMatchObject({
      contactId: null,
      assignedToId: null,
    });
    expect(prismaMock.contact.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });
});

describe("Task Workspace relation checks", () => {
  it("creates a Task with Lead, Contact and assignee from the same Workspace", async () => {
    const task = await createTask(userA, {
      title: "New task",
      leadId: LEAD_A,
      contactId: CONTACT_A,
      assignedToId: USER_A,
    });

    expect(task.id).toBe(TASK_A);
    expect(prismaMock.lead.findFirst).toHaveBeenCalledWith({
      where: { id: LEAD_A, workspaceId: WORKSPACE_A },
      select: { id: true },
    });
    expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
      where: { id: CONTACT_A, workspaceId: WORKSPACE_A },
      select: { id: true },
    });
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { id: USER_A, workspaceId: WORKSPACE_A },
      select: { id: true },
    });
    expect(lastWriteData(prismaMock.task.create)).toMatchObject({
      leadId: LEAD_A,
      contactId: CONTACT_A,
      assignedToId: USER_A,
      workspaceId: WORKSPACE_A,
    });
    expect(prismaMock.activityLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.automationEvent.create).not.toHaveBeenCalled();
  });

  it("rejects a Lead from another Workspace on create", async () => {
    await expect(
      createTask(userA, {
        title: "New task",
        leadId: LEAD_B,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(prismaMock.lead.findFirst).toHaveBeenCalledWith({
      where: { id: LEAD_B, workspaceId: WORKSPACE_A },
      select: { id: true },
    });
    expectNoTaskWrites();
  });

  it("rejects a Contact from another Workspace on create", async () => {
    await expect(
      createTask(userA, {
        title: "New task",
        contactId: CONTACT_B,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
      where: { id: CONTACT_B, workspaceId: WORKSPACE_A },
      select: { id: true },
    });
    expectNoTaskWrites();
  });

  it("rejects an assignee from another Workspace on create", async () => {
    await expect(
      createTask(userA, {
        title: "New task",
        assignedToId: USER_B,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { id: USER_B, workspaceId: WORKSPACE_A },
      select: { id: true },
    });
    expectNoTaskWrites();
  });

  it.each([
    ["leadId", LEAD_B],
    ["contactId", CONTACT_B],
    ["assignedToId", USER_B],
  ])("rejects a foreign %s on update without side effects", async (field, value) => {
    await expect(updateTask(userA, TASK_A, { [field]: value })).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });

    expect(prismaMock.task.update).not.toHaveBeenCalled();
    expect(prismaMock.activityLog.create).not.toHaveBeenCalled();
  });

  it.each([
    ["leadId", "missing-lead"],
    ["contactId", "missing-contact"],
    ["assignedToId", "missing-user"],
  ])("rejects a non-existent Task %s", async (field, value) => {
    await expect(
      createTask(userA, {
        title: "New task",
        [field]: value,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expectNoTaskWrites();
  });

  it("keeps valid Task relations inside the Workspace on update", async () => {
    await updateTask(userA, TASK_A, {
      leadId: LEAD_A,
      contactId: CONTACT_A,
      assignedToId: USER_A,
    });

    expect(prismaMock.lead.findFirst).toHaveBeenCalledWith({
      where: { id: LEAD_A, workspaceId: WORKSPACE_A },
      select: { id: true },
    });
    expect(prismaMock.contact.findFirst).toHaveBeenCalledWith({
      where: { id: CONTACT_A, workspaceId: WORKSPACE_A },
      select: { id: true },
    });
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { id: USER_A, workspaceId: WORKSPACE_A },
      select: { id: true },
    });
    expect(lastWriteData(prismaMock.task.update)).toMatchObject({
      leadId: LEAD_A,
      contactId: CONTACT_A,
      assignedToId: USER_A,
    });
    expect(prismaMock.activityLog.create).toHaveBeenCalledTimes(1);
  });

  it("does not change omitted Task relations on PATCH", async () => {
    await updateTask(userA, TASK_A, { title: "Updated title" });

    const data = lastWriteData(prismaMock.task.update);
    expect(data).not.toHaveProperty("leadId");
    expect(data).not.toHaveProperty("contactId");
    expect(data).not.toHaveProperty("assignedToId");
    expect(prismaMock.lead.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.contact.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("clears optional Task relations with explicit null", async () => {
    await updateTask(userA, TASK_A, {
      leadId: null,
      contactId: null,
      assignedToId: null,
    });

    expect(lastWriteData(prismaMock.task.update)).toMatchObject({
      leadId: null,
      contactId: null,
      assignedToId: null,
    });
    expect(prismaMock.lead.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.contact.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });
});
