"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Link2, Save, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

  return (
    <form onSubmit={handleSubmit} data-hydrated={hydrated} className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.06] p-4 text-[13px] text-destructive"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <CardTitle>Основное</CardTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Что за обращение и откуда оно поступило
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5 md:col-span-2">
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source">Источник</Label>
            <Input
              id="source"
              maxLength={100}
              defaultValue={initialData?.source ?? ""}
              placeholder="Откуда поступила заявка"
              name="source"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Статус</Label>
              <Select
                id="status"
                defaultValue={initialData?.status ?? "NEW"}
                name="status"
              >
                {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="priority">Приоритет</Label>
              <Select
                id="priority"
                defaultValue={initialData?.priority ?? "MEDIUM"}
                name="priority"
              >
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Текст заявки</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Полный текст обращения. AI использует его для анализа, но не меняет заявку без
            подтверждения.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="message">Текст заявки</Label>
            <Textarea
              id="message"
              required
              maxLength={20000}
              className="min-h-48"
              defaultValue={initialData?.message ?? ""}
              placeholder="Подробный текст заявки"
              name="message"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Классификация</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Необязательные поля — их может заполнить AI-анализ после подтверждения.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Категория</Label>
            <Select id="category" defaultValue={initialData?.category ?? ""} name="category">
              <option value="">—</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intent">Намерение</Label>
            <Select id="intent" defaultValue={initialData?.intent ?? ""} name="intent">
              <option value="">—</option>
              {INTENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customerType">Тип клиента</Label>
            <Select
              id="customerType"
              defaultValue={initialData?.customerType ?? ""}
              name="customerType"
            >
              <option value="">—</option>
              {CUSTOMER_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aqua/10 text-aqua">
            <Link2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <CardTitle>Связи и ответственный</CardTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Привяжите заявку к контакту и назначьте владельца
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactId">Контакт</Label>
            <Select
              id="contactId"
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
            </Select>
            {contacts.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Нет доступных контактов — создайте контакт в разделе «Контакты».
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assignedToId">Ответственный</Label>
            <Select
              id="assignedToId"
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
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 rounded-card border border-border/80 bg-white/70 p-3 shadow-soft backdrop-blur-sm sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={loading}>
          <X className="h-4 w-4" aria-hidden="true" />
          Отмена
        </Button>
        <Button type="submit" disabled={loading || !hydrated}>
          <Save className="h-4 w-4" aria-hidden="true" />
          {loading ? "Сохранение…" : mode === "create" ? "Создать заявку" : "Сохранить"}
        </Button>
      </div>
    </form>
  );
}
