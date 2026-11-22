import "server-only";
import { AppError } from "@/lib/errors";
import type { LeadCategoryValue, LeadIntentValue, PriorityValue } from "@/lib/constants";
import type { ExtractedContacts } from "@/lib/ai/schema";

export type AIAnalysisResult = {
  summary: string;
  leadScore: number;
  category: LeadCategoryValue;
  intent: LeadIntentValue;
  priority: PriorityValue;
  scoreBreakdown: Record<string, number>;
  justification: string;
  factors: string[];
  recommendations: string[];
  risks: string[];
  missingInfo: string[];
  extractedContacts?: ExtractedContacts | null;
};

export type GenerateReplyResult = {
  draftReply: string;
};

export type AIProviderConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
};

export type AIProviderSettings = {
  baseUrl?: string | null;
  apiKey?: string | null;
  model?: string | null;
};

function normalizeSetting(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function missingAISettings(settings: AIProviderSettings): string[] {
  const missing: string[] = [];

  if (normalizeSetting(settings.baseUrl).length === 0) missing.push("AI_BASE_URL");
  if (normalizeSetting(settings.apiKey).length === 0) missing.push("AI_API_KEY");
  if (normalizeSetting(settings.model).length === 0) missing.push("AI_MODEL");

  return missing;
}

/**
 * Single source of truth for "is the AI provider configured".
 *
 * Whitespace-only values count as missing, so the public health endpoint and
 * the runtime provider can never disagree about an unusable configuration.
 */
export function isAIProviderConfigured(settings: AIProviderSettings): boolean {
  return missingAISettings(settings).length === 0;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;

  analyze(input: {
    text: string;
    systemPrompt: string;
    maxOutputTokens: number;
  }): Promise<{ result: AIAnalysisResult; tokensInput?: number; tokensOutput?: number }>;

  generateReply(input: {
    text: string;
    systemPrompt: string;
    maxOutputTokens: number;
  }): Promise<{ result: GenerateReplyResult; tokensInput?: number; tokensOutput?: number }>;
}

export class AIProviderError extends Error {
  readonly status?: number;

  constructor(message: string, options?: { status?: number; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = "AIProviderError";
    this.status = options?.status;
  }
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const candidate = fenced?.[1] ? fenced[1] : trimmed;

  try {
    return JSON.parse(candidate) as unknown;
  } catch (cause) {
    throw new AIProviderError("AI provider returned invalid JSON", { cause });
  }
}

/**
 * Extracts contact data that is explicitly present in the text.
 *
 * Used by the mock provider so E2E tests exercise the same "contacts are only
 * shown when they exist in the source" behaviour as a real model. The service
 * re-checks every value against the source text before saving.
 */
function extractContactsFromText(text: string): ExtractedContacts | undefined {
  const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(text)?.[0] ?? null;

  const phone =
    text
      .match(/\+?\d[\d\s()\-]{8,}\d/g)
      ?.map((candidate) => candidate.trim())
      .find((candidate) => {
        const digits = candidate.replace(/\D/g, "");
        return digits.length >= 10 && digits.length <= 15;
      }) ?? null;

  if (!email && !phone) {
    return undefined;
  }

  return { name: null, company: null, email, phone };
}

export function buildAIProvider(config: AIProviderConfig, mock: boolean): AIProvider {
  if (mock) {
    return new MockAIProvider();
  }

  const missing = missingAISettings(config);

  if (missing.length > 0) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      `AI provider configuration is incomplete: ${missing.join(", ")}`,
    );
  }

  return new OpenAICompatibleProvider({
    ...config,
    baseUrl: config.baseUrl.trim().replace(/\/+$/, ""),
    apiKey: config.apiKey.trim(),
    model: config.model.trim(),
  });
}

export class MockAIProvider implements AIProvider {
  readonly name = "mock";
  readonly model = "mock";

