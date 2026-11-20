import { existsSync, readFileSync } from "node:fs";
import { buildAIProvider, AIProviderError, type AIProviderConfig } from "@/lib/ai/provider";
import { AIAnalysisResponseSchema, GenerateReplyResponseSchema } from "@/lib/ai/schema";
import { buildReplySystemPrompt, buildSystemPrompt, wrapUserInput } from "@/lib/ai/prompt";
import { filterExtractedContacts } from "@/lib/ai/contacts";

const SYNTHETIC_LEAD_TEXT =
  "Синтетическая заявка: компании нужен еженедельный отчёт по продажам с отправкой в Telegram. " +
  "Бюджет 300 000 руб., срок — две недели. Контакт: Тестовый Клиент, test.lead@example.com, " +
  "+7 900 000-00-00.";

const REQUIRED_ENV = ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL"] as const;

function loadDotEnv(): void {
  if (!existsSync(".env")) {
    return;
  }

  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());

    if (!match) {
      continue;
    }

    const [, key, value] = match;

    if (key && value !== undefined && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main(): Promise<void> {
  loadDotEnv();

  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    fail(`Missing AI credentials: ${missing.join(", ")}`);
  }

  if (process.env.AI_PROVIDER === "mock" || process.env.ALLOW_MOCK_AI === "true") {
    fail(
      "Refusing to run: mock AI is enabled. Set AI_PROVIDER=openai-compatible and ALLOW_MOCK_AI=false.",
    );
  }

  const config: AIProviderConfig = {
    baseUrl: (process.env.AI_BASE_URL ?? "").replace(/\/+$/, ""),
    apiKey: process.env.AI_API_KEY ?? "",
    model: process.env.AI_MODEL ?? "",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 60000),
  };

  const provider = buildAIProvider(config, false);

  console.log(
    JSON.stringify({
      check: "config",
      provider: provider.name,
      model: provider.model,
      baseUrlHost: new URL(config.baseUrl).host,
      timeoutMs: config.timeoutMs,
    }),
  );

  const analyzeStarted = performance.now();
  const analyzeResult = await provider.analyze({
    text: wrapUserInput(SYNTHETIC_LEAD_TEXT),
    systemPrompt: buildSystemPrompt(),
    maxOutputTokens: 4000,
  });
  const analyzeDurationMs = Math.round(performance.now() - analyzeStarted);

  const analysis = AIAnalysisResponseSchema.safeParse(analyzeResult.result);

  if (!analysis.success) {
    console.error(
      JSON.stringify({
        check: "analyze",
        zodValidation: false,
        issues: analysis.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      }),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      check: "analyze",
      http: "success",
      zodValidation: true,
      durationMs: analyzeDurationMs,
      category: analysis.data.category,
      intent: analysis.data.intent,
      priority: analysis.data.priority,
      leadScore: analysis.data.leadScore,
      summary: analysis.data.summary,
      tokensInput: analyzeResult.tokensInput ?? null,
      tokensOutput: analyzeResult.tokensOutput ?? null,
    }),
  );

  // `extractedContacts` is checked against the source text: the smoke passes
  // only when the model does not invent contact data.
  const rawContacts = analysis.data.extractedContacts;
  const verifiedContacts = filterExtractedContacts(SYNTHETIC_LEAD_TEXT, rawContacts);
  const contactFields = ["name", "company", "email", "phone"] as const;
  const droppedFields = contactFields.filter((field) => {
    const rawValue = rawContacts?.[field];

    return (
      typeof rawValue === "string" && rawValue.trim().length > 0 && verifiedContacts[field] === null
    );
  });

  if (droppedFields.length > 0) {
    console.error(
      JSON.stringify({
        check: "extracted-contacts",
        verifiedAgainstSource: false,
        hallucinatedFields: droppedFields,
      }),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      check: "extracted-contacts",
      verifiedAgainstSource: true,
      present: contactFields.filter((field) => verifiedContacts[field] !== null),
    }),
  );

  const replyStarted = performance.now();
  const replyResult = await provider.generateReply({
    text: wrapUserInput(SYNTHETIC_LEAD_TEXT),
    systemPrompt: buildReplySystemPrompt(),
    maxOutputTokens: 4000,
  });
  const replyDurationMs = Math.round(performance.now() - replyStarted);

  const reply = GenerateReplyResponseSchema.safeParse(replyResult.result);

  if (!reply.success) {
    console.error(
      JSON.stringify({
        check: "generate-reply",
        zodValidation: false,
        issues: reply.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      }),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      check: "generate-reply",
      http: "success",
      zodValidation: true,
      durationMs: replyDurationMs,
      draftReplyLength: reply.data.draftReply.length,
      draftReply: reply.data.draftReply,
    }),
  );

  const timeoutProvider = buildAIProvider({ ...config, timeoutMs: 1 }, false);
  const timeoutStarted = performance.now();

  try {
    await timeoutProvider.analyze({
      text: wrapUserInput(SYNTHETIC_LEAD_TEXT),
      systemPrompt: buildSystemPrompt(),
      maxOutputTokens: 16,
    });
    console.error(
      JSON.stringify({ check: "timeout", handled: false, reason: "request did not abort" }),
    );
    process.exit(1);
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";

    if (name !== "AbortError") {
      console.error(JSON.stringify({ check: "timeout", handled: false, errorName: name }));
      process.exit(1);
    }

    console.log(
      JSON.stringify({
        check: "timeout",
        handled: true,
        durationMs: Math.round(performance.now() - timeoutStarted),
        errorName: name,
      }),
    );
  }

  const invalidProvider = buildAIProvider({ ...config, apiKey: "invalid-smoke-key" }, false);

  try {
    await invalidProvider.analyze({
      text: wrapUserInput(SYNTHETIC_LEAD_TEXT),
      systemPrompt: buildSystemPrompt(),
      maxOutputTokens: 16,
    });
    console.error(
      JSON.stringify({ check: "provider-error", handled: false, reason: "request succeeded" }),
    );
    process.exit(1);
  } catch (error) {
    if (!(error instanceof AIProviderError)) {
      console.error(
        JSON.stringify({
          check: "provider-error",
          handled: false,
          errorName: error instanceof Error ? error.name : "UnknownError",
        }),
      );
      process.exit(1);
    }

    console.log(
      JSON.stringify({
        check: "provider-error",
        handled: true,
        httpStatus: error.status ?? null,
      }),
    );
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      check: "fatal",
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown error",
    }),
  );
  process.exit(1);
});
