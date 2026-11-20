import { describe, expect, it, vi, afterEach } from "vitest";
import { MockAIProvider, buildAIProvider, AIProviderError } from "@/lib/ai/provider";
import type { AIAnalysisResult, GenerateReplyResult } from "@/lib/ai/provider";
import { AIAnalysisResponseSchema } from "@/lib/ai/schema";
import { GenerateReplyResponseSchema } from "@/lib/ai/schema";

describe("OpenAICompatibleProvider JSON parsing", () => {
  const config = {
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    model: "test-model",
    timeoutMs: 1000,
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts draftReply from fenced JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '```json\n{"draftReply":"Здравствуйте!"}\n```' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const provider = buildAIProvider(config, false);
    const result = await provider.generateReply({
      text: "Текст",
      systemPrompt: "system",
      maxOutputTokens: 100,
    });

    expect(result.result.draftReply).toBe("Здравствуйте!");
  });

  it("extracts analysis from plain JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"summary":"ok","leadScore":10}' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const provider = buildAIProvider(config, false);
    const result = await provider.analyze({
      text: "Текст",
      systemPrompt: "system",
      maxOutputTokens: 100,
    });

    expect(result.result.summary).toBe("ok");
  });

  it("throws AIProviderError on invalid JSON content", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    );

    const provider = buildAIProvider(config, false);

    await expect(
      provider.generateReply({ text: "Текст", systemPrompt: "system", maxOutputTokens: 100 }),
    ).rejects.toBeInstanceOf(AIProviderError);
  });
});

describe("MockAIProvider", () => {
  const provider = new MockAIProvider();

  it("имеет имя 'mock'", () => {
    expect(provider.name).toBe("mock");
    expect(provider.model).toBe("mock");
  });

  describe("analyze", () => {
    it("возвращает валидный результат анализа", async () => {
      const result = await provider.analyze({
        text: "Заявка на разработку CRM",
        systemPrompt: "system",
        maxOutputTokens: 4000,
      });

      expect(result.result).toMatchObject({
        summary: expect.any(String),
        leadScore: expect.any(Number),
        category: expect.any(String),
        intent: expect.any(String),
        priority: expect.any(String),
        scoreBreakdown: expect.any(Object),
        justification: expect.any(String),
        factors: expect.any(Array),
        recommendations: expect.any(Array),
        risks: expect.any(Array),
        missingInfo: expect.any(Array),
      });

      const validation = AIAnalysisResponseSchema.safeParse(result.result);
      expect(validation.success).toBe(true);
    });

    it("leadScore в диапазоне 0-100", async () => {
      const result = await provider.analyze({
        text: "Текст",
        systemPrompt: "system",
        maxOutputTokens: 4000,
      });

      expect(result.result.leadScore).toBeGreaterThanOrEqual(0);
      expect(result.result.leadScore).toBeLessThanOrEqual(100);
    });

    it("расчёт токенов", async () => {
      const text = "Привет, мир!".repeat(100);
      const result = await provider.analyze({
        text,
        systemPrompt: "system",
        maxOutputTokens: 4000,
      });

      expect(result.tokensInput).toBe(Math.ceil(text.length / 4));
      expect(result.tokensOutput).toBe(50);
    });

    it("сводка упоминает длину текста", async () => {
      const text = "Тестовая заявка";
      const result = await provider.analyze({
        text,
        systemPrompt: "system",
        maxOutputTokens: 4000,
      });

      expect(result.result.summary).toContain(text.length.toString());
    });

    it("извлекает email и телефон, если они есть в тексте", async () => {
      const text =
        "Нужна интеграция. Контакт: Иван Иванов, ivan@example.com, +7 999 000-11-22.";

      const result = await provider.analyze({
        text,
        systemPrompt: "system",
        maxOutputTokens: 4000,
      });

      expect(result.result.extractedContacts).toEqual({
        name: null,
        company: null,
        email: "ivan@example.com",
        phone: "+7 999 000-11-22",
      });
    });

    it("не выдумывает контакты, если их нет в тексте", async () => {
      const result = await provider.analyze({
        text: "Заявка на автоматизацию процессов без контактов.",
        systemPrompt: "system",
        maxOutputTokens: 4000,
      });

      expect(result.result.extractedContacts).toBeUndefined();
    });

    it("массивы не пустые и содержат строки", async () => {
      const result = await provider.analyze({
        text: "Текст",
        systemPrompt: "system",
        maxOutputTokens: 4000,
      });

      for (const field of ["factors", "recommendations", "risks", "missingInfo"] as const) {
        const arr = result.result[field];
        expect(Array.isArray(arr)).toBe(true);
        expect(arr.length).toBeGreaterThan(0);
        arr.forEach((item) => expect(typeof item).toBe("string"));
      }
    });

    it("определяет тип результата", () => {
      const result: AIAnalysisResult = {
        summary: "s",
        leadScore: 50,
        category: "other",
        intent: "info",
        priority: "MEDIUM",
        scoreBreakdown: {},
        justification: "j",
        factors: [],
        recommendations: [],
        risks: [],
        missingInfo: [],
      };
      expect(result.summary).toBe("s");
    });
  });

  describe("generateReply", () => {
    it("возвращает валидный черновик ответа", async () => {
      const result = await provider.generateReply({
        text: "Заявка",
        systemPrompt: "system",
        maxOutputTokens: 4000,
      });

      const validation = GenerateReplyResponseSchema.safeParse(result.result);
      expect(validation.success).toBe(true);
    });

    it("draftReply не превышает 800 символов", async () => {
      const result = await provider.generateReply({
        text: "Текст",
        systemPrompt: "system",
        maxOutputTokens: 4000,
      });

      expect(result.result.draftReply.length).toBeLessThanOrEqual(800);
    });

    it("расчёт токенов", async () => {
      const text = "Текст заявки";
      const result = await provider.generateReply({
        text,
        systemPrompt: "system",
        maxOutputTokens: 4000,
      });

      expect(result.tokensInput).toBe(Math.ceil(text.length / 4));
      expect(result.tokensOutput).toBe(30);
    });

    it("для пустого текста возвращает ответ", async () => {
      const result = await provider.generateReply({
        text: "",
        systemPrompt: "system",
        maxOutputTokens: 4000,
      });

      expect(typeof result.result.draftReply).toBe("string");
    });

    it("определяет тип результата", () => {
      const result: GenerateReplyResult = { draftReply: "ответ" };
      expect(result.draftReply).toBe("ответ");
    });
  });
});
