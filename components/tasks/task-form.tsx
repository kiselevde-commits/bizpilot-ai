"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: "К выполнению",
  IN_PROGRESS: "В работе",
  DONE: "Выполнена",
  CANCELLED: "Отменена",
};

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
  URGENT: "Срочный",
};

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
};

export function TaskForm({ initialData, mode, taskId }: TaskFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const dueDate = (formData.get("dueDate") as string) || undefined;

    try {
      const res = await fetch(
        mode === "create" ? "/api/tasks" : `/api/tasks/${taskId}`,
        {
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
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Ошибка сохранения");
      }

      toast.success(mode === "create" ? "Задача создана" : "Задача обновлена");
      router.push(mode === "create" ? "/tasks" : `/tasks/${taskId}`);
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Название задачи</Label>
        <Input
          id="title"
          required
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
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            defaultValue={initialData?.status ?? "TODO"}
            name="status"
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
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
          className="h-32 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          defaultValue={initialData?.description ?? ""}
          placeholder="Подробное описание задачи"
          name="description"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="leadId">Связанная заявка</Label>
          <Input
            id="leadId"
            defaultValue={initialData?.leadId ?? ""}
            placeholder="ID заявки (опционально)"
            name="leadId"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="contactId">Связанный контакт</Label>
          <Input
            id="contactId"
            defaultValue={initialData?.contactId ?? ""}
            placeholder="ID контакта (опционально)"
            name="contactId"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="assignedToId">Ответственный</Label>
          <Input
            id="assignedToId"
            defaultValue={initialData?.assignedToId ?? ""}
            placeholder="ID пользователя (опционально)"
            name="assignedToId"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center gap-4 pt-4">
        <Button type="submit" disabled={loading}>
          {loading
            ? "Сохранение…"
            : mode === "create"
              ? "Создать задачу"
              : "Сохранить"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
