import "server-only";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getLead } from "@/services/lead.service";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  LEAD_CATEGORY_LABELS,
  LEAD_INTENT_LABELS,
  LEAD_STATUS_LABELS,
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  formatDateTime,
} from "@/lib/utils/labels";

type LeadDetail = {
  id: string;
  title: string;
  message: string;
  status: keyof typeof LEAD_STATUS_LABELS;
  priority: keyof typeof PRIORITY_LABELS;
  source: string | null;
  summary: string | null;
  leadScore: number | null;
  category: string | null;
  intent: string | null;
  contactId: string | null;
  contact: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
  tasks: Array<{
    id: string;
    title: string;
    status: keyof typeof TASK_STATUS_LABELS;
    priority: keyof typeof PRIORITY_LABELS;
  }>;
};

export default async function LeadDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const user = await requireUser();

  const lead = (await getLead(user, id)) as LeadDetail | null;

  if (!lead) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.title}
        description={`Заявка #${lead.id.slice(-6)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/leads/${lead.id}/edit`}>
              <Button variant="outline" size="sm">
                Редактировать
              </Button>
            </Link>
            <Link href={`/ai-assistant?leadId=${lead.id}`}>
              <Button size="sm">AI-анализ</Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InfoCard title="Статус">
          <Badge variant="secondary">{LEAD_STATUS_LABELS[lead.status]}</Badge>
        </InfoCard>
        <InfoCard title="Приоритет">
          <Badge variant="outline">{PRIORITY_LABELS[lead.priority]}</Badge>
        </InfoCard>
        <InfoCard title="Lead Score">
          {typeof lead.leadScore === "number" ? (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold tabular-nums">{lead.leadScore}</span>
              <span className="text-xs text-muted-foreground">из 100</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">
              Не рассчитан — запустите AI-анализ
            </span>
          )}
        </InfoCard>
        <InfoCard title="Категория">
          <span className="text-sm">
            {lead.category ? (LEAD_CATEGORY_LABELS[lead.category] ?? lead.category) : "—"}
          </span>
        </InfoCard>
        <InfoCard title="Намерение">
          <span className="text-sm">
            {lead.intent ? (LEAD_INTENT_LABELS[lead.intent] ?? lead.intent) : "—"}
          </span>
        </InfoCard>
        <InfoCard title="Источник">
          <span className="text-sm text-muted-foreground">{lead.source || "—"}</span>
        </InfoCard>
        <InfoCard title="Контакт">
          {lead.contact ? (
            <Link
              href={`/crm/${lead.contact.id}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {lead.contact.name}
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">Не связан</span>
          )}
        </InfoCard>
        <InfoCard title="Создана">
          <span className="text-sm text-muted-foreground">
            {formatDateTime(lead.createdAt)}
          </span>
        </InfoCard>
        <InfoCard title="Обновлена">
          <span className="text-sm text-muted-foreground">
            {formatDateTime(lead.updatedAt)}
          </span>
        </InfoCard>
      </div>

      {lead.summary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">AI-резюме</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap break-words text-sm">
            {lead.summary}
          </CardContent>
        </Card>
      ) : (
        <Alert>
          AI-анализ ещё не применён. Откройте{" "}
          <Link href={`/ai-assistant?leadId=${lead.id}`} className="font-medium underline">
            AI-помощник
          </Link>
          , чтобы получить резюме, оценку и черновик ответа.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Текст заявки</CardTitle>
        </CardHeader>
        <CardContent className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {lead.message}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">
            Связанные задачи
            <span className="ml-2 font-normal text-muted-foreground">{lead.tasks.length}</span>
          </CardTitle>
          <Link href={`/tasks/new?leadId=${lead.id}`}>
            <Button variant="outline" size="sm">
              Создать задачу
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {lead.tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Задач пока нет. Создайте задачу, чтобы назначить следующий шаг.
            </p>
          ) : (
            <ul className="space-y-3">
              {lead.tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{task.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{TASK_STATUS_LABELS[task.status]}</Badge>
                      <span>{PRIORITY_LABELS[task.priority]}</span>
                    </div>
                  </div>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Открыть
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
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
