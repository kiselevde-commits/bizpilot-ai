"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalysisResult, type AppliedAnalysis } from "@/components/ai/analysis-result";
import { formatDateTime } from "@/lib/utils/labels";

type LeadOption = { id: string; title: string; message?: string };

type HealthState =
  | { status: "loading" }
  | { status: "ready"; mode: string }
  | { status: "error"; message: string };

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

  const [health, setHealth] = useState<HealthState>({ status: "loading" });
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadsState, setLeadsState] = useState<"loading" | "ready" | "error">("loading");
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState(initialLeadId);
  const [inputText, setInputText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AppliedAnalysis | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<{
    provider: string;
    model: string;
    durationMs?: number;
  } | null>(null);
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
        return (await res.json()) as { status?: string; configured?: boolean };
      })
      .then((data) => {
        if (cancelled) return;
        setHealth({
          status: "ready",
          mode: data.configured ? "configured" : "not-configured",
        });
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
      setAnalysisMeta({
        provider: payload.data.provider,
        model: payload.data.model,
        durationMs: payload.data.durationMs,
      });

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
            ? `AI нашёл контактные данные в тексте: ${values.join(", ")}. Они не сохраняются автоматически — проверьте контакты вручную.`
            : "AI не обнаружил контактных данных в тексте заявки.",
        );
      }

      toast.success("AI-анализ завершён");
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI-анализ завершился ошибкой";
      setError(message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDraftReply() {
    if (!selectedLeadId) return;

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
    <div className="space-y-6">
      <PageHeader
        title="AI-помощник"
        description="Анализ заявок, оценка лида и черновик ответа на реальной модели"
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                Анализ заявки
              </CardTitle>
              {health.status === "loading" ? (
                <Skeleton className="h-5 w-24" />
              ) : health.status === "ready" ? (
                <Badge variant="success" data-testid="ai-health">
                  AI готов
                </Badge>
              ) : (
                <Badge variant="destructive" data-testid="ai-health">
                  Недоступен
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {health.status === "error" ? (
                <Alert variant="destructive">{health.message}. Проверьте настройки AI в ENV.</Alert>
              ) : null}

              <div className="flex flex-col gap-2">
                <label htmlFor="lead-select" className="text-sm font-medium">
                  Заявка
                </label>
                {leadsState === "loading" ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <select
                    id="lead-select"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                  </select>
                )}
                {leadsState === "error" ? (
                  <p className="text-xs text-destructive">{leadsError}</p>
                ) : null}
                {leadsState === "ready" && leads.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Заявок нет. Сначала создайте заявку в разделе «Заявки».
                  </p>
                ) : null}
              </div>

              <form onSubmit={handleAnalyze} className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="analysis-text" className="text-sm font-medium">
                    Текст для анализа
                  </label>
                  <textarea
                    id="analysis-text"
                    className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    placeholder="Вставьте текст заявки для AI-анализа"
                    disabled={analyzing}
                    rows={6}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="submit"
                    disabled={analyzing || !inputText.trim() || !selectedLeadId}
                    data-testid="analyze-button"
                  >
                    <Wand2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    {analyzing ? "Анализ…" : "Анализировать"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDraftReply}
                    disabled={replying || !inputText.trim() || !selectedLeadId}
                  >
                    {replying ? "Генерация…" : "Черновик ответа"}
                  </Button>
                  {analysisMeta ? (
                    <span className="text-xs text-muted-foreground">
                      {analysisMeta.model}
                      {analysisMeta.durationMs ? ` · ${analysisMeta.durationMs} мс` : ""}
                    </span>
                  ) : null}
                </div>
              </form>

              {analyzing ? (
                <div className="space-y-2" aria-live="polite">
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
          ) : null}

          {draftReply ? (
            <Card data-testid="draft-reply">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">Черновик ответа</CardTitle>
                <Button variant="outline" size="sm" onClick={copyDraft}>
                  Скопировать
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="whitespace-pre-wrap break-words text-sm">{draftReply}</p>
                <p className="text-xs text-muted-foreground">
                  Черновик не отправляется автоматически: проверьте и отредактируйте текст.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {replyError ? <Alert variant="destructive">{replyError}</Alert> : null}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm font-medium">История анализов</CardTitle>
          </CardHeader>
          <CardContent>
            {historyState === "loading" ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : historyState === "error" ? (
              <p className="text-sm text-destructive">Не удалось загрузить историю</p>
            ) : !selectedLeadId ? (
              <p className="text-sm text-muted-foreground">Выберите заявку, чтобы увидеть историю.</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Для этой заявки ещё не было запусков анализа.
              </p>
            ) : (
              <ol className="space-y-3" data-testid="ai-history">
                {history.map((item) => (
                  <li key={item.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={item.status === "SUCCESS" ? "success" : "destructive"}>
                        {item.status === "SUCCESS" ? "Успешно" : "Ошибка"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-xs text-muted-foreground">{item.model}</p>
                    {item.errorMessage ? (
                      <p className="mt-1 break-words text-xs text-destructive">
                        {item.errorMessage}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