  async analyze(input: {
    text: string;
    systemPrompt: string;
    maxOutputTokens: number;
  }): Promise<{ result: AIAnalysisResult; tokensInput?: number; tokensOutput?: number }> {
    const textLength = input.text.length;

    return {
      result: {
        summary: `Мок-анализ текста длиной ${textLength} символов`,
        leadScore: 50,
        category: "business_automation",
        intent: "request",
        priority: "MEDIUM",
        scoreBreakdown: { relevance: 50, urgency: 50 },
        justification: "Моковый результат для разработки и тестирования",
        factors: ["Текст заявки получен", "Моковый провайдер"],
        recommendations: ["Связаться с клиентом", "Уточнить требования"],
        risks: ["Недостаточно данных для точной оценки"],
        missingInfo: ["Контактное лицо", "Бюджет"],
        extractedContacts: extractContactsFromText(input.text),
      },
      tokensInput: Math.ceil(input.text.length / 4),
      tokensOutput: 50,
    };
  }

  async generateReply(input: {
    text: string;
    systemPrompt: string;
    maxOutputTokens: number;
  }): Promise<{ result: GenerateReplyResult; tokensInput?: number; tokensOutput?: number }> {
    return {
      result: {
        draftReply: `Благодарим за заявку. Мы получили ваше сообщение длиной ${input.text.length} символов и свяжемся с вами в ближайшее время.`,
      },
      tokensInput: Math.ceil(input.text.length / 4),
      tokensOutput: 30,
    };
  }
}

class OpenAICompatibleProvider implements AIProvider {
  readonly name = "openai-compatible";

  constructor(private readonly config: AIProviderConfig) {}

  get model(): string {
    return this.config.model;
  }

  private async request(path: string, body: unknown): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch(`${this.config.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      return res;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async analyze(input: {
    text: string;
    systemPrompt: string;
    maxOutputTokens: number;
  }): Promise<{ result: AIAnalysisResult; tokensInput?: number; tokensOutput?: number }> {
    const res = await this.request("/chat/completions", {
      model: this.config.model,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: `<<<USER_INPUT>>>\n${input.text}\n<<<END_USER_INPUT>>>` },
      ],
      temperature: 0.2,
      max_tokens: input.maxOutputTokens,
      response_format: { type: "json_object" },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new AIProviderError(`AI provider error: ${res.status} ${text}`, { status: res.status });
    }

    const data = await res.json();

    const content = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? "";

    if (!content) {
      throw new AIProviderError("AI provider returned empty response");
    }

    const parsed = parseJsonContent(content);

    return {
      result: parsed as AIAnalysisResult,
      tokensInput: data.usage?.prompt_tokens,
      tokensOutput: data.usage?.completion_tokens,
    };
  }

  async generateReply(input: {
    text: string;
    systemPrompt: string;
    maxOutputTokens: number;
  }): Promise<{ result: GenerateReplyResult; tokensInput?: number; tokensOutput?: number }> {
    const res = await this.request("/chat/completions", {
      model: this.config.model,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: `<<<USER_INPUT>>>\n${input.text}\n<<<END_USER_INPUT>>>` },
      ],
      temperature: 0.3,
      max_tokens: input.maxOutputTokens,
      response_format: { type: "json_object" },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new AIProviderError(`AI provider error: ${res.status} ${text}`, { status: res.status });
    }

    const data = await res.json();

    const content = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? "";

    if (!content) {
      throw new AIProviderError("AI provider returned empty response");
    }

    const parsed = parseJsonContent(content);
    const draftReply =
      typeof parsed === "object" && parsed !== null && "draftReply" in parsed
        ? (parsed as { draftReply?: unknown }).draftReply
        : undefined;

    if (typeof draftReply !== "string" || draftReply.trim().length === 0) {
      throw new AIProviderError("AI provider returned invalid reply JSON");
    }

    return {
      result: { draftReply },
      tokensInput: data.usage?.prompt_tokens,
      tokensOutput: data.usage?.completion_tokens,
    };
  }
}
