"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckSquare, Link2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-iris/10 text-iris">
            <CheckSquare className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <CardTitle>Основное</CardTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Что нужно сделать, в какие сроки и с каким приоритетом
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1.5">
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Статус</Label>
              <Select id="status" defaultValue={initialData?.status ?? "TODO"} name="status">
                {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dueDate">Срок выполнения</Label>
              <Input
                id="dueDate"
                type="datetime-local"
                defaultValue={initialData?.dueDate ?? ""}
                name="dueDate"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Описание</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Контекст и критерии готовности задачи
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              maxLength={2000}
              className="min-h-32"
              defaultValue={initialData?.description ?? ""}
              placeholder="Подробное описание задачи"
              name="description"
            />
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
              Свяжите задачу с заявкой и контактом, назначьте владельца
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leadId">Связанная заявка</Label>
            <Select id="leadId" defaultValue={initialData?.leadId ?? ""} name="leadId">
              <option value="">Не связана</option>
              {leads.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactId">Связанный контакт</Label>
            <Select id="contactId" defaultValue={initialData?.contactId ?? ""} name="contactId">
              <option value="">Не связан</option>
              {contacts.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assignedToId">Ответственный</Label>
            <Select
              id="assignedToId"
              defaultValue={initialData?.assignedToId ?? ""}
              name="assignedToId"
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
          {loading ? "Сохранение…" : mode === "create" ? "Создать задачу" : "Сохранить"}
        </Button>
      </div>
    </form>
  );
}
