"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/utils/labels";
import type { SelectOption } from "@/components/leads/lead-form";
import { useHydrated } from "@/lib/hooks/use-hydrated";

type TaskFormProps = {
  initialData?: {
    title: string;
    description?: string | null;
    status?: string | null;
    priority?: string | null;
    dueDate?: string | null;
    assignedToId?: string | null;
    leadId?: string | null;
    contactId?: string | null;
  };
  mode: "create" | "edit";
  taskId?: string;
  leads?: SelectOption[];
  contacts?: SelectOption[];
  assignees?: SelectOption[];
};

export function TaskForm({
  initialData,
  mode,
  taskId,
  leads = [],
  contacts = [],
  assignees = [],
}: TaskFormProps) {
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
    const dueDate = (formData.get("dueDate") as string) || undefined;

    try {
      const res = await fetch(mode === "create" ? "/api/tasks" : `/api/tasks/${taskId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title") as string,
          description: (formData.get("description") as string) || null,
          status: (formData.get("status") as string) || undefined,
          priority: (formData.get("priority") as string) || undefined,
          dueDate,
          assignedToId: (formData.get("assignedToId") as string) || null,
          leadId: (formData.get("leadId") as string) || null,
          contactId: (formData.get("contactId") as string) || null,
        }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(payload?.error?.message || "Не удалось сохранить задачу");
      }

      toast.success(mode === "create" ? "Задача создана" : "Задача обновлена");
      router.replace(mode === "create" ? "/tasks" : `/tasks/${taskId}`);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось сохранить задачу";
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Название задачи</Label>
        <Input
          id="title"
          required
          maxLength={255}
          defaultValue={initialData?.title ?? ""}
          placeholder="Что нужно сделать"
          name="title"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Статус</Label>
          <select
            id="status"
            className={selectClassName}
            defaultValue={initialData?.status ?? "TODO"}
            name="status"
          >
            {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="dueDate">Срок выполнения</Label>
          <Input
            id="dueDate"
            type="datetime-local"
            defaultValue={initialData?.dueDate ?? ""}
            name="dueDate"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Описание</Label>
        <textarea
          id="description"
          maxLength={2000}
          className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          defaultValue={initialData?.description ?? ""}
          placeholder="Подробное описание задачи"
          name="description"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="leadId">Связанная заявка</Label>
          <select
            id="leadId"
            className={selectClassName}
            defaultValue={initialData?.leadId ?? ""}
            name="leadId"
          >
            <option value="">Не связана</option>
            {leads.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="contactId">Связанный контакт</Label>
          <select
            id="contactId"
            className={selectClassName}
            defaultValue={initialData?.contactId ?? ""}
            name="contactId"
          >
            <option value="">Не связан</option>
            {contacts.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="assignedToId">Ответственный</Label>
          <select
            id="assignedToId"
            className={selectClassName}
            defaultValue={initialData?.assignedToId ?? ""}
            name="assignedToId"
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
          {loading ? "Сохранение…" : mode === "create" ? "Создать задачу" : "Сохранить"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
