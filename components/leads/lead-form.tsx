"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const LEAD_STATUSES = [
  "NEW",
  "ANALYZING",
  "QUALIFIED",
  "IN_PROGRESS",
  "WAITING",
  "CONVERTED",
  "REJECTED",
] as const;

const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "Новая",
  ANALYZING: "В анализе",
  QUALIFIED: "Квалифицирована",
  IN_PROGRESS: "В работе",
  WAITING: "Ожидание",
  CONVERTED: "Конвертирована",
  REJECTED: "Отклонена",
};

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
  URGENT: "Срочный",
};

const CATEGORIES = [
  "business_automation",
  "crm_integration",
  "ai_bot",
  "document_flow",
  "web_app",
  "other",
] as const;
const CATEGORY_LABELS: Record<string, string> = {
  business_automation: "Бизнес-автоматизация",
  crm_integration: "Интеграция CRM",
  ai_bot: "AI-бот",
  document_flow: "Документооборот",
  web_app: "Веб-приложение",
  other: "Другое",
};

const INTENTS = ["request", "question", "complaint", "info", "other"] as const;
const INTENT_LABELS: Record<string, string> = {
  request: "Запрос",
  question: "Вопрос",
  complaint: "Жалоба",
  info: "Информация",
  other: "Другое",
};

const CUSTOMER_TYPES = ["b2b", "b2c", "b2g", "unknown"] as const;
const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  b2b: "B2B",
  b2c: "B2C",
  b2g: "B2G",
  unknown: "Неизвестно",
};

type LeadFormProps = {
  initialData?: {
    title: string;
    message: string;
    source?: string | null;
    status?: string | null;
    priority?: string | null;
    category?: string | null;
    intent?: string | null;
    customerType?: string | null;
    contactId?: string | null;
    assignedToId?: string | null;
  };
  mode: "create" | "edit";
  leadId?: string;
};

export function LeadForm({ initialData, mode, leadId }: LeadFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget as HTMLFormElement);

    try {
      const res = await fetch(
        mode === "create" ? "/api/leads" : `/api/leads/${leadId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.get("title") as string,
            message: formData.get("message") as string,
            source: (formData.get("source") as string) || null,
            status: (formData.get("status") as string) || undefined,
            priority: (formData.get("priority") as string) || undefined,
            category: (formData.get("category") as string) || null,
            intent: (formData.get("intent") as string) || null,
            customerType: (formData.get("customerType") as string) || null,
            contactId: (formData.get("contactId") as string) || null,
            assignedToId: (formData.get("assignedToId") as string) || null,
          }),
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Ошибка сохранения");
      }

      toast.success(mode === "create" ? "Заявка создана" : "Заявка обновлена");
      router.push(`/leads/${mode === "create" ? "" : leadId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">Название заявки</Label>
          <Input
            id="title"
            required
            defaultValue={initialData?.title ?? ""}
            placeholder="Краткое описание заявки"
            name="title"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="source">Источник</Label>
          <Input
            id="source"
            defaultValue={initialData?.source ?? ""}
            placeholder="Откуда поступила заявка"
            name="source"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Статус</Label>
          <select
            id="status"
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            defaultValue={initialData?.status ?? "NEW"}
            name="status"
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="priority">Приоритет</Label>
          <select
            id="priority"
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            defaultValue={initialData?.priority ?? "MEDIUM"}
            name="priority"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">Текст заявки</Label>
        <textarea
          id="message"
          className="h-48 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
          defaultValue={initialData?.message ?? ""}
          placeholder="Подробный текст заявки"
          name="message"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="category">Категория</Label>
          <select
            id="category"
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            defaultValue={initialData?.category ?? ""}
            name="category"
          >
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="intent">Намерение</Label>
          <select
            id="intent"
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            defaultValue={initialData?.intent ?? ""}
            name="intent"
          >
            <option value="">—</option>
            {INTENTS.map((i) => (
              <option key={i} value={i}>
                {INTENT_LABELS[i]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="customerType">Тип клиента</Label>
          <select
            id="customerType"
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            defaultValue={initialData?.customerType ?? ""}
            name="customerType"
          >
            <option value="">—</option>
            {CUSTOMER_TYPES.map((t) => (
              <option key={t} value={t}>
                {CUSTOMER_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center gap-4 pt-4">
        <Button type="submit" disabled={loading}>
          {loading
            ? "Сохранение…"
            : mode === "create"
              ? "Создать заявку"
              : "Сохранить"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
