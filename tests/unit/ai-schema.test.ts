import { describe, expect, it } from "vitest";
import {
  AIAnalysisResponseSchema,
  GenerateReplyResponseSchema,
  MAX_SUMMARY_LENGTH,
  MAX_DRAFT_REPLY_LENGTH,
  MAX_LEAD_SCORE,
  MIN_LEAD_SCORE,
} from "@/lib/ai/schema";

describe("AIAnalysisResponseSchema", () => {
  const valid = {
    summary: "Краткое резюме заявки",
    leadScore: 75,
    scoreBreakdown: { relevance: 80, urgency: 60 },
    justification: "Обоснование оценки",
    factors: ["Бюджет указан", "Сроки реалистичны"],
    recommendations: ["Связаться с клиентом", "Подготовить коммерческое предложение"],
    risks: ["Неизвестный принимающий решение"],
    missingInfo: ["Контактное лицо"],
  };

  it("принимает валидный ответ", () => {
    const result = AIAnalysisResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summary).toBe("Краткое резюме заявки");
      expect(result.data.leadScore).toBe(75);
    }
  });

  it("отклоняет пустой summary", () => {
    const result = AIAnalysisResponseSchema.safeParse({ ...valid, summary: "" });
    expect(result.success).toBe(false);
  });

  it("отклоняет leadScore вне диапазона 0-100", () => {
    const tooLow = AIAnalysisResponseSchema.safeParse({ ...valid, leadScore: -1 });
    expect(tooLow.success).toBe(false);

    const tooHigh = AIAnalysisResponseSchema.safeParse({ ...valid, leadScore: 101 });
    expect(tooHigh.success).toBe(false);
  });

  it("отклоняет non-integer leadScore", () => {
    const result = AIAnalysisResponseSchema.safeParse({ ...valid, leadScore: 50.5 });
    expect(result.success).toBe(false);
  });

  it("отклоняет summary длиннее 300 символов", () => {
    const result = AIAnalysisResponseSchema.safeParse({
      ...valid,
      summary: "a".repeat(301),
    });
    expect(result.success).toBe(false);
  });

  it("отклоняет justification длиннее 1000 символов", () => {
    const result = AIAnalysisResponseSchema.safeParse({
      ...valid,
      justification: "a".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("отклоняет более 20 элементов в массивах", () => {
    const result = AIAnalysisResponseSchema.safeParse({
      ...valid,
      factors: Array(21).fill("x"),
    });
    expect(result.success).toBe(false);
  });

  it("отклоняет строку в факторе длиннее 200 символов", () => {
    const result = AIAnalysisResponseSchema.safeParse({
      ...valid,
      factors: ["a".repeat(201)],
    });
    expect(result.success).toBe(false);
  });

  it("require все обязательные поля", () => {
    const result = AIAnalysisResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("GenerateReplyResponseSchema", () => {
  it("принимает валидный draftReply", () => {
    const result = GenerateReplyResponseSchema.safeParse({
      draftReply: "Спасибо за вашу заявку!",
    });
    expect(result.success).toBe(true);
  });

  it("отклоняет draftReply длиннее 800 символов", () => {
    const result = GenerateReplyResponseSchema.safeParse({
      draftReply: "a".repeat(801),
    });
    expect(result.success).toBe(false);
  });

  it("отклоняет пустой draftReply", () => {
    const result = GenerateReplyResponseSchema.safeParse({ draftReply: "" });
    expect(result.success).toBe(false);
  });
});

describe("константы схемы", () => {
  it("MAX_SUMMARY_LENGTH = 300", () => {
    expect(MAX_SUMMARY_LENGTH).toBe(300);
  });

  it("MAX_DRAFT_REPLY_LENGTH = 800", () => {
    expect(MAX_DRAFT_REPLY_LENGTH).toBe(800);
  });

  it("MAX_LEAD_SCORE = 100, MIN_LEAD_SCORE = 0", () => {
    expect(MAX_LEAD_SCORE).toBe(100);
    expect(MIN_LEAD_SCORE).toBe(0);
  });
});
