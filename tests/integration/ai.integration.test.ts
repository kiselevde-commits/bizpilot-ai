import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AIService } from "@/services/ai.service";
import { MockAIProvider } from "@/lib/ai/provider";
import type { SessionUser } from "@/lib/auth/session";
vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    lead: {
      findFirst: vi.fn(),
    },
    aIAnalysis: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    automationEvent: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/database/prisma";

const adminUser: SessionUser = {
  id: "admin-1",
  name: "Admin",
  email: "admin@example.com",
  role: "ADMIN",
  workspaceId: "workspace-a",
  workspaceName: "Workspace A",
};

const workspaceBUser: SessionUser = {
  id: "user-b",
  name: "User B",
  email: "user-b@example.com",
  role: "OPERATOR",
  workspaceId: "workspace-b",
  workspaceName: "Workspace B",
};

const leadIdA = "lead-a";

function makeService() {
  return new AIService(new MockAIProvider());
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AIService Workspace Isolation (integration)", () => {
  it("analyze: лид из чужого workspace не найден (404)", async () => {
    const service = makeService();

    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      service.analyze({ text: "Текст", leadId: leadIdA }, workspaceBUser),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const findCall = (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(findCall.where.workspaceId).toBe("workspace-b");
  });

  it("generateReply: лид из чужого workspace не найден (404)", async () => {
    const service = makeService();
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      service.generateReply({ text: "Текст", leadId: leadIdA }, workspaceBUser),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const findCall = (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(findCall.where.workspaceId).toBe("workspace-b");
  });

  it("applyAnalysis: лид из чужого workspace не найден (404)", async () => {
    const service = makeService();
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      service.applyAnalysis(leadIdA, { priority: "HIGH" } as never, workspaceBUser),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const findCall = (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(findCall.where.workspaceId).toBe("workspace-b");
  });

  it("getHistory: только анализы своего workspace", async () => {
    const service = makeService();

    vi.spyOn(prisma.aIAnalysis, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.aIAnalysis, "count").mockResolvedValue(0);

    await service.getHistory(workspaceBUser, { page: 1, limit: 20 });

    const whereArg = (prisma.aIAnalysis.findMany as ReturnType<typeof vi.fn>).mock.calls[0]![0]
      .where;
    expect(whereArg.lead.workspaceId).toBe("workspace-b");
    expect(whereArg.lead.workspaceId).not.toBe("workspace-a");
  });

  it("saveAnalysis: запись привязана к лиду своего workspace", async () => {
    const service = makeService();
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: leadIdA,
      workspaceId: "workspace-a",
    });

    await service.analyze({ text: "Текст", leadId: leadIdA }, adminUser);

    const createCall = (prisma.aIAnalysis.create as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(createCall.data.lead.connect.id).toBe(leadIdA);
  });
});

describe("AIService error handling (integration)", () => {
  it("AI_PROVIDER_ERROR при падении провайдера", async () => {
    const service = new AIService({
      name: "failing",
      model: "failing-model",
      analyze: vi.fn().mockRejectedValue(new Error("boom")),
      generateReply: vi.fn().mockRejectedValue(new Error("boom")),
    });
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: leadIdA,
    });

    await expect(
      service.analyze({ text: "Текст", leadId: leadIdA }, adminUser),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR" });
  });

  it("AI_INVALID_RESPONSE при невалидном JSON от провайдера", async () => {
    const service = new AIService({
      name: "bad-json",
      model: "bad-json-model",
      analyze: vi.fn().mockResolvedValue({
        result: { summary: "no leadScore" },
        tokensInput: 10,
        tokensOutput: 5,
      }),
      generateReply: vi.fn().mockResolvedValue({
        result: { draftReply: "ok" },
        tokensInput: 10,
        tokensOutput: 5,
      }),
    });
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: leadIdA,
    });

    await expect(
      service.analyze({ text: "Текст", leadId: leadIdA }, adminUser),
    ).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
  });

  it("при повторной ошибке после retry — AI_PROVIDER_ERROR", async () => {
    const analyze = vi
      .fn()
      .mockRejectedValueOnce(new Error("first fail"))
      .mockRejectedValue(new Error("second fail"));
    const service = new AIService({
      name: "retry-fail",
      model: "retry-model",
      analyze,
      generateReply: vi.fn().mockResolvedValue({
        result: { draftReply: "ok" },
        tokensInput: 10,
        tokensOutput: 5,
      }),
    });
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: leadIdA,
    });

    await expect(
      service.analyze({ text: "Текст", leadId: leadIdA }, adminUser),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR" });

    // RETRY_COUNT = 1, значит 2 попытки всего
    expect(analyze).toHaveBeenCalledTimes(2);
  });
});
