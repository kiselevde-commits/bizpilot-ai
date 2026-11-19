import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import type { AIAnalysisResult, AIProvider } from "@/lib/ai/provider";
import {
  AIAnalysisResponseSchema,
  type AIAnalysisResponse,
  GenerateReplyResponseSchema,
  type GenerateReplyResponse,
  MAX_LEAD_SCORE,
  MIN_LEAD_SCORE,
} from "@/lib/ai/schema";
import {
  computePromptHash,
  buildSystemPrompt,
  buildReplySystemPrompt,
  wrapUserInput,
} from "@/lib/ai/prompt";

const MAX_ANALYZE_TEXT_LENGTH = 20000;
const MAX_REPLY_TEXT_LENGTH = 20000;
const MAX_OUTPUT_TOKENS = 4000;
const RETRY_COUNT = 1;

export type AnalyzeInput = {
  text: string;
  leadId: string;
};

export type ApplyAnalysisInput = {
  summary: string | null;
  leadScore: number | null;
  category: string | null;
  intent: string | null;
  customerType: string | null;
  priority: string | null;
};

const LEAD_CATEGORIES = [
  "business_automation",
  "crm_integration",
  "ai_bot",
  "document_flow",
  "web_app",
  "other",
] as const;

const LEAD_INTENTS = ["request", "question", "complaint", "info", "other"] as const;

const CUSTOMER_TYPES = ["b2b", "b2c", "b2g", "unknown"] as const;

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export type GenerateReplyInput = {
  text: string;
  leadId: string;
};

export type AIHistoryItem = {
  id: string;
  leadId: string;
  provider: string;
  model: string;
  status: string;
  resultJson: unknown;
  promptHash: string;
  tokensInput: number | null;
  tokensOutput: number | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: Date;
};

