import "server-only";
import { getLead } from "@/services/lead.service";
import { requireUser } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  LEAD_STATUS_LABELS,
  PRIORITY_LABELS,
  formatDateTime,
} from "@/lib/utils/labels";

type LeadDetail = {
  id: string;
  title: string;
  message: string;
  status: string;
  priority: string;
  source: string | null;
  contactId: string | null;
  contact: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
  tasks: Array<{ id: string; title: string; status: string; priority: string }>;
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
        title={`Заявка #${lead.id.slice(-6)}`}
        description={lead.title}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/leads/${lead.id}/edit`}
              className="text-sm text-primary hover:underline"
            >
              Редактировать
            </Link>
            <Link
              href={`/ai-assistant?leadId=${lead.id}`}
              className="text-sm text-primary hover:underline"
            >
              AI анализ
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <InfoCard title="Статус">
          <Badge variant="secondary">
            {LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS] || lead.status}
          </Badge>
        </InfoCard>
        <InfoCard title="Приоритет">
          <Badge variant="outline">
            {PRIORITY_LABELS[lead.priority as keyof typeof PRIORITY_LABELS]}
          </Badge>
        </InfoCard>
        <InfoCard title="Источник">
          <span className="text-sm text-muted-foreground">{lead.source || "—"}</span>
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
        <InfoCard title="Контакт">
          {lead.contact ? (
            <Link
              href={`/crm/${lead.contact.id}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {lead.contact.name}
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </InfoCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Текст заявки</CardTitle>
        </CardHeader>
        <CardContent className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {lead.message}
        </CardContent>
      </Card>

      {lead.tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Связанные задачи</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lead.tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="text-sm font-medium">{task.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {task.status} · {task.priority}
                  </div>
                </div>
                <Link href={`/tasks/${task.id}`} className="text-sm text-primary hover:underline">
                  Открыть
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
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
