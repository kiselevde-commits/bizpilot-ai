import "server-only";
import { getLead } from "@/services/lead.service";
import { requireUser } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { LeadForm } from "@/components/leads/lead-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function LeadsEditPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const user = await requireUser();

  const lead = await getLead(user, id);

  if (!lead) {
    notFound();
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Редактировать заявку"
        description={lead.title}
        actions={
          <div className="flex items-center gap-2">
            <a
              href={`/leads/${lead.id}`}
              className="text-sm text-primary hover:underline"
            >
              Назад к заявке
            </a>
          </div>
        }
      />
      <LeadForm
        mode="edit"
        leadId={lead.id}
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
