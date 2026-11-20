import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
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
    <div className="max-w-3xl">
      <PageHeader
        title="Редактировать заявку"
        description={lead.title}
        actions={
          <Link href={`/leads/${lead.id}`} className="text-sm text-primary hover:underline">
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
