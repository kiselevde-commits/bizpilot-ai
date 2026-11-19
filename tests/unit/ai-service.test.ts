import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AIService } from "@/services/ai.service";
import { MockAIProvider } from "@/lib/ai/provider";
import type { SessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";

// Мокаем prisma перед импортом сервиса
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
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/database/prisma";

const mockUser: SessionUser = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  role: "ADMIN",
  workspaceId: "workspace-1",
  workspaceName: "Test Workspace",
};

const adminUser: SessionUser = {
  id: "admin-1",
  name: "Admin",
  email: "admin@example.com",
  role: "ADMIN",
  workspaceId: "workspace-a",
  workspaceName: "Workspace A",
};

const mockLeadId = "lead-1";

function makeService() {
  return new AIService(new MockAIProvider());
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: mockLeadId,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AIService.analyze", () => {
  it("возвращает результат анализа и сохраняет в БД", async () => {
    const service = makeService();

    const result = await service.analyze(
      { text: "Заявка на разработку CRM-системы", leadId: mockLeadId },
      mockUser,
    );

    expect(result.analysis.summary).toBeDefined();
    expect(result.analysis.leadScore).toBeGreaterThanOrEqual(0);
    expect(result.analysis.leadScore).toBeLessThanOrEqual(100);
    expect(result.provider).toBe("mock");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    expect(prisma.aIAnalysis.create).toHaveBeenCalledTimes(1);
    const createCall = (prisma.aIAnalysis.create as ReturnType<typeof vi.fn>)
      .mock.calls[0]![0];
    expect(createCall.data.provider).toBe("mock");
    expect(createCall.data.status).toBe("SUCCESS");
    expect(createCall.data.promptHash).toBeDefined();
  });

  it("валидирует непустой текст", async () => {
    const service = makeService();

    await expect(
      service.analyze({ text: "", leadId: mockLeadId }, mockUser),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      service.analyze({ text: "   ", leadId: mockLeadId }, mockUser),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("NOT_FOUND если лид не найден в workspace", async () => {
    const service = makeService();
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    await expect(
      service.analyze({ text: "Текст", leadId: "missing-lead" }, mockUser),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("AIService.generateReply", () => {
  it("возвращает черновик ответа и сохраняет в БД", async () => {
    const service = makeService();

    const result = await service.generateReply(
      { text: "Заявка на разработку", leadId: mockLeadId },
      mockUser,
    );

    expect(result.draftReply).toBeDefined();
    expect(result.draftReply.length).toBeLessThanOrEqual(800);
    expect(result.provider).toBe("mock");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    expect(prisma.aIAnalysis.create).toHaveBeenCalledTimes(1);
  });

  it("валидирует непустой текст", async () => {
    const service = makeService();

    await expect(
      service.generateReply({ text: "", leadId: mockLeadId }, mockUser),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("AIService.applyAnalysis", () => {
  const applyInput = {
    summary: "Резюме по заявке",
    leadScore: 85,
    category: "crm_integration",
    intent: "request",
    customerType: "b2b",
    priority: "HIGH",
  };

  const mockLead = {
    id: mockLeadId,
    title: "Заявка",
    status: "NEW" as const,
    priority: "MEDIUM" as const,
    category: null,
    intent: null,
    customerType: null,
    summary: null,
    leadScore: null,
    workspaceId: "workspace-1",
    createdById: "user-1",
    updatedById: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("применяет анализ в транзакции с ActivityLog", async () => {
    const service = makeService();
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockLead);

    const mockUpdated = {
      id: mockLeadId,
      title: "Заявка",
      status: "NEW" as const,
      priority: "HIGH" as const,
      summary: "Резюме по заявке",
      leadScore: 85,
      category: "crm_integration" as const,
      intent: "request" as const,
      customerType: "b2b" as const,
      updatedAt: new Date(),
    };

    const txUpdate = vi.fn().mockResolvedValue(mockUpdated);
    const txCreate = vi.fn().mockResolvedValue({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma mock type is complex; any is acceptable for test double
    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      const tx = { lead: { update: txUpdate }, activityLog: { create: txCreate } };
      return callback(tx);
    });

    const result = await service.applyAnalysis(mockLeadId, applyInput, mockUser);

    expect(result.lead.id).toBe(mockLeadId);
    expect(result.lead.priority).toBe("HIGH");
    expect(result.lead.leadScore).toBe(85);
    expect(result.lead.category).toBe("crm_integration");
    expect(result.lead.summary).toBe("Резюме по заявке");

    expect(txUpdate).toHaveBeenCalledTimes(1);
    expect(txCreate).toHaveBeenCalledTimes(1);
    const logCall = txCreate.mock.calls[0]![0].data;
    expect(logCall.entityType).toBe("lead");
    expect(logCall.action).toBe("lead.ai.applied");
    expect(logCall.workspaceId).toBe("workspace-1");
  });

  it("отклоняет несуществующий лид", async () => {
    const service = makeService();
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      service.applyAnalysis("missing-lead", applyInput, mockUser),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("отклоняет невалидную категорию (остаётся значение лида)", async () => {
    const service = makeService();
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockLead,
      category: "crm_integration" as const,
    });

    const txUpdate = vi.fn().mockResolvedValue({
      ...mockLead,
      category: "crm_integration" as const,
      updatedAt: new Date(),
    });
    const txCreate = vi.fn().mockResolvedValue({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma mock type is complex; any is acceptable for test double
    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      const tx = { lead: { update: txUpdate }, activityLog: { create: txCreate } };
      return callback(tx);
    });

    const result = await service.applyAnalysis(mockLeadId, {
      ...applyInput,
      category: "invalid_category" as const,
    }, mockUser);

    expect(result.lead.category).toBe("crm_integration" as const); // старое значение сохранено
  });

  it("отклоняет leadScore вне диапазона 0-100", async () => {
    const service = makeService();
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockLead);

    const txUpdate = vi.fn().mockResolvedValue({
      ...mockLead,
      leadScore: null,
      updatedAt: new Date(),
    });
    const txCreate = vi.fn().mockResolvedValue({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma mock type is complex; any is acceptable for test double
    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      const tx = { lead: { update: txUpdate }, activityLog: { create: txCreate } };
      return callback(tx);
    });

    // leadScore = 150 должен быть отклонён, остаётся старый (null)
    const result = await service.applyAnalysis(mockLeadId, {
      ...applyInput,
      leadScore: 150,
    }, mockUser);

    expect(result.lead.leadScore).toBeNull();
  });

  it("частичное обновление: только переданные поля меняются", async () => {
    const service = makeService();
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockLead);

    const txUpdate = vi.fn().mockResolvedValue({
      ...mockLead,
      priority: "HIGH" as const,
      updatedAt: new Date(),
    });
    const txCreate = vi.fn().mockResolvedValue({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma mock type is complex; any is acceptable for test double
    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      const tx = { lead: { update: txUpdate }, activityLog: { create: txCreate } };
      return callback(tx);
    });

    const result = await service.applyAnalysis(mockLeadId, {
      summary: null,
      leadScore: null,
      category: null,
      intent: null,
      customerType: null,
      priority: "HIGH" as const,
    } as never, mockUser);

    expect(result.lead.priority).toBe("HIGH" as const);
    // Переданный summary: null должен сбросить summary
    const updateData = txUpdate.mock.calls[0]![0].data;
    expect(updateData.summary).toBeNull();
  });
});

describe("AIService.getHistory", () => {
  it("возвращает пагинированную историю для workspace пользователя", async () => {
    const service = makeService();

    const mockItems = [
      {
        id: "a-1",
        leadId: mockLeadId,
        provider: "mock" as const,
        model: "mock" as const,
        status: "SUCCESS" as const,
        resultJson: { summary: "s" },
        promptHash: "hash1",
        tokensInput: 10,
        tokensOutput: 20,
        durationMs: 100,
        errorMessage: null,
        createdAt: new Date(),
      },
    ];

    vi.spyOn(prisma.aIAnalysis, "findMany").mockResolvedValue(mockItems);
    vi.spyOn(prisma.aIAnalysis, "count").mockResolvedValue(1);

    const result = await service.getHistory(mockUser, { page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.provider).toBe("mock" as const);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });

    const whereArg = (prisma.aIAnalysis.findMany as ReturnType<typeof vi.fn>)
      .mock.calls[0]![0].where;
    expect(whereArg.lead.workspaceId).toBe("workspace-1");
  });

  it("фильтрует по leadId если передан", async () => {
    const service = makeService();

    vi.spyOn(prisma.aIAnalysis, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.aIAnalysis, "count").mockResolvedValue(0);

    await service.getHistory(mockUser, {
      page: 1,
      limit: 20,
      leadId: mockLeadId,
    });

    const whereArg = (prisma.aIAnalysis.findMany as ReturnType<typeof vi.fn>)
      .mock.calls[0]![0].where;
    expect(whereArg.lead.id).toBe(mockLeadId);
    expect(whereArg.lead.workspaceId).toBe("workspace-1");
  });

  it("пагинация: page минимум 1, limit максимум 100", async () => {
    const service = makeService();

    vi.spyOn(prisma.aIAnalysis, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.aIAnalysis, "count").mockResolvedValue(0);

    await service.getHistory(mockUser, { page: 0, limit: 999 });

    const call = (prisma.aIAnalysis.findMany as ReturnType<typeof vi.fn>)
      .mock.calls[0]![0];
    expect(call.skip).toBe(0); // page 0 -> max(1, 0) = 1 -> skip 0
    expect(call.take).toBe(100); // limit clamped to 100
  });

  it("сортировка по createdAt DESC", async () => {
    const service = makeService();

    vi.spyOn(prisma.aIAnalysis, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.aIAnalysis, "count").mockResolvedValue(0);

    await service.getHistory(mockUser, { page: 1, limit: 20 });

    const orderBy = (prisma.aIAnalysis.findMany as ReturnType<typeof vi.fn>)
      .mock.calls[0]![0].orderBy;
    expect(orderBy).toEqual({ createdAt: "desc" });
  });
});

describe("AIService error handling (integration)", () => {
  it("AI_PROVIDER_ERROR при падении провайдера", async () => {
    const service = new AIService({
      name: "failing",
      analyze: vi.fn().mockRejectedValue(new Error("boom")),
      generateReply: vi.fn().mockRejectedValue(new Error("boom")),
    });
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: mockLeadId,
    });

    await expect(
      service.analyze({ text: "Текст", leadId: mockLeadId }, adminUser),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR" });
  });

  it("AI_INVALID_RESPONSE при невалидном JSON от провайдера", async () => {
    const service = new AIService({
      name: "bad-json",
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
      id: mockLeadId,
    });

    await expect(
      service.analyze({ text: "Текст", leadId: mockLeadId }, adminUser),
    ).rejects.toMatchObject({ code: "AI_INVALID_RESPONSE" });
  });

  it("при повторной ошибке после retry — AI_PROVIDER_ERROR", async () => {
    const analyze = vi
      .fn()
      .mockRejectedValueOnce(new Error("first fail"))
      .mockRejectedValue(new Error("second fail"));
    const service = new AIService({
      name: "retry-fail",
      analyze,
      generateReply: vi.fn().mockResolvedValue({
        result: { draftReply: "ok" },
        tokensInput: 10,
        tokensOutput: 5,
      }),
    });
    (prisma.lead.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: mockLeadId,
    });

    await expect(
      service.analyze({ text: "Текст", leadId: mockLeadId }, adminUser),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR" });

    // RETRY_COUNT = 1, значит 2 попытки всего
    expect(analyze).toHaveBeenCalledTimes(2);
  });
});