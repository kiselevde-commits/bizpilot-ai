"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CircleHelp,
  Lightbulb,
  ListChecks,
  Mail,
  Phone,
  ShieldAlert,
  Sparkles,
  UserRound,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils/cn";

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

const BREAKDOWN_LABELS: Record<string, string> = {
  relevance: "Релевантность",
  urgency: "Срочность",
  budget: "Бюджет",
  fit: "Соответствие ICP",
  authority: "ЛПР",
  clarity: "Ясность запроса",
  intent: "Намерение",
  timeline: "Сроки",
  size: "Масштаб",
  need: "Потребность",
};

export function scoreTone(score: number): "destructive" | "warning" | "secondary" | "success" {
  if (score >= 70) return "success";
  if (score >= 45) return "secondary";
  if (score >= 25) return "warning";
  return "destructive";
}

function scoreVerdict(score: number): string {
  if (score >= 70) return "Высокий потенциал";
  if (score >= 45) return "Средний потенциал";
  if (score >= 25) return "Низкий потенциал";
  return "Требует квалификации";
}

function scoreColors(score: number): [string, string] {
  if (score >= 70) return ["#239B78", "#35B994"];
  if (score >= 45) return ["#5968ED", "#9671F5"];
  if (score >= 25) return ["#D99A39", "#E7B260"];
  return ["#D65D71", "#E68A99"];
}

