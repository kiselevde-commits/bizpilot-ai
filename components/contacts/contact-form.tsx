"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Building2, Save, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
    <form onSubmit={handleSubmit} data-hydrated={hydrated} className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/[0.06] p-4 text-[13px] text-destructive"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>

          {duplicates.length > 0 ? (
            <div className="space-y-3">
              <ul className="space-y-1.5">
                {duplicates.map((candidate) => (
                  <li
                    key={candidate.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/15 bg-white/60 px-3 py-2"
                  >
                    <Link
                      href={`/crm/${candidate.id}`}
                      className="font-medium underline underline-offset-4"
                      target="_blank"
                    >
                      {candidate.name}
                    </Link>
                    <span className="text-[11px] text-muted-foreground">
                      {[candidate.email, candidate.phone].filter(Boolean).join(" · ") ||
                        "без контактов"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleForceCreate}
                  disabled={loading}
                  data-testid="force-create-contact"
                >
                  Всё равно создать
                </Button>
                {duplicates[0] ? (
                  <Button asChild variant="ghost">
                    <Link href={`/crm/${duplicates[0].id}`}>Открыть дубль</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aqua/10 text-aqua">
            <UserRound className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <CardTitle>Основное</CardTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Кто ваш клиент и в каком статусе находится контакт
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5 md:col-span-2">
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company">Компания</Label>
            <Input
              id="company"
              maxLength={255}
              defaultValue={initialData?.company ?? ""}
              placeholder="Название компании"
              name="company"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status">Статус</Label>
            <Select id="status" defaultValue={initialData?.status ?? "NEW"} name="status">
              {CONTACT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {CONTACT_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <CardTitle>Способы связи</CardTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Нужен хотя бы один способ связи — email или телефон
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              defaultValue={initialData?.email ?? ""}
              placeholder="email@example.com"
              name="email"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Телефон</Label>
            <Input
              id="phone"
              type="tel"
              defaultValue={initialData?.phone ?? ""}
              placeholder="+7 999 999-99-99"
              name="phone"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Примечания</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Контекст, который поможет команде перед следующим контактом
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Примечания</Label>
            <Textarea
              id="notes"
              maxLength={2000}
              className="min-h-32"
              defaultValue={initialData?.notes ?? ""}
              placeholder="Дополнительная информация о контакте"
              name="notes"
            />
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
          {loading ? "Сохранение…" : mode === "create" ? "Создать контакт" : "Сохранить"}
        </Button>
      </div>
    </form>
  );
}
