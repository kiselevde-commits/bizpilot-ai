"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  Clock3,
  Copy,
  FileText,
  History,
  LockKeyhole,
  ScanLine,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { AnalysisResult, type AppliedAnalysis } from "@/components/ai/analysis-result";
import {
  canRunAiActions,
  resolveAiHealthState,
  type AiHealthResponse,
  type AiHealthState,
} from "@/lib/utils/ai-health";
import { formatDateTime } from "@/lib/utils/labels";

type LeadOption = { id: string; title: string; message?: string };

type HistoryItem = {
  id: string;
  status: string;
  provider: string;
  model: string;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
};

type AnalyzePayload = {
  success: boolean;
  data?: { analysis: AppliedAnalysis; provider: string; model: string; durationMs?: number };
  error?: { code?: string; message?: string };
};

type ReplyPayload = {
  success: boolean;
  data?: { draftReply: string };
  error?: { message?: string };
};

type HistoryPayload = {
  success: boolean;
  data?: { items: HistoryItem[]; pagination: { total: number } };
};

export default function AIAssistantPage() {
  const searchParams = useSearchParams();
  const initialLeadId = searchParams.get("leadId") ?? "";

  const [health, setHealth] = useState<AiHealthState>({ status: "loading" });
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadsState, setLeadsState] = useState<"loading" | "ready" | "error">("loading");
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState(initialLeadId);
  const [inputText, setInputText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AppliedAnalysis | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<{ durationMs?: number } | null>(null);
  const [analysisWarning, setAnalysisWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [replying, setReplying] = useState(false);
  const [draftReply, setDraftReply] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/ai/health")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as AiHealthResponse;
      })
      .then((payload) => {
        if (cancelled) return;
        setHealth(resolveAiHealthState(payload));
      })
      .catch(() => {
        if (cancelled) setHealth({ status: "error", message: "AI-провайдер недоступен" });
      });

    fetch("/api/leads?limit=100&sort=createdAt:desc")
      .then(async (res) => {
        if (!res.ok) throw new Error("Не удалось загрузить список заявок");
        return (await res.json()) as { data?: { items?: LeadOption[] } };
      })
      .then((payload) => {
        if (cancelled) return;
        setLeads(payload.data?.items ?? []);
        setLeadsState("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLeadsState("error");
        setLeadsError(err instanceof Error ? err.message : "Не удалось загрузить заявки");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loadHistory = useCallback((leadId: string) => {
    if (!leadId) {
      setHistory([]);
      setHistoryState("ready");
      return;
    }

    setHistoryState("loading");
    fetch(`/api/ai/history?leadId=${encodeURIComponent(leadId)}&limit=10`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as HistoryPayload;
      })
      .then((payload) => {
        setHistory(payload.data?.items ?? []);
        setHistoryState("ready");
      })
      .catch(() => {
        setHistory([]);
        setHistoryState("error");
      });
  }, []);

  useEffect(() => {
    loadHistory(selectedLeadId);
  }, [selectedLeadId, loadHistory]);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) ?? null,
    [leads, selectedLeadId],
  );
  const aiReady = canRunAiActions(health);

  useEffect(() => {
    if (!selectedLead?.message) return;
    setInputText((current) =>
      current.trim().length === 0 ? (selectedLead.message ?? "") : current,
    );
  }, [selectedLead]);

  function handleLeadChange(value: string) {
    setSelectedLeadId(value);
    setAnalysis(null);
    setAnalysisMeta(null);
    setAnalysisWarning(null);
    setError(null);
    setDraftReply(null);
    setReplyError(null);
    const lead = leads.find((item) => item.id === value);
    setInputText(lead?.message ?? "");
  }

  async function handleAnalyze(event: React.FormEvent) {
    event.preventDefault();

    if (!aiReady) {
      return;
    }

    if (!selectedLeadId) {
      setError("Выберите заявку для анализа");
      return;
    }

    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setAnalysisMeta(null);
    setAnalysisWarning(null);
    setDraftReply(null);

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, leadId: selectedLeadId }),
      });

      const payload = (await res.json()) as AnalyzePayload;

      if (!res.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message || "AI-анализ завершился ошибкой");
      }

      setAnalysis(payload.data.analysis);
      setAnalysisMeta({ durationMs: payload.data.durationMs });

      const extracted = payload.data.analysis as AppliedAnalysis & {
        extractedContacts?: unknown;
      };
      const extractedContacts = extracted.extractedContacts;
      if (extractedContacts && typeof extractedContacts === "object") {
        const values = Object.values(extractedContacts as Record<string, unknown>).filter(
          (value) => typeof value === "string" && value.trim().length > 0,
        );
        setAnalysisWarning(
          values.length > 0
            ? "AI нашёл контактные данные в тексте. Они не сохраняются автоматически — проверьте контакты вручную."
            : null,
        );
      }

      toast.success("AI-анализ завершён");
      loadHistory(selectedLeadId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI-анализ завершился ошибкой";
      setError(message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDraftReply() {
    if (!aiReady || !selectedLeadId) return;

    setReplying(true);
    setReplyError(null);
    setDraftReply(null);

    try {
      const res = await fetch("/api/ai/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, leadId: selectedLeadId }),
      });

      const payload = (await res.json()) as ReplyPayload;
      if (!res.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message || "Не удалось создать черновик");
      }

      setDraftReply(payload.data.draftReply);
      toast.success("Черновик ответа готов");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось создать черновик";
      setReplyError(message);
      toast.error(message);
    } finally {
      setReplying(false);
    }
  }

  async function copyDraft() {
    if (!draftReply) return;
    try {
      await navigator.clipboard.writeText(draftReply);
      toast.success("Черновик скопирован");
    } catch {
      toast.error("Не удалось скопировать текст");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="AI workspace"
        title="AI-помощник"
        description="Анализ заявок, оценка лида и черновик ответа на реальной модели — с подтверждением перед сохранением."
        actions={
          <div className="hidden items-center gap-2 rounded-full border border-primary/[0.15] bg-primary/[0.06] px-3 py-1.5 text-[11px] font-semibold text-primary sm:flex">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-success" />
            Human-in-the-loop
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-4">
          <Card className="ai-panel ai-aura relative overflow-hidden">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-brand-gradient"
              aria-hidden="true"
            />
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <CardTitle>Анализ заявки</CardTitle>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Резюме, Lead Score, приоритет и рекомендации
                  </p>
                </div>
              </div>
              {health.status === "loading" ? (
                <Skeleton className="h-6 w-24 rounded-full" />
              ) : health.status === "ready" ? (
                <Badge variant="success" data-testid="ai-health" className="gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  AI готов
                </Badge>
              ) : health.status === "unconfigured" ? (
                <Badge variant="warning" data-testid="ai-health" className="gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                  AI не настроен
                </Badge>
              ) : (
                <Badge variant="destructive" data-testid="ai-health" className="gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  Недоступен
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {health.status === "error" ? (
                <Alert variant="destructive">{health.message}. Проверьте настройки AI в ENV.</Alert>
              ) : null}

              {health.status === "unconfigured" ? (
                <Alert variant="warning" data-testid="ai-unconfigured">
                  AI не настроен: провайдер, модель или ключ отсутствуют в ENV. Пока конфигурация не
                  задана, анализ заявок недоступен.
                </Alert>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="lead-select" className="text-[12px] font-medium text-ink">
                  Заявка
                </label>
                {leadsState === "loading" ? (
                  <Skeleton className="h-10 w-full rounded-field" />
                ) : (
                  <Select
                    id="lead-select"
                    value={selectedLeadId}
                    onChange={(event) => handleLeadChange(event.target.value)}
                    disabled={analyzing}
                  >
                    <option value="">— Выберите заявку —</option>
                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.title}
                      </option>
                    ))}
                  </Select>
                )}
                {leadsState === "error" ? (
                  <p className="text-[11px] text-destructive">{leadsError}</p>
                ) : null}
                {leadsState === "ready" && leads.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Заявок нет. Сначала создайте заявку в разделе «Заявки».
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ScanLine className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                    {selectedLead
                      ? `Текст заявки «${selectedLead.title}» подставлен автоматически`
                      : "Выберите заявку — её текст подставится автоматически"}
                  </p>
                )}
              </div>

              <form onSubmit={handleAnalyze} className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="analysis-text" className="text-[12px] font-medium text-ink">
                      Текст для анализа
                    </label>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {inputText.length.toLocaleString("ru-RU")} символов
                    </span>
                  </div>
                  <Textarea
                    id="analysis-text"
                    className="min-h-44"
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    placeholder="Вставьте текст заявки для AI-анализа"
                    disabled={analyzing}
                    rows={7}
                  />
                </div>

                <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="submit"
                      disabled={analyzing || !inputText.trim() || !selectedLeadId || !aiReady}
                      data-testid="analyze-button"
                    >
                      <Wand2 className="h-4 w-4" aria-hidden="true" />
                      {analyzing ? "Анализ…" : "Анализировать"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleDraftReply}
                      disabled={replying || !inputText.trim() || !selectedLeadId || !aiReady}
                    >
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      {replying ? "Генерация…" : "Черновик ответа"}
                    </Button>
                  </div>
                  {analysisMeta?.durationMs ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground sm:ml-auto">
                      <Clock3 className="h-3 w-3" aria-hidden="true" />
                      {analysisMeta.durationMs} мс
                    </span>
                  ) : null}
                </div>
              </form>

              {analyzing ? (
                <div
                  className="space-y-2 rounded-xl border border-border/60 bg-white/50 p-4"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-2 text-[11px] font-medium text-primary">
                    <Activity className="h-3.5 w-3.5 animate-pulse-soft" aria-hidden="true" />
                    Модель анализирует заявку…
                  </div>
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : null}

              {error ? (
                <Alert variant="destructive" role="alert">
                  {error}
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          {analysis && selectedLead ? (
            <AnalysisResult
              analysis={analysis}
              leadId={selectedLead.id}
              leadTitle={selectedLead.title}
              warning={analysisWarning}
              onApplied={() => loadHistory(selectedLead.id)}
            />
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
                {[
                  {
                    icon: FileText,
                    title: "Структурируйте",
                    text: "AI извлекает суть, категорию, намерение и контакты из текста.",
                  },
                  {
                    icon: Sparkles,
                    title: "Оцените",
                    text: "Lead Score, факторы, риски и недостающая информация — в одном отчёте.",
                  },
                  {
                    icon: CheckCircle2,
                    title: "Подтвердите",
                    text: "Данные попадут в заявку только после вашего явного подтверждения.",
                  },
                ].map((step) => (
                  <div key={step.title} className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
                      <step.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-[12px] font-semibold text-ink">{step.title}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {step.text}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {draftReply ? (
            <Card data-testid="draft-reply" className="border-primary/[0.12]">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <CardTitle>Черновик ответа</CardTitle>
                </div>
                <Button variant="secondary" size="sm" onClick={copyDraft}>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  Скопировать
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-border/60 bg-muted/25 p-4">
                  <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink/90">
                    {draftReply}
                  </p>
                </div>
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <LockKeyhole className="h-3 w-3" aria-hidden="true" />
                  Черновик не отправляется автоматически: проверьте и отредактируйте текст.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {replyError ? <Alert variant="destructive">{replyError}</Alert> : null}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-[88px] xl:self-start">
          <Card>
            <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <History className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <CardTitle>История анализов</CardTitle>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Последние 10 запусков</p>
              </div>
            </CardHeader>
            <CardContent>
              {historyState === "loading" ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-3/4 rounded-xl" />
                </div>
              ) : historyState === "error" ? (
                <p className="text-[12px] text-destructive">Не удалось загрузить историю</p>
              ) : !selectedLeadId ? (
                <p className="rounded-xl border border-dashed border-border/80 bg-muted/25 px-3 py-5 text-[12px] text-muted-foreground">
                  Выберите заявку, чтобы увидеть историю.
                </p>
              ) : history.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/80 bg-muted/25 px-3 py-5 text-[12px] text-muted-foreground">
                  Для этой заявки ещё не было запусков анализа.
                </p>
              ) : (
                <ol className="space-y-2" data-testid="ai-history">
                  {history.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-border/70 bg-white/60 p-3 transition-colors hover:bg-white"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <StatusBadge kind="analysis" value={item.status} />
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {formatDateTime(item.createdAt)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                        {typeof item.durationMs === "number" ? `${item.durationMs} мс` : "—"}
                      </div>
                      {item.errorMessage ? (
                        <p className="mt-1.5 break-words text-[11px] text-destructive">
                          {item.errorMessage}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card className="border-success/15 bg-success/[0.035]">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-success shadow-soft">
                  <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[12px] font-semibold text-ink">Контроль человека</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    AI не выполняет действия и не меняет заявку без подтверждения. Извлечённые
                    контакты требуют ручной проверки.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
