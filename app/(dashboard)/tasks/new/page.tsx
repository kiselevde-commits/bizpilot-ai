import { TaskForm } from "@/components/tasks/task-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth/session";
import {
  listContactOptions,
  listLeadOptions,
  listMemberOptions,
} from "@/lib/utils/options";

export const metadata = { title: "Новая задача" };

export default async function TasksNewPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ leadId?: string; contactId?: string }>;
}>) {
  const user = await requireUser();
  const { leadId, contactId } = await searchParams;

  const [leads, contacts, assignees] = await Promise.all([
    listLeadOptions(user),
    listContactOptions(user),
    listMemberOptions(user),
  ]);

  const presetLead = leadId && leads.some((option) => option.value === leadId) ? leadId : null;
  const presetContact =
    contactId && contacts.some((option) => option.value === contactId) ? contactId : null;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="New task"
        title="Новая задача"
        description="Назначьте следующий шаг, срок и ответственного."
      />
      <TaskForm
        mode="create"
        leads={leads}
        contacts={contacts}
        assignees={assignees}
        initialData={{
          title: "",
          leadId: presetLead,
          contactId: presetContact,
        }}
      />
    </div>
  );
}
