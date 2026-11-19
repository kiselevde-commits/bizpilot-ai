import { TaskForm } from "@/components/tasks/task-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function TasksNewPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Новая задача"
        description="Создайте новую задачу для выполнения"
      />
      <TaskForm mode="create" />
    </div>
  );
}
