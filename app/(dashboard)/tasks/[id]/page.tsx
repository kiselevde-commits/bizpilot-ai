import "server-only";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock3,
  Edit3,
  Inbox,
  UserRound,
} from "lucide-react";
import { getTask } from "@/services/task.service";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/utils/labels";

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: Date | null;
  leadId: string | null;
  contactId: string | null;
  assignedToId: string | null;
  lead: { id: string; title: string } | null;
  contact: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

export default async function TaskDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const user = await requireUser();

  const task = (await getTask(user, id)) as TaskDetail | null;

  if (!task) {
    notFound();
  }

  const isOverdue =
    task.dueDate !== null &&
    new Date(task.dueDate).getTime() < Date.now() &&
    task.status !== "DONE" &&
    task.status !== "CANCELLED";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Задача #${task.id.slice(-6)}`}
        title={task.title}
        description={
          task.dueDate
            ? `Срок: ${formatDateTime(task.dueDate)}`
            : "Срок выполнения не установлен"
        }
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href={`/tasks/${task.id}/edit`}>
              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
              Редактировать
            </Link>
          </Button>
        }
      />

      {isOverdue ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Задача просрочена</AlertTitle>
          <AlertDescription>
            Срок истёк {formatDateTime(task.dueDate!)}. Обновите статус или перенесите срок, чтобы
            команда видела актуальный следующий шаг.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center gap-2.5 space-y-0 pb-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CheckSquare className="h-4 w-4" aria-hidden="true" />
              </span>
              <CardTitle>Описание</CardTitle>
            </CardHeader>
            <CardContent>
              {task.description ? (
                <div className="rounded-xl border border-border/60 bg-muted/25 p-4">
                  <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-muted-foreground">
                    {task.description}
                  </p>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border/80 bg-muted/25 px-4 py-5 text-[13px] text-muted-foreground">
                  Описание не заполнено.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href={task.lead ? `/leads/${task.lead.id}` : "/leads"}
              className="group rounded-card border border-border/80 bg-card p-4 shadow-soft transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-card"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Inbox className="h-4 w-4" aria-hidden="true" />
                </span>
                <ArrowUpRight
                  className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Заявка
              </p>
              <p className="mt-1 line-clamp-2 text-[13px] font-semibold text-ink group-hover:text-primary">
                {task.lead?.title || "Не связана"}
              </p>
            </Link>

            <Link
              href={task.contact ? `/crm/${task.contact.id}` : "/crm"}
              className="group rounded-card border border-border/80 bg-card p-4 shadow-soft transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-card"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-aqua/10 text-aqua">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                </span>
                <ArrowUpRight
                  className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Контакт
              </p>
              <p className="mt-1 line-clamp-2 text-[13px] font-semibold text-ink group-hover:text-primary">
                {task.contact?.name || "Не связан"}
              </p>
            </Link>
          </div>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-iris/10 text-iris">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                </span>
                <CardTitle>Параметры задачи</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <MetaRow icon={CheckCircle2} label="Статус">
                <StatusBadge kind="task" value={task.status} />
              </MetaRow>
              <MetaRow icon={AlertTriangle} label="Приоритет">
                <StatusBadge kind="priority" value={task.priority} />
              </MetaRow>
              <MetaRow icon={Clock3} label="Срок">
                <span className={isOverdue ? "font-medium text-destructive" : "text-muted-foreground"}>
                  {task.dueDate ? formatDateTime(task.dueDate) : "Не установлен"}
                </span>
              </MetaRow>
              <MetaRow icon={UserRound} label="Ответственный">
                <span className="text-muted-foreground">
                  {task.assignedTo?.name || "Не назначен"}
                </span>
              </MetaRow>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2.5 p-5 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                Создана {formatDateTime(task.createdAt)}
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                Обновлена {formatDateTime(task.updatedAt)}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function MetaRow({
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
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 text-[12px]">{children}</div>
      </div>
    </div>
  );
}
