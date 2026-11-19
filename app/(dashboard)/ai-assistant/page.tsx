"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type LeadOption = {
  id: string;
  title: string;
  message?: string;
};

type Analysis = {
  summary: string;
  leadScore: number;
  category: string;
  intent: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  justification?: string;
  factors?: string[];
  recommendations?: string[];
  risks?: string[];
  missingInfo?: string[];
};

type AnalyzeResponse = {
  success: boolean;
  data?: {
    analysis: Analysis;
    provider: string;
    model: string;
    durationMs?: number;
  };
  error?: { message?: string };
};

export default function AIAssistantPage() {
  const searchParams = useSearchParams();
  const initialLeadId = searchParams.get("leadId") ?? "";

  const [health, setHealth] = useState<{ status: string } | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState(initialLeadId);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/health")
      .then((res) => {
        if (!res.ok) throw new Error("AI service unavailable");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch((err) => {
        if (!cancelled)
          setHealthError(err instanceof Error ? err.message : "AI service unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/leads?limit=100&sort=createdAt:desc")
      .then((res) => {
        if (!res.ok) throw new Error("Не удалось загрузить список заявок");
        return res.json();
      })
      .then((payload: { data?: { items?: LeadOption[] } }) => {
        if (cancelled) return;
        const items = payload.data?.items ?? [];
        setLeads(items.map((item) => ({ id: item.id, title: item.title, message: item.message })));
      })
      .catch((err) => {
        if (!cancelled) {
          setLeadsError(err instanceof Error ? err.message : "Не удалось загрузить заявки");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleLeadChange = (value: string) => {
    setSelectedLeadId(value);
    setAnalysis(null);
    setApplied(false);
    setError(null);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLeadId) {
      setError("Выберите заявку для анализа");
      return;
    }

    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setApplied(false);

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, leadId: selectedLeadId }),
      });

      const payload = (await res.json()) as AnalyzeResponse;

      if (!res.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message || "AI analysis failed");
      }

      setAnalysis(payload.data.analysis);
      toast.success("AI-анализ завершён");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI analysis failed");
      toast.error(err instanceof Error ? err.message : "AI analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = async () => {
    if (!analysis || !selectedLeadId) return;

    setApplying(true);

    try {
      const res = await fetch(`/api/leads/${selectedLeadId}/apply-analysis`, {
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

      const payload = (await res.json()) as { success: boolean; error?: { message?: string } };

      if (!res.ok || !payload.success) {
        throw new Error(payload.error?.message || "Не удалось применить анализ");
      }

      setApplied(true);
      toast.success("Результат анализа применён к заявке");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось применить анализ");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI-помощник"
        description="Анализ заявок с использованием искусственного интеллекта"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Статус AI-провайдера</CardTitle>
        </CardHeader>
        <CardContent>
          {healthError && (
            <div className="text-sm text-destructive">AI-провайдер недоступен: {healthError}</div>
          )}
          {health && (
            <div className="flex items-center gap-3">
              <Badge variant="secondary">Активен</Badge>
              <span className="text-sm text-muted-foreground">Статус: {health.status}</span>
            </div>
          )}
          {!health && !healthError && (
            <div className="text-sm text-muted-foreground">Проверка статуса…</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Анализ заявки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted-foreground" htmlFor="lead-select">
              Заявка
            </label>
            <select
              id="lead-select"
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={selectedLeadId}
              onChange={(e) => handleLeadChange(e.target.value)}
              disabled={analyzing}
            >
              <option value="">— Выберите заявку —</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.title}
                </option>
              ))}
            </select>
            {leadsError && <div className="text-xs text-destructive">{leadsError}</div>}
            {!leadsError && leads.length === 0 && (
              <div className="text-xs text-muted-foreground">
                Заявок нет. Сначала создайте заявку в разделе «Заявки».
              </div>
            )}
          </div>

          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-muted-foreground">Текст для анализа</label>
              <textarea
                className="h-48 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Вставьте текст заявки для AI-анализа"
                disabled={analyzing}
                rows={4}
              />
            </div>
            <Button type="submit" disabled={analyzing || !inputText.trim() || !selectedLeadId}>
              {analyzing ? "Анализ…" : "Анализировать"}
            </Button>
          </form>

          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {analysis && (
            <div className="space-y-4 rounded-lg bg-muted p-4">
              <div className="text-sm font-medium">Результат анализа</div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Оценка: {analysis.leadScore} / 100</Badge>
                <Badge variant="outline">Категория: {analysis.category}</Badge>
                <Badge variant="outline">Намерение: {analysis.intent}</Badge>
                <Badge variant="outline">Приоритет: {analysis.priority}</Badge>
              </div>

              <div>
                <div className="text-xs font-medium text-muted-foreground">Резюме</div>
                <div className="whitespace-pre-wrap text-sm">{analysis.summary}</div>
              </div>

              {analysis.justification && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Обоснование</div>
                  <div className="whitespace-pre-wrap text-sm">{analysis.justification}</div>
                </div>
              )}

              <AnalysisList title="Факторы" items={analysis.factors} />
              <AnalysisList title="Рекомендации" items={analysis.recommendations} />
              <AnalysisList title="Риски" items={analysis.risks} />
              <AnalysisList title="Недостающая информация" items={analysis.missingInfo} />

              <div className="flex items-center gap-3">
                <Button type="button" onClick={handleApply} disabled={applying || applied}>
                  {applying ? "Применение…" : applied ? "Применено" : "Применить"}
                </Button>
                {applied && (
                  <span className="text-xs text-muted-foreground">Результат сохранён в заявке</span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AnalysisList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <ul className="list-disc pl-5 text-sm">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
