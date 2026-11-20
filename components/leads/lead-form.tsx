"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LEAD_CATEGORY_LABELS,
  LEAD_INTENT_LABELS,
  LEAD_STATUS_LABELS,
  PRIORITY_LABELS,
} from "@/lib/utils/labels";
import { useHydrated } from "@/lib/hooks/use-hydrated";

export type SelectOption = { value: string; label: string };

const CATEGORY_OPTIONS: SelectOption[] = Object.entries(LEAD_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
);
const INTENT_OPTIONS: SelectOption[] = Object.entries(LEAD_INTENT_LABELS).map(
  ([value, label]) => ({ value, label }),
);
const CUSTOMER_TYPE_OPTIONS: SelectOption[] = [
  { value: "b2b", label: "B2B" },
  { value: "b2c", label: "B2C" },
  { value: "b2g", label: "B2G" },
  { value: "unknown", label: "Неизвестно" },
];

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
  contacts?: SelectOption[];
  assignees?: SelectOption[];
};

export function LeadForm({
  initialData,
  mode,
  leadId,
  contacts = [],
  assignees = [],
}: LeadFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useHydrated();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hydrated) {
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const res = await fetch(mode === "create" ? "/api/leads" : `/api/leads/${leadId}`, {
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
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(payload?.error?.message || "Не удалось сохранить заявку");
      }

      const payload = (await res.json()) as { data?: { id?: string } };

      toast.success(mode === "create" ? "Заявка создана" : "Заявка обновлена");
      // `replace` avoids a pending App Router navigation from re-submitting the
      // form (a subsequent click would otherwise arrive before hydration).
      router.replace(mode === "create" ? "/leads" : `/leads/${leadId ?? payload.data?.id ?? ""}`);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось сохранить заявку";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const selectClassName =
    "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <form onSubmit={handleSubmit} data-hydrated={hydrated} className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">Название заявки</Label>
          <Input
            id="title"
            required
            maxLength={255}
            defaultValue={initialData?.title ?? ""}
            placeholder="Краткое описание заявки"
            name="title"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="source">Источник</Label>
          <Input
            id="source"
            maxLength={100}
            defaultValue={initialData?.source ?? ""}
            placeholder="Откуда поступила заявка"
            name="source"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Статус</Label>
          <select
            id="status"
            className={selectClassName}
            defaultValue={initialData?.status ?? "NEW"}
            name="status"
          >
            {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="priority">Приоритет</Label>
          <select
            id="priority"
            className={selectClassName}
            defaultValue={initialData?.priority ?? "MEDIUM"}
            name="priority"
          >
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">Текст заявки</Label>
        <textarea
          id="message"
          required
          maxLength={20000}
          className="min-h-48 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            className={selectClassName}
            defaultValue={initialData?.category ?? ""}
            name="category"
          >
            <option value="">—</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="intent">Намерение</Label>
          <select
            id="intent"
            className={selectClassName}
            defaultValue={initialData?.intent ?? ""}
            name="intent"
          >
            <option value="">—</option>
            {INTENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="customerType">Тип клиента</Label>
          <select
            id="customerType"
            className={selectClassName}
            defaultValue={initialData?.customerType ?? ""}
            name="customerType"
          >
            <option value="">—</option>
            {CUSTOMER_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="contactId">Контакт</Label>
          <select
            id="contactId"
            className={selectClassName}
            defaultValue={initialData?.contactId ?? ""}
            name="contactId"
            disabled={contacts.length === 0}
          >
            <option value="">Не связан</option>
            {contacts.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {contacts.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Нет доступных контактов — создайте контакт в разделе «Контакты».
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="assignedToId">Ответственный</Label>
          <select
            id="assignedToId"
            className={selectClassName}
            defaultValue={initialData?.assignedToId ?? ""}
            name="assignedToId"
            disabled={assignees.length === 0}
          >
            <option value="">Не назначен</option>
            {assignees.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
        <Button type="submit" disabled={loading || !hydrated}>
          {loading ? "Сохранение…" : mode === "create" ? "Создать заявку" : "Сохранить"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
