"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const CONTACT_STATUSES = ["NEW", "ACTIVE", "INACTIVE"] as const;
const CONTACT_STATUS_LABELS: Record<string, string> = {
  NEW: "Новый",
  ACTIVE: "Активный",
  INACTIVE: "Неактивный",
};

type ContactFormProps = {
  initialData?: {
    name: string;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    status?: string | null;
  };
  mode: "create" | "edit";
  contactId?: string;
};

export function ContactForm({ initialData, mode, contactId }: ContactFormProps) {
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
        mode === "create" ? "/api/contacts" : `/api/contacts/${contactId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.get("name") as string,
            company: (formData.get("company") as string) || null,
            email: (formData.get("email") as string) || null,
            phone: (formData.get("phone") as string) || null,
            notes: (formData.get("notes") as string) || null,
            status: (formData.get("status") as string) || undefined,
          }),
        },
      );

      if (res.status === 409) {
        const err = await res.json();
        throw new Error(
          err.error?.message || "Найдены возможные дубли контакта",
        );
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Ошибка сохранения");
      }

      toast.success(mode === "create" ? "Контакт создан" : "Контакт обновлён");
      router.push(mode === "create" ? "/crm" : `/crm/${contactId}`);
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
        <Label htmlFor="name">Имя</Label>
        <Input
          id="name"
          required
          defaultValue={initialData?.name ?? ""}
          placeholder="Имя контакта"
          name="name"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="company">Компания</Label>
          <Input
            id="company"
            defaultValue={initialData?.company ?? ""}
            placeholder="Название компании"
            name="company"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            defaultValue={initialData?.email ?? ""}
            placeholder="email@example.com"
            name="email"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Телефон</Label>
          <Input
            id="phone"
            type="tel"
            defaultValue={initialData?.phone ?? ""}
            placeholder="+7 999 999-99-99"
            name="phone"
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
            {CONTACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONTACT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Примечания</Label>
        <textarea
          id="notes"
          className="h-32 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          defaultValue={initialData?.notes ?? ""}
          placeholder="Дополнительная информация о контакте"
          name="notes"
        />
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center gap-4 pt-4">
        <Button type="submit" disabled={loading}>
          {loading
            ? "Сохранение…"
            : mode === "create"
              ? "Создать контакт"
              : "Сохранить"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
