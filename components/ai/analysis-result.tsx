"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type LeadOption = { id: string; title: string };

export type AppliedAnalysis = {
  summary: string;
  leadScore: number;
  category: string;
  intent: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  scoreBreakdown?: Record<string, number>;
  justification?: string;
  factors?: string[];
  recommendations?: string[];
  risks?: string[];
  missingInfo?: string[];
  extractedContacts?: {
    name?: string | null;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

type AppliedResponse = {
  success: boolean;
  data?: { lead?: unknown };
  error?: { message?: string };
};

export type AnalysisResultProps = {
  analysis: AppliedAnalysis;
  leadId: string;
  leadTitle: string;
  warning?: string | null;
  onApplied?: () => void;
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
  URGENT: "Срочный",
};

const CATEGORY_LABELS: Record<string, string> = {
  business_automation: "Бизнес-автоматизация",
  crm_integration: "Интеграция CRM",
  ai_bot: "AI-бот",
  document_flow: "Документооборот",
  web_app: "Веб-приложение",
  other: "Другое",
};

const INTENT_LABELS: Record<string, string> = {
  request: "Запрос",
  question: "Вопрос",
  complaint: "Жалоба",
  info: "Информация",
  other: "Другое",
};

export function scoreTone(score: number): "destructive" | "warning" | "secondary" | "success" {
  if (score >= 70) return "success";
  if (score >= 45) return "secondary";
  if (score >= 25) return "warning";
  return "destructive";
}

export function AnalysisResult({
  analysis,
  leadId,
  leadTitle,
  warning,
  onApplied,
}: AnalysisResultProps) {
  const router = useRouter();
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contactRows = analysis.extractedContacts
    ? (
        [
          ["Имя", analysis.extractedContacts.name],
          ["Компания", analysis.extractedContacts.company],
          ["Email", analysis.extractedContacts.email],
          ["Телефон", analysis.extractedContacts.phone],
        ] as const
      ).filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    : [];

  async function handleApply() {
    setApplying(true);
    setError(null);

    try {
      const res = await fetch(`/api/leads/${leadId}/apply-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: analysis.summary,
          leadScore: analysis.leadScore,
          category: analysis.category,
          intent: analysis.intent,
          priority: analysis.priority,
        }),
      });

      const payload = (await res.json()) as AppliedResponse;

      if (!res.ok || !payload.success) {
        throw new Error(payload.error?.message || "Не удалось применить анализ");
      }

      setApplied(true);
      toast.success("Результат анализа применён к заявке");
      onApplied?.();
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось применить анализ";
      setError(message);
      toast.error(message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Card data-testid="ai-result" aria-live="polite">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-sm font-medium">Результат AI-анализа</CardTitle>
            <p className="mt-1 truncate text-xs text-muted-foreground">{leadTitle}</p>
          </div>
          <div
            className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border bg-muted text-center"
            data-testid="ai-score"
          >
            <span className="text-lg font-semibold leading-none tabular-nums">
              {analysis.leadScore}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">score</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={scoreTone(analysis.leadScore)} data-testid="ai-priority">
            Приоритет: {PRIORITY_LABELS[analysis.priority] ?? analysis.priority}
          </Badge>
          <Badge variant="outline" data-testid="ai-category">
            Категория: {CATEGORY_LABELS[analysis.category] ?? analysis.category}
          </Badge>
          <Badge variant="outline" data-testid="ai-intent">
            Намерение: {INTENT_LABELS[analysis.intent] ?? analysis.intent}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Резюме
          </h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm" data-testid="ai-summary">
            {analysis.summary}
          </p>
        </section>

        {contactRows.length > 0 ? (
          <section data-testid="ai-extracted-contacts">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Контакты из текста
            </h3>
            <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {contactRows.map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <dt className="shrink-0 text-muted-foreground">{label}:</dt>
                  <dd className="break-all">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              Контакты не сохранены автоматически — проверьте их вручную.
            </p>
          </section>
        ) : null}

        {analysis.justification ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Обоснование
            </h3>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
              {analysis.justification}
            </p>
          </section>
        ) : null}

        {analysis.scoreBreakdown && Object.keys(analysis.scoreBreakdown).length > 0 ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Разбивка оценки
            </h3>
            <dl className="mt-2 space-y-1.5">
              {Object.entries(analysis.scoreBreakdown).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3 text-sm">
                  <dt className="w-32 shrink-0 truncate text-muted-foreground">{key}</dt>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                    />
                  </div>
                  <dd className="w-8 shrink-0 text-right tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <AnalysisList title="Факторы" items={analysis.factors} testId="ai-factors" />
          <AnalysisList
            title="Рекомендации"
            items={analysis.recommendations}
            testId="ai-recommendations"
          />
          <AnalysisList title="Риски" items={analysis.risks} testId="ai-risks" />
          <AnalysisList
            title="Недостающая информация"
            items={analysis.missingInfo}
            testId="ai-missing-info"
          />
        </div>

        {warning ? (
          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{warning}</p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <Button
            type="button"
            onClick={handleApply}
            disabled={applying || applied}
            data-testid="apply-analysis"
          >
            {applying ? "Применение…" : applied ? "Применено" : "Применить к заявке"}
          </Button>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {applied
              ? "Резюме, оценка, категория, намерение и приоритет сохранены в заявке."
              : "AI не меняет заявку без вашего подтверждения."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalysisList({
  title,
  items,
  testId,
}: {
  title: string;
  items?: string[];
  testId?: string;
}) {
  if (!items || items.length === 0) return null;

  return (
    <section data-testid={testId}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
