import "server-only";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTask } from "@/services/task.service";
import { requireUser } from "@/lib/auth/session";
import { TaskForm } from "@/components/tasks/task-form";
import { PageHeader } from "@/components/layout/page-header";
import { formatDateTimeLocalInput } from "@/lib/utils/labels";
import {
  listContactOptions,
  listLeadOptions,
  listMemberOptions,
} from "@/lib/utils/options";

export const metadata = { title: "Редактировать задачу" };

export default async function TasksEditPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const user = await requireUser();

  const [task, leads, contacts, assignees] = await Promise.all([
    getTask(user, id),
    listLeadOptions(user),
    listContactOptions(user),
    listMemberOptions(user),
  ]);

  if (!task) {
    notFound();
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Редактировать задачу"
        description={task.title}
        actions={
          <Link href={`/tasks/${task.id}`} className="text-sm text-primary hover:underline">
            Назад к задаче
          </Link>
        }
      />
      <TaskForm
        mode="edit"
        taskId={task.id}
        leads={leads}
        contacts={contacts}
        assignees={assignees}
        initialData={{
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate ? formatDateTimeLocalInput(task.dueDate) : null,
          assignedToId: task.assignedToId,
          leadId: task.leadId,
          contactId: task.contactId,
        }}
      />
    </div>
  );
}
