import "server-only";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTask } from "@/services/task.service";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  formatDateTime,
} from "@/lib/utils/labels";

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  status: keyof typeof TASK_STATUS_LABELS;
  priority: keyof typeof PRIORITY_LABELS;
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
    <div className="space-y-6">
      <PageHeader
        title={task.title}
        description={`Задача #${task.id.slice(-6)}`}
        actions={
          <Link href={`/tasks/${task.id}/edit`}>
            <Button variant="outline" size="sm">
              Редактировать
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InfoCard title="Статус">
          <Badge variant="secondary">{TASK_STATUS_LABELS[task.status]}</Badge>
        </InfoCard>
        <InfoCard title="Приоритет">
          <Badge variant="outline">{PRIORITY_LABELS[task.priority]}</Badge>
        </InfoCard>
        <InfoCard title="Срок">
          <span className="text-sm">{task.dueDate ? formatDateTime(task.dueDate) : "Не установлен"}</span>
          {isOverdue ? (
            <Badge variant="destructive" className="ml-2">
              Просрочена
            </Badge>
          ) : null}
        </InfoCard>
        <InfoCard title="Заявка">
          {task.lead ? (
            <Link
              href={`/leads/${task.lead.id}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {task.lead.title}
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">Не связана</span>
          )}
        </InfoCard>
        <InfoCard title="Контакт">
          {task.contact ? (
            <Link
              href={`/crm/${task.contact.id}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {task.contact.name}
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">Не связан</span>
          )}
        </InfoCard>
        <InfoCard title="Ответственный">
          <span className="text-sm">{task.assignedTo?.name || "Не назначен"}</span>
        </InfoCard>
      </div>

      {task.description ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Описание</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {task.description}
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Создана {formatDateTime(task.createdAt)} · Обновлена {formatDateTime(task.updatedAt)}
      </p>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
