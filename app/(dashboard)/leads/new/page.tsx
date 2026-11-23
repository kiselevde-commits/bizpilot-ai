import { LeadForm } from "@/components/leads/lead-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth/session";
import { listContactOptions, listMemberOptions } from "@/lib/utils/options";

export const metadata = { title: "Новая заявка" };

export default async function LeadsNewPage() {
  const user = await requireUser();
  const [contacts, assignees] = await Promise.all([
    listContactOptions(user),
    listMemberOptions(user),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="New lead"
        title="Новая заявка"
        description="Зафиксируйте обращение. После создания его можно отправить в AI-анализ."
      />
      <LeadForm mode="create" contacts={contacts} assignees={assignees} />
    </div>
  );
}
