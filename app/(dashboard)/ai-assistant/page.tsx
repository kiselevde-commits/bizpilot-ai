"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AIAssistantPage() {
  const searchParams = useSearchParams();
  const leadId = searchParams.get("leadId");
  const [health, setHealth] = useState<{ status: string } | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{ summary: string; score: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");

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
        if (!cancelled) setHealthError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, leadId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "AI analysis failed");
      }

      const data = await res.json();
      setResult(data);
      toast.success("AI-анализ завершен");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI analysis failed");
      toast.error(err instanceof Error ? err.message : "AI analysis failed");
    } finally {
      setAnalyzing(false);
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
            <div className="text-sm text-destructive">
              AI-провайдер недоступен: {healthError}
            </div>
          )}
          {health && (
            <div className="flex items-center gap-3">
              <Badge variant="secondary">Активен</Badge>
              <span className="text-sm text-muted-foreground">
                Статус: {health.status}
              </span>
            </div>
          )}
          {!health && !healthError && (
            <div className="text-sm text-muted-foreground">Проверка статуса…</div>
          )}
        </CardContent>
      </Card>

      {leadId && (
        <div className="text-sm text-muted-foreground">
          Анализ заявки: #{leadId.slice(-6)}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Анализ текста</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-muted-foreground">
                Текст для анализа
              </label>
              <textarea
                className="h-48 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Вставьте текст заявки для AI-анализа"
                disabled={analyzing}
                rows={4}
              />
            </div>
            <Button
              type="submit"
              disabled={analyzing || !inputText.trim()}
            >
              {analyzing ? "Анализ…" : "Анализировать"}
            </Button>
          </form>

          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive text-sm">
              {error}
            </div>
          )}

          {result && (
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-sm font-medium mb-2">Результат анализа</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">{result.summary}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Оценка лида: {result.score} / 100
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}