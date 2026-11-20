"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { CONTACT_STATUSES } from "@/lib/constants";
import { CONTACT_STATUS_LABELS } from "@/lib/utils/labels";

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

type DuplicateCandidate = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
};

type ContactPayload = {
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: string | undefined;
};

export function ContactForm({ initialData, mode, contactId }: ContactFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [pendingPayload, setPendingPayload] = useState<ContactPayload | null>(null);
  const hydrated = useHydrated();

  async function save(payload: ContactPayload, force: boolean) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        mode === "create" ? "/api/contacts" : `/api/contacts/${contactId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, force }),
        },
      );

      if (res.status === 409) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string; details?: { candidates?: DuplicateCandidate[] } } }
          | null;
        const candidates = body?.error?.details?.candidates ?? [];

        setDuplicates(candidates);
        setPendingPayload(payload);
        setError(
          body?.error?.message ??
            "Найдены возможные дубли контакта. Проверьте список ниже.",
        );
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(body?.error?.message || "Ошибка сохранения");
      }

      const body = (await res.json().catch(() => null)) as
        | { data?: { contact?: { id?: string } } }
        | null;

      setDuplicates([]);
      setPendingPayload(null);
      toast.success(mode === "create" ? "Контакт создан" : "Контакт обновлён");
      // After creating a contact, open its card: that is where the user links
      // the contact to leads and tasks.
      router.replace(
        mode === "create" ? `/crm/${body?.data?.contact?.id ?? ""}` : `/crm/${contactId}`,
      );
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hydrated) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const payload: ContactPayload = {
      name: String(formData.get("name") ?? ""),
      company: (formData.get("company") as string) || null,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      notes: (formData.get("notes") as string) || null,
      status: (formData.get("status") as string) || undefined,
    };

    await save(payload, false);
  }

  async function handleForceCreate() {
    if (!pendingPayload) return;
    await save(pendingPayload, true);
  }

  return (
    <form onSubmit={handleSubmit} data-hydrated={hydrated} className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="space-y-3 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p>{error}</p>

          {duplicates.length > 0 ? (
            <div className="space-y-3">
              <ul className="space-y-1">
                {duplicates.map((candidate) => (
                  <li key={candidate.id}>
                    <Link
                      href={`/crm/${candidate.id}`}
                      className="font-medium underline underline-offset-4"
                      target="_blank"
                    >
                      {candidate.name}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {[candidate.email, candidate.phone].filter(Boolean).join(" · ") ||
                        "без контактов"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleForceCreate}
                  disabled={loading}
                  data-testid="force-create-contact"
                >
                  Всё равно создать
                </Button>
                {duplicates[0] ? (
                  <Link href={`/crm/${duplicates[0].id}`}>
                    <Button type="button" variant="ghost">
                      Открыть дубль
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Имя</Label>
        <Input
          id="name"
          required
          maxLength={255}
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
            maxLength={255}
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
          maxLength={2000}
          className="h-32 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          defaultValue={initialData?.notes ?? ""}
          placeholder="Дополнительная информация о контакте"
          name="notes"
        />
        <p className="text-xs text-muted-foreground">
          Нужен хотя бы один способ связи — email или телефон.
        </p>
      </div>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
        <Button type="submit" disabled={loading || !hydrated}>
          {loading ? "Сохранение…" : mode === "create" ? "Создать контакт" : "Сохранить"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
