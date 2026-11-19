import "server-only";
import { AppError } from "@/lib/errors";

export type AIAnalysisResult = {
  summary: string;
  leadScore: number;
  scoreBreakdown: Record<string, number>;
  justification: string;
  factors: string[];
  recommendations: string[];
  risks: string[];
  missingInfo: string[];
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

export interface AIProvider {
  readonly name: string;

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

export function buildAIProvider(
  config: AIProviderConfig,
  mock: boolean,
): AIProvider {
  if (mock) {
    return new MockAIProvider();
  }

  if (!config.apiKey || config.apiKey.trim().length === 0) {
    throw new AppError("AI_NOT_CONFIGURED", "AI provider API key is not configured");
  }

  return new OpenAICompatibleProvider(config);
}

export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async analyze(input: {
    text: string;
    systemPrompt: string;
    maxOutputTokens: number;
  }): Promise<{ result: AIAnalysisResult; tokensInput?: number; tokensOutput?: number }> {
    const textLength = input.text.length;

    return {
      result: {
        summary: `Мॉक-анализ текста длиной ${textLength} символов`,
        leadScore: 50,
        scoreBreakdown: { relevance: 50, urgency: 50 },
        justification: "Мॉकовый результат для разработки и тестирования",
        factors: ["Текст заявки получен", "Мॉकовый провайдер"],
        recommendations: ["Связаться с клиентом", "Уточнить требования"],
        risks: ["Недостаточно данных для точной оценки"],
        missingInfo: ["Контактное лицо", "Бюджет"],
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
      throw new AIProviderError(
        `AI provider error: ${res.status} ${text}`,
        { status: res.status },
      );
    }

    const data = await res.json();

    const content =
      data.choices?.[0]?.message?.content ??
      data.choices?.[0]?.text ??
      "";

    if (!content) {
      throw new AIProviderError("AI provider returned empty response");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (cause) {
      throw new AIProviderError("AI provider returned invalid JSON", { cause });
    }

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
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new AIProviderError(
        `AI provider error: ${res.status} ${text}`,
        { status: res.status },
      );
    }

    const data = await res.json();

    const content =
      data.choices?.[0]?.message?.content ??
      data.choices?.[0]?.text ??
      "";

    if (!content) {
      throw new AIProviderError("AI provider returned empty response");
    }

    return {
      result: { draftReply: content },
      tokensInput: data.usage?.prompt_tokens,
      tokensOutput: data.usage?.completion_tokens,
    };
  }
}
