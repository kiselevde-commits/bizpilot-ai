import {
  listTasks,
  type TaskListQuery,
} from "@/services/task.service";
import { requireUser } from "@/lib/auth/session";
import { paginationQuerySchema } from "@/lib/validation/query";
import {
  TASK_STATUS_LABELS,
  PRIORITY_LABELS,
  formatDateTime,
} from "@/lib/utils/labels";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import Link from "next/link";

export default async function TasksPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
    priority?: string;
    overdue?: string;
    sort?: string;
  }>;
}>) {
  const user = await requireUser();
  const params = await searchParams;

  const parsed = paginationQuerySchema.safeParse({
    page: Number(params.page ?? "1"),
    limit: Number(params.limit ?? "20"),
    search: params.search ?? "",
    sort: params.sort ?? "createdAt:desc",
  });

  const page = parsed.success ? parsed.data.page : 1;
  const limit = parsed.success ? parsed.data.limit : 20;
  const search = params.search ?? "";
  const status = params.status ?? undefined;
  const priority = params.priority ?? undefined;
  const overdue = params.overdue === "true" ? true : params.overdue === "false" ? false : undefined;
  const sort = parsed.success ? parsed.data.sort : "createdAt:desc";

  const query: TaskListQuery = {
    page,
    limit,
    search,
    status,
    priority,
    overdue,
    sort,
  };

  let result;
  try {
    result = await listTasks(user, query);
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader title="Задачи" description="Управление задачами" />
        <Alert variant="destructive">
          Не удалось загрузить задачи. Попробуйте позже.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Задачи"
        description="Управление задачами и сроками выполнения"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/tasks/new">
              <Button>Новая задача</Button>
            </Link>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Список задач</CardTitle>
        </CardHeader>
        <CardContent>
          {result.items.length === 0 ? (
            <EmptyState
              title="Задач не найдено"
              description="Начните с создания новой задачи."
              actionHref="/tasks/new"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Задача</TableHead>
                  <TableHead className="w-40 text-center">Статус</TableHead>
                  <TableHead className="w-32 text-center">Приоритет</TableHead>
                  <TableHead className="w-32">Заявка</TableHead>
                  <TableHead className="w-32">Контакт</TableHead>
                  <TableHead className="w-40 text-center">Срок</TableHead>
                  <TableHead className="w-32">Ответственный</TableHead>
                  <TableHead className="w-32">Создано</TableHead>
                  <TableHead className="w-24">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((task) => {
                  const t = task as {
                    lead?: { title: string } | null;
                    contact?: { name: string } | null;
                    assignedTo?: { name: string } | null;
                  };
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <Link href={`/tasks/${task.id}`} className="font-medium">
                          {task.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        <Badge variant="secondary">
                          {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] || task.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        <Badge variant="outline">
                          {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.lead?.title || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.contact?.name || "—"}
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {task.dueDate ? formatDateTime(task.dueDate) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.assignedTo?.name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(task.createdAt)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Link
                          href={`/tasks/${task.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          Открыть
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <Pagination
          page={result.pagination.page}
          limit={result.pagination.limit}
          total={result.pagination.total}
          totalPages={result.pagination.totalPages}
          basePath="/tasks"
          search={search}
          status={status ?? ""}
          priority={priority ?? ""}
          overdue={overdue ?? false}
          sort={sort}
        />
      </Card>
    </div>
  );
}

function Pagination({
  page,
  limit,
  total,
  totalPages,
  basePath,
  search,
  status,
  priority,
  overdue,
  sort,
}: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  basePath: string;
  search: string;
  status: string;
  priority: string;
  overdue: boolean | undefined;
  sort: string;
}) {
  if (totalPages <= 1) return null;

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (priority) params.set("priority", priority);
  if (overdue !== undefined) params.set("overdue", String(overdue));
  params.set("sort", sort);
  params.set("limit", String(limit));

  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">
        Строка {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} из {total}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 && (
          <Link
            href={`${basePath}?page=${page - 1}&${params.toString()}`}
            className="text-sm text-primary hover:underline"
          >
            ← Назад
          </Link>
        )}
        <span className="text-xs text-muted-foreground">
          Страница {page} из {totalPages}
        </span>
        {page < totalPages && (
          <Link
            href={`${basePath}?page=${page + 1}&${params.toString()}`}
            className="text-sm text-primary hover:underline"
          >
            Вперёд →
          </Link>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionHref,
}: {
  title: string;
  description: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {actionHref && (
        <Link href={actionHref} className="mt-4 text-sm text-primary hover:underline">
          Создать задачу
        </Link>
      )}
    </div>
  );
}

