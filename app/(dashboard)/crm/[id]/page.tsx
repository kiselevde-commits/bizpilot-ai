import "server-only";
import { getContact } from "@/services/contact.service";
import { requireUser } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  CONTACT_STATUS_LABELS,
  formatDateTime,
} from "@/lib/utils/labels";

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Контакт"
        description={contact.name}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/crm/${contact.id}/edit`}
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
            {CONTACT_STATUS_LABELS[contact.status as keyof typeof CONTACT_STATUS_LABELS] || contact.status}
          </Badge>
        </InfoCard>
        <InfoCard title="Компания">
          <span className="text-sm text-muted-foreground">{contact.company || "—"}</span>
        </InfoCard>
        <InfoCard title="Email">
          <a
            href={`mailto:${contact.email}`}
            className="text-sm text-primary hover:underline"
          >
            {contact.email || "—"}
          </a>
        </InfoCard>
        <InfoCard title="Телефон">
          <a
            href={`tel:${contact.phone}`}
            className="text-sm text-primary hover:underline"
          >
            {contact.phone || "—"}
          </a>
        </InfoCard>
        <InfoCard title="Создан">
          <span className="text-sm text-muted-foreground">
            {formatDateTime(contact.createdAt)}
          </span>
        </InfoCard>
        <InfoCard title="Обновлён">
          <span className="text-sm text-muted-foreground">
            {formatDateTime(contact.updatedAt)}
          </span>
        </InfoCard>
      </div>

      {contact.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Примечания</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {contact.notes}
          </CardContent>
        </Card>
      )}

      {contact.leads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Связанные заявки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contact.leads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="text-sm font-medium">{lead.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {lead.status} · Приоритет: {lead.priority}
                  </div>
                </div>
                <Link href={`/leads/${lead.id}`} className="text-sm text-primary hover:underline">
                  Открыть
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {contact.tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Связанные задачи</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contact.tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="text-sm font-medium">{task.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {task.status} · Приоритет: {task.priority}
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
