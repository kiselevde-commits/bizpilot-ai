import "server-only";
import { getTask } from "@/services/task.service";
import { requireUser } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  TASK_STATUS_LABELS,
  PRIORITY_LABELS,
  formatDateTime,
} from "@/lib/utils/labels";

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  leadId: string | null;
  contactId: string | null;
  assignedToId: string | null;
  lead: { id: string; title: string } | null;
  contact: { id: string; name: string } | null;
  assignedTo: { name: string } | null;
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Задача"
        description={task.title}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/tasks/${task.id}/edit`}
              className="text-sm text-primary hover:underline"
            >
              Редактировать
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <InfoCard title="Статус">
          <Badge variant="secondary">
            {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] || task.status}
          </Badge>
        </InfoCard>
        <InfoCard title="Приоритет">
          <Badge variant="outline">
            {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}
          </Badge>
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
            <span className="text-sm text-muted-foreground">—</span>
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
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </InfoCard>
        <InfoCard title="Ответственный">
          <span className="text-sm text-muted-foreground">
            {task.assignedTo?.name || "—"}
          </span>
        </InfoCard>
        <InfoCard title="Срок">
          <span className="text-sm text-muted-foreground">
            {task.dueDate ? formatDateTime(task.dueDate) : "Не установлен"}
          </span>
        </InfoCard>
      </div>

      {task.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Описание</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {task.description}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Создана {formatDateTime(task.createdAt)} ·
          Обновлена {formatDateTime(task.updatedAt)}
        </div>
        <Link
          href={`/tasks/${task.id}/edit`}
          className="text-sm text-primary hover:underline"
        >
          Редактировать
        </Link>
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
