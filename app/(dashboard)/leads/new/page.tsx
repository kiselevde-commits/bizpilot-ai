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
    <div className="max-w-3xl">
      <PageHeader title="Новая заявка" description="Создайте новую заявку для обработки" />
      <LeadForm mode="create" contacts={contacts} assignees={assignees} />
    </div>
  );
}
