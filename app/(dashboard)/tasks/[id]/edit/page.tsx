import "server-only";
import { getTask } from "@/services/task.service";
import { requireUser } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { TaskForm } from "@/components/tasks/task-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function TasksEditPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const user = await requireUser();

  const task = await getTask(user, id);

  if (!task) {
    notFound();
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Редактировать задачу"
        description={task.title}
        actions={
          <div className="flex items-center gap-2">
            <a
              href={`/tasks/${task.id}`}
              className="text-sm text-primary hover:underline"
            >
              Назад к задаче
            </a>
          </div>
        }
      />
      <TaskForm
        mode="edit"
        taskId={task.id}
        initialData={{
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate
            ? new Date(task.dueDate).toISOString().slice(0, 16)
            : null,
          assignedToId: task.assignedToId,
          leadId: task.leadId,
          contactId: task.contactId,
        }}
      />
    </div>
  );
}