function humanizeKey(key: string): string {
  const mapped = BREAKDOWN_LABELS[key.toLowerCase()];
  if (mapped) return mapped;
  const normalized = key.replace(/[_-]+/g, " ").trim();
  return normalized.length > 0
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : "Фактор";
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
          ["Имя", analysis.extractedContacts.name, UserRound],
          ["Компания", analysis.extractedContacts.company, Building2],
          ["Email", analysis.extractedContacts.email, Mail],
          ["Телефон", analysis.extractedContacts.phone, Phone],
        ] as const
      ).filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    : [];

  const [gradientFrom, gradientTo] = scoreColors(analysis.leadScore);

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
    <Card
      className="ai-panel relative overflow-hidden"
      data-testid="ai-result"
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-brand-gradient"
        aria-hidden="true"
      />

      <CardHeader className="space-y-4 border-b border-border/60 pb-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative h-28 w-28 shrink-0 self-start" data-testid="ai-score">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
              <defs>
                <linearGradient id="analysis-score-gradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={gradientFrom} />
                  <stop offset="100%" stopColor={gradientTo} />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="41" fill="none" stroke="#EEF1FA" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="41"
                fill="none"
                stroke="url(#analysis-score-gradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(Math.max(0, Math.min(100, analysis.leadScore)) / 100) * 2 * Math.PI * 41} ${2 * Math.PI * 41}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[30px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-ink">
                {analysis.leadScore}
              </span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                из 100
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-gradient text-white shadow-glow">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
              </span>
              <p className="eyebrow">Результат AI-анализа</p>
            </div>
            <h2 className="mt-2 break-words text-[20px] font-semibold leading-tight tracking-[-0.025em] text-ink">
              {leadTitle}
            </h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {scoreVerdict(analysis.leadScore)} · {analysis.leadScore} из 100
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusBadge
                kind="priority"
                value={analysis.priority}
                label={`Приоритет: ${PRIORITY_LABELS[analysis.priority] ?? analysis.priority}`}
                data-testid="ai-priority"
              />
              <StatusBadge
                kind="lead"
                value="QUALIFIED"
                label={CATEGORY_LABELS[analysis.category] ?? analysis.category}
                data-testid="ai-category"
                dot={false}
              />
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground"
                data-testid="ai-intent"
              >
                Намерение: {INTENT_LABELS[analysis.intent] ?? analysis.intent}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-5">
        <section>
          <SectionTitle icon={ListChecks} title="Резюме" />
          <p
            className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink/90"
            data-testid="ai-summary"
          >
            {analysis.summary}
          </p>
        </section>

        {contactRows.length > 0 ? (
          <section
            className="rounded-2xl border border-aqua/20 bg-aqua/[0.045] p-4"
            data-testid="ai-extracted-contacts"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-aqua/10 text-aqua">
                <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <h3 className="text-[12px] font-semibold text-ink">Контакты из текста</h3>
            </div>
            <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2">
              {contactRows.map(([label, value, Icon]) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg border border-white/80 bg-white/70 px-2.5 py-2"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-aqua" aria-hidden="true" />
                  <dt className="shrink-0 text-muted-foreground">{label}:</dt>
                  <dd className="min-w-0 break-all font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2.5 text-[11px] text-muted-foreground">
              Контакты не сохранены автоматически — проверьте их вручную.
            </p>
          </section>
        ) : null}

        {analysis.justification ? (
          <section>
            <SectionTitle icon={BadgeCheck} title="Обоснование" />
            <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-muted-foreground">
              {analysis.justification}
            </p>
          </section>
        ) : null}

        {analysis.scoreBreakdown && Object.keys(analysis.scoreBreakdown).length > 0 ? (
          <section>
            <div className="flex items-center justify-between gap-2">
              <SectionTitle icon={Sparkles} title="Разбивка оценки" />
              <span className="text-[11px] text-muted-foreground">0–100</span>
            </div>
            <dl className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {Object.entries(analysis.scoreBreakdown).map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-xl border border-border/70 bg-white/60 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <dt className="truncate text-muted-foreground">{humanizeKey(key)}</dt>
                    <dd className="font-semibold tabular-nums text-ink">{value}</dd>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand-gradient"
                      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                    />
                  </div>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <AnalysisList
            title="Рекомендации"
            items={analysis.recommendations}
            testId="ai-recommendations"
            icon={Lightbulb}
            tone="success"
          />
          <AnalysisList
            title="Риски"
            items={analysis.risks}
            testId="ai-risks"
            icon={ShieldAlert}
            tone="danger"
          />
          <AnalysisList
            title="Недостающая информация"
            items={analysis.missingInfo}
            testId="ai-missing-info"
            icon={CircleHelp}
            tone="warning"
          />
          <AnalysisList
            title="Факторы"
            items={analysis.factors}
            testId="ai-factors"
            icon={ListChecks}
            tone="neutral"
          />
        </div>

        {warning ? (
          <p className="rounded-xl border border-warning/20 bg-warning/[0.06] p-3 text-[11px] text-muted-foreground">
            {warning}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-[13px] font-medium text-destructive">
            {error}
          </p>
        ) : null}

        <div className="rounded-2xl border border-primary/[0.15] bg-brand-soft p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-soft">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[12px] font-semibold text-ink">
                  {applied ? "Результат сохранён" : "Подтвердите результат"}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {applied
                    ? "Резюме, оценка, категория, намерение и приоритет сохранены в заявке."
                    : "AI не меняет заявку без вашего подтверждения."}
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={handleApply}
              disabled={applying || applied}
              data-testid="apply-analysis"
              className="shrink-0"
            >
              {applying ? "Применение…" : applied ? "Применено" : "Применить к заявке"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h3>
    </div>
  );
}

function AnalysisList({
  title,
  items,
  testId,
  icon: Icon,
  tone,
}: {
  title: string;
  items?: string[];
  testId?: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone: "success" | "danger" | "warning" | "neutral";
}) {
  if (!items || items.length === 0) return null;

  const toneClasses = {
    success: "border-success/15 bg-success/[0.035] text-success",
    danger: "border-destructive/15 bg-destructive/[0.035] text-destructive",
    warning: "border-warning/20 bg-warning/[0.045] text-[#7d5410]",
    neutral: "border-border/70 bg-muted/25 text-muted-foreground",
  } as const;

  return (
    <section
      data-testid={testId}
      className={cn("rounded-xl border p-3.5", toneClasses[tone])}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em]">{title}</h3>
      </div>
      <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-ink/80">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current opacity-60" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
