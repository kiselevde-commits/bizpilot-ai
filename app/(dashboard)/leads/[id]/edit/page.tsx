import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLead } from "@/services/lead.service";
import { requireUser } from "@/lib/auth/session";
import { LeadForm } from "@/components/leads/lead-form";
import { PageHeader } from "@/components/layout/page-header";
import { listContactOptions, listMemberOptions } from "@/lib/utils/options";

export const metadata = { title: "Редактировать заявку" };

export default async function LeadsEditPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const user = await requireUser();

  const [lead, contacts, assignees] = await Promise.all([
    getLead(user, id),
    listContactOptions(user),
    listMemberOptions(user),
  ]);

  if (!lead) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Edit lead"
        title="Редактировать заявку"
        description={lead.title}
        actions={
          <Link
            href={`/leads/${lead.id}`}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Назад к заявке
          </Link>
        }
      />
      <LeadForm
        mode="edit"
        leadId={lead.id}
        contacts={contacts}
        assignees={assignees}
        initialData={{
          title: lead.title,
          message: lead.message,
          source: lead.source,
          status: lead.status,
          priority: lead.priority,
          category: lead.category,
          intent: lead.intent,
          customerType: lead.customerType,
          contactId: lead.contactId,
          assignedToId: lead.assignedToId,
        }}
      />
    </div>
  );
}