export type AIHistoryResult = {
  items: AIHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export class AIService {
  constructor(private readonly provider?: AIProvider) {}

  async analyze(input: AnalyzeInput, user: SessionUser): Promise<{
    analysis: AIAnalysisResult;
    rawResponse: AIAnalysisResponse;
    tokensInput: number | null;
    tokensOutput: number | null;
    durationMs: number;
    provider: string;
    model: string;
  }> {
    if (!input.text || input.text.trim().length === 0) {
      throw new AppError("VALIDATION_ERROR", "Текст для анализа обязателен");
    }

    if (input.text.length > MAX_ANALYZE_TEXT_LENGTH) {
      throw new AppError("VALIDATION_ERROR", "Текст слишком длинный");
    }

    if (input.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: input.leadId, workspaceId: user.workspaceId },
        select: { id: true },
      });

      if (!lead) {
        throw new AppError("NOT_FOUND", "Заявка не найдена");
      }
    }

    const systemPrompt = buildSystemPrompt();
    const wrapped = wrapUserInput(input.text);
    const fullPrompt = `${systemPrompt}\n${wrapped}`;
    const promptHash = computePromptHash(fullPrompt);
    const provider = this.requireProvider();

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
      const start = Date.now();

      try {
        const providerResult = await provider.analyze({
          text: wrapped,
          systemPrompt,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        });

        const durationMs = Date.now() - start;

        let parsed: AIAnalysisResponse;
        try {
          parsed = AIAnalysisResponseSchema.parse(providerResult.result);
        } catch (cause) {
          if (attempt < RETRY_COUNT) {
            lastError = cause;
            continue;
          }
          throw new AppError("AI_INVALID_RESPONSE", "Некорректный ответ от AI-провайдера", {
            details: { cause: cause instanceof Error ? cause.message : String(cause) },
          });
        }

        await this.saveAnalysis({
          user,
          leadId: input.leadId,
          provider: provider.name,
          model: this.getModel(),
          status: "SUCCESS",
          resultJson: parsed,
          promptHash,
          tokensInput: providerResult.tokensInput ?? null,
          tokensOutput: providerResult.tokensOutput ?? null,
          durationMs,
          errorMessage: null,
        });

        return {
          analysis: parsed,
          rawResponse: parsed,
          tokensInput: providerResult.tokensInput ?? null,
          tokensOutput: providerResult.tokensOutput ?? null,
          durationMs,
          provider: provider.name,
          model: this.getModel(),
        };
      } catch (error) {
        const durationMs = Date.now() - start;

        if (error instanceof AppError) {
          throw error;
        }

        if (error instanceof DOMException && error.name === "AbortError") {
          lastError = error;
          if (attempt < RETRY_COUNT) {
            continue;
          }
          throw new AppError("AI_TIMEOUT", "Превышен таймаут запроса к AI-провайдеру", {
            details: { durationMs },
          });
        }

        lastError = error;

        if (attempt < RETRY_COUNT && this.isRetryableProviderError(error)) {
          continue;
        }

        throw new AppError("AI_PROVIDER_ERROR", "Ошибка AI-провайдера", {
          details: { cause: error instanceof Error ? error.message : String(error) },
        });
      }
    }

    throw new AppError("AI_PROVIDER_ERROR", "Ошибка AI-провайдера", {
      details: { cause: lastError instanceof Error ? lastError.message : String(lastError) },
    });
  }

  async generateReply(
    input: GenerateReplyInput,
    user: SessionUser,
  ): Promise<{
    draftReply: string;
    tokensInput: number | null;
    tokensOutput: number | null;
    durationMs: number;
    provider: string;
    model: string;
  }> {
    if (!input.text || input.text.trim().length === 0) {
      throw new AppError("VALIDATION_ERROR", "Текст для генерации ответа обязателен");
    }

    if (input.text.length > MAX_REPLY_TEXT_LENGTH) {
      throw new AppError("VALIDATION_ERROR", "Текст слишком длинный");
    }

    if (input.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: input.leadId, workspaceId: user.workspaceId },
        select: { id: true },
      });

      if (!lead) {
        throw new AppError("NOT_FOUND", "Заявка не найдена");
      }
    }

    const systemPrompt = buildReplySystemPrompt();
    const wrapped = wrapUserInput(input.text);
    const fullPrompt = `${systemPrompt}\n${wrapped}`;
    const promptHash = computePromptHash(fullPrompt);
    const provider = this.requireProvider();

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
      const start = Date.now();

      try {
        const providerResult = await provider.generateReply({
          text: wrapped,
          systemPrompt,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        });

        const durationMs = Date.now() - start;

        let parsed: GenerateReplyResponse;
        try {
          parsed = GenerateReplyResponseSchema.parse(providerResult.result);
        } catch (cause) {
          if (attempt < RETRY_COUNT) {
            lastError = cause;
            continue;
          }
          throw new AppError("AI_INVALID_RESPONSE", "Некорректный ответ от AI-провайдера", {
            details: { cause: cause instanceof Error ? cause.message : String(cause) },
          });
        }

        await this.saveAnalysis({
          user,
          leadId: input.leadId,
          provider: provider.name,
          model: this.getModel(),
          status: "SUCCESS",
          resultJson: parsed,
          promptHash,
          tokensInput: providerResult.tokensInput ?? null,
          tokensOutput: providerResult.tokensOutput ?? null,
          durationMs,
          errorMessage: null,
        });

        return {
          draftReply: parsed.draftReply,
          tokensInput: providerResult.tokensInput ?? null,
          tokensOutput: providerResult.tokensOutput ?? null,
          durationMs,
          provider: provider.name,
          model: this.getModel(),
        };
      } catch (error) {
        const durationMs = Date.now() - start;

        if (error instanceof AppError) {
          throw error;
        }

        if (error instanceof DOMException && error.name === "AbortError") {
          lastError = error;
          if (attempt < RETRY_COUNT) {
            continue;
          }
          throw new AppError("AI_TIMEOUT", "Превышен таймаут запроса к AI-провайдеру", {
            details: { durationMs },
          });
        }

        lastError = error;

        if (attempt < RETRY_COUNT && this.isRetryableProviderError(error)) {
          continue;
        }

        throw new AppError("AI_PROVIDER_ERROR", "Ошибка AI-провайдера", {
          details: { cause: error instanceof Error ? error.message : String(error) },
        });
      }
    }

    throw new AppError("AI_PROVIDER_ERROR", "Ошибка AI-провайдера", {
      details: { cause: lastError instanceof Error ? lastError.message : String(lastError) },
    });
  }

  async applyAnalysis(
    leadId: string,
    input: ApplyAnalysisInput,
    user: SessionUser,
  ): Promise<{
    lead: {
      id: string;
      title: string;
      status: string;
      priority: string;
      summary: string | null;
      leadScore: number | null;
      category: string | null;
      intent: string | null;
      customerType: string | null;
      updatedAt: Date;
    };
  }> {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, workspaceId: user.workspaceId },
    });

    if (!lead) {
      throw new AppError("NOT_FOUND", "Заявка не найдена");
    }

    const priority =
      input.priority !== undefined && input.priority !== null
        ? (PRIORITIES as readonly string[]).includes(input.priority)
          ? input.priority
          : lead.priority
        : lead.priority;

    const category =
      input.category !== undefined && input.category !== null
        ? (LEAD_CATEGORIES as readonly string[]).includes(input.category)
          ? (input.category as NonNullable<typeof lead.category>)
          : lead.category
        : lead.category;

    const intent =
      input.intent !== undefined && input.intent !== null
        ? (LEAD_INTENTS as readonly string[]).includes(input.intent)
          ? (input.intent as NonNullable<typeof lead.intent>)
          : lead.intent
        : lead.intent;

    const customerType =
      input.customerType !== undefined && input.customerType !== null
        ? (CUSTOMER_TYPES as readonly string[]).includes(input.customerType)
          ? (input.customerType as NonNullable<typeof lead.customerType>)
          : lead.customerType
        : lead.customerType;

    const leadScore =
      input.leadScore !== undefined && input.leadScore !== null
        ? typeof input.leadScore === "number" &&
          input.leadScore >= MIN_LEAD_SCORE &&
          input.leadScore <= MAX_LEAD_SCORE
          ? input.leadScore
          : lead.leadScore
        : lead.leadScore;

    const summary =
      input.summary !== undefined ? input.summary ?? null : lead.summary;

    const updated = await prisma.$transaction(async (tx) => {
      const leadUpdated = await tx.lead.update({
        where: { id: leadId },
        data: {
          summary,
          leadScore,
          category,
          intent,
          customerType,
          priority: priority as NonNullable<typeof lead.priority>,
          updatedById: user.id,
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId: user.workspaceId,
          entityType: "lead",
          entityId: leadId,
          action: "lead.ai.applied",
          actorId: user.id,
          metadata: {
            summary: input.summary !== undefined,
            leadScore: input.leadScore !== undefined,
            category: input.category !== undefined,
            intent: input.intent !== undefined,
            customerType: input.customerType !== undefined,
            priority: input.priority !== undefined,
          },
        },
      });

      return leadUpdated;
    });

    return {
      lead: {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        priority: updated.priority,
        summary: updated.summary,
        leadScore: updated.leadScore,
        category: updated.category,
        intent: updated.intent,
        customerType: updated.customerType,
        updatedAt: updated.updatedAt,
      },
    };
  }

  async getHistory(
    user: SessionUser,
    query: { page?: number; limit?: number; leadId?: string | null },
  ): Promise<AIHistoryResult> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AIAnalysisWhereInput = {
      lead: {
        workspaceId: user.workspaceId,
        ...(query.leadId ? { id: query.leadId } : {}),
      },
    };

    const [itemsRaw, total] = await Promise.all([
      prisma.aIAnalysis.findMany({
        where,
        select: {
          id: true,
          leadId: true,
          provider: true,
          model: true,
          status: true,
          resultJson: true,
          promptHash: true,
          tokensInput: true,
          tokensOutput: true,
          durationMs: true,
          errorMessage: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.aIAnalysis.count({ where }),
    ]);

    const items: AIHistoryItem[] = itemsRaw.map((row: { id: string; leadId: string; provider: string; model: string; status: string; resultJson: unknown; promptHash: string; tokensInput: number | null; tokensOutput: number | null; durationMs: number | null; errorMessage: string | null; createdAt: Date }) => ({
      id: row.id,
      leadId: row.leadId,
      provider: row.provider,
      model: row.model,
      status: row.status,
      resultJson: row.resultJson,
      promptHash: row.promptHash,
      tokensInput: row.tokensInput,
      tokensOutput: row.tokensOutput,
      durationMs: row.durationMs,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
    }));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private requireProvider(): AIProvider {
    if (!this.provider) {
      throw new AppError("AI_NOT_CONFIGURED", "AI provider is not configured");
    }

    return this.provider;
  }

  private getModel(): string {
    return this.provider?.name ?? "unknown";
  }

  private isRetryableProviderError(error: unknown): boolean {
    if (error instanceof AppError) {
      return false;
    }
    return true;
  }

  private async saveAnalysis(input: {
    user: SessionUser;
    leadId: string;
    provider: string;
    model: string;
    status: "SUCCESS" | "FAILED";
    resultJson: unknown;
    promptHash: string;
    tokensInput: number | null;
    tokensOutput: number | null;
    durationMs: number;
    errorMessage: string | null;
  }): Promise<void> {
    await prisma.aIAnalysis.create({
      data: {
        lead: {
          connect: { id: input.leadId },
        },
        provider: input.provider,
        model: input.model,
        status: input.status,
        resultJson: input.resultJson as unknown as Prisma.InputJsonValue,
        promptHash: input.promptHash,
        tokensInput: input.tokensInput,
        tokensOutput: input.tokensOutput,
        durationMs: input.durationMs,
        errorMessage: input.errorMessage,
      },
    });
  }
}
