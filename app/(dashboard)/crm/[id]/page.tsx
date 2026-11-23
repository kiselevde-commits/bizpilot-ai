import "server-only";
import { getContact } from "@/services/contact.service";
import { requireUser } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckSquare,
  Clock3,
  Edit3,
  Inbox,
  Mail,
  MessageSquareText,
  Phone,
  Plus,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils/initials";
import { CONTACT_STATUS_LABELS, formatDateTime } from "@/lib/utils/labels";

type ContactDetail = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  leads: Array<{ id: string; title: string; status: string; priority: string }>;
  tasks: Array<{ id: string; title: string; status: string; priority: string }>;
};

export default async function ContactDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const user = await requireUser();

  const contact = (await getContact(user, id)) as ContactDetail | null;

  if (!contact) {
    notFound();
  }

  const statusLabel =
    CONTACT_STATUS_LABELS[contact.status as keyof typeof CONTACT_STATUS_LABELS] || contact.status;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="CRM contact"
        title={contact.name}
        description={`${contact.company || "Без компании"} · ${statusLabel}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/tasks/new?contactId=${contact.id}`}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Новая задача
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/crm/${contact.id}/edit`}>
                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                Редактировать
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {contact.notes ? (
            <Card>
              <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                </span>
                <CardTitle>Примечания</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border/60 bg-muted/25 p-4">
                  <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-muted-foreground">
                    {contact.notes}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Inbox className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <CardTitle>Связанные заявки</CardTitle>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {contact.leads.length} заявок клиента
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {contact.leads.length === 0 ? (
                <EmptyRow icon={Inbox} text="У контакта пока нет связанных заявок." />
              ) : (
                <ul className="space-y-2">
                  {contact.leads.map((lead) => (
                    <li
                      key={lead.id}
                      className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-white/60 p-3 transition-all duration-150 hover:border-primary/20 hover:bg-white hover:shadow-soft"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="block truncate text-[13px] font-semibold text-ink transition-colors group-hover:text-primary"
                        >
                          {lead.title}
                        </Link>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <StatusBadge kind="lead" value={lead.status} />
                          <StatusBadge kind="priority" value={lead.priority} />
                        </div>
                      </div>
                      <Link
                        href={`/leads/${lead.id}`}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                      >
                        Открыть
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-iris/10 text-iris">
                  <CheckSquare className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <CardTitle>Связанные задачи</CardTitle>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {contact.tasks.length} задач по клиенту
                  </p>
                </div>
              </div>
              <Link
                href={`/tasks/new?contactId=${contact.id}`}
                className="hidden text-[12px] font-medium text-primary hover:underline sm:block"
              >
                Добавить задачу
              </Link>
            </CardHeader>
            <CardContent>
              {contact.tasks.length === 0 ? (
                <EmptyRow icon={CheckSquare} text="У контакта пока нет связанных задач." />
              ) : (
                <ul className="space-y-2">
                  {contact.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-white/60 p-3 transition-all duration-150 hover:border-primary/20 hover:bg-white hover:shadow-soft"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/tasks/${task.id}`}
                          className="block truncate text-[13px] font-semibold text-ink transition-colors group-hover:text-primary"
                        >
                          {task.title}
                        </Link>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <StatusBadge kind="task" value={task.status} />
                          <StatusBadge kind="priority" value={task.priority} />
                        </div>
                      </div>
                      <Link
                        href={`/tasks/${task.id}`}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                      >
                        Открыть
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="relative overflow-hidden">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-aqua/[0.09] to-transparent"
              aria-hidden="true"
            />
            <CardContent className="relative p-5">
              <div className="flex items-start justify-between gap-3">
                <Avatar className="h-14 w-14 rounded-2xl shadow-soft">
                  <AvatarFallback className="rounded-2xl text-[16px]">
                    {initials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <StatusBadge kind="contact" value={contact.status} />
              </div>

              <div className="mt-5 space-y-3 border-t border-border/70 pt-4">
                <ContactRow icon={Building2} label="Компания">
                  <span className="text-muted-foreground">{contact.company || "—"}</span>
                </ContactRow>
                <ContactRow icon={Mail} label="Email">
                  {contact.email ? (
                    <a
                      href={`mailto:${contact.email}`}
                      className="break-all font-medium text-primary hover:underline"
                    >
                      {contact.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </ContactRow>
                <ContactRow icon={Phone} label="Телефон">
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {contact.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </ContactRow>
                <ContactRow icon={CalendarDays} label="Создан">
                  <span className="text-muted-foreground">{formatDateTime(contact.createdAt)}</span>
                </ContactRow>
                <ContactRow icon={Clock3} label="Обновлён">
                  <span className="text-muted-foreground">{formatDateTime(contact.updatedAt)}</span>
                </ContactRow>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/[0.12] bg-primary/[0.03]">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-soft">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[12px] font-semibold text-ink">Карточка клиента</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Связывайте заявки и задачи, чтобы вся история коммуникации оставалась в одном
                    месте.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function EmptyRow({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/25 px-4 py-5 text-[13px] text-muted-foreground">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      {text}
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 text-[12px]">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 break-words">{children}</div>
      </div>
    </div>
  );
}
