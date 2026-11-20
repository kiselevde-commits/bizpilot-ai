import { listTasks, type TaskListQuery } from "@/services/task.service";
import { requireUser } from "@/lib/auth/session";
import { paginationQuerySchema } from "@/lib/validation/query";
import { PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { TASK_STATUS_LABELS, PRIORITY_LABELS, formatDateTime } from "@/lib/utils/labels";
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

export const metadata = { title: "Задачи" };

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

  const query: TaskListQuery = { page, limit, search, status, priority, overdue, sort };

  let result;
  try {
    result = await listTasks(user, query);
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader title="Задачи" description="Управление задачами" />
        <Alert variant="destructive">Не удалось загрузить задачи. Попробуйте позже.</Alert>
      </div>
    );
  }

  const hasFilters = Boolean(search || status || priority || overdue !== undefined);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Задачи"
        description="Управление задачами и сроками выполнения"
        actions={
          <Link href="/tasks/new">
            <Button>Новая задача</Button>
          </Link>
        }
      />

      <form
        method="get"
        action="/tasks"
        aria-label="Фильтры задач"
        className="grid gap-3 rounded-lg bg-muted p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="task-search" className="text-xs font-medium text-muted-foreground">
            Поиск
          </label>
          <input
            id="task-search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Название или описание"
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="task-status" className="text-xs font-medium text-muted-foreground">
            Статус
          </label>
          <select
            id="task-status"
            name="status"
            defaultValue={status ?? ""}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Все статусы</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="task-priority" className="text-xs font-medium text-muted-foreground">
            Приоритет
          </label>
          <select
            id="task-priority"
            name="priority"
            defaultValue={priority ?? ""}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Все приоритеты</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="task-overdue" className="text-xs font-medium text-muted-foreground">
            Просроченные
          </label>
          <select
            id="task-overdue"
            name="overdue"
            defaultValue={overdue === undefined ? "" : String(overdue)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Все задачи</option>
            <option value="true">Только просроченные</option>
            <option value="false">Без просроченных</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit">Применить</Button>
          <Link href="/tasks">
            <Button type="button" variant="outline">
              Сбросить
            </Button>
          </Link>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Список задач
            <span className="ml-2 font-normal text-muted-foreground">
              {result.pagination.total}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {result.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <h2 className="text-lg font-medium">
                {hasFilters ? "По фильтрам ничего не найдено" : "Задач пока нет"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {hasFilters
                  ? "Измените условия поиска или сбросьте фильтры."
                  : "Создайте первую задачу и назначьте ответственного."}
              </p>
              <Link
                href={hasFilters ? "/tasks" : "/tasks/new"}
                className="mt-2 text-sm text-primary hover:underline"
              >
                {hasFilters ? "Сбросить фильтры" : "Создать задачу"}
              </Link>
            </div>
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[14rem]">Задача</TableHead>
                    <TableHead className="text-center">Статус</TableHead>
                    <TableHead className="hidden text-center sm:table-cell">Приоритет</TableHead>
                    <TableHead className="hidden lg:table-cell">Заявка</TableHead>
                    <TableHead className="hidden xl:table-cell">Контакт</TableHead>
                    <TableHead className="hidden md:table-cell">Срок</TableHead>
                    <TableHead className="hidden lg:table-cell">Ответственный</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((item) => {
                    const task = item as typeof item & {
                      lead?: { title: string } | null;
                      contact?: { name: string } | null;
                      assignedTo?: { name: string } | null;
                    };
                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          <Link
                            href={`/tasks/${task.id}`}
                            className="font-medium hover:underline"
                          >
                            {task.title}
                          </Link>
                          <span className="mt-0.5 block text-xs text-muted-foreground lg:hidden">
                            {task.assignedTo?.name
                              ? `Ответственный: ${task.assignedTo.name}`
                              : "Без ответственного"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          <Badge variant="secondary">{TASK_STATUS_LABELS[task.status]}</Badge>
                        </TableCell>
                        <TableCell className="hidden text-center sm:table-cell">
                          <Badge variant="outline">{PRIORITY_LABELS[task.priority]}</Badge>
                        </TableCell>
                        <TableCell className="hidden max-w-[12rem] truncate text-sm lg:table-cell">
                          {task.lead?.title || "—"}
                        </TableCell>
                        <TableCell className="hidden max-w-[10rem] truncate text-sm xl:table-cell">
                          {task.contact?.name || "—"}
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground md:table-cell">
                          {task.dueDate ? formatDateTime(task.dueDate) : "—"}
                        </TableCell>
                        <TableCell className="hidden max-w-[10rem] truncate text-sm text-muted-foreground lg:table-cell">
                          {task.assignedTo?.name || "—"}
                        </TableCell>
                        <TableCell className="text-right">
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
            </div>
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
          overdue={overdue}
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
    <div className="flex flex-col items-start justify-between gap-2 border-t px-4 py-3 sm:flex-row sm:items-center">
      <p className="text-xs text-muted-foreground">
        Строка {(page - 1) * limit + 1}–{Math.min(page * limit, total)} из {total}
      </p>
      <div className="flex items-center gap-3">
        {page > 1 ? (
          <Link
            href={`${basePath}?page=${page - 1}&${params.toString()}`}
            className="text-sm text-primary hover:underline"
          >
            ← Назад
          </Link>
        ) : null}
        <span className="text-xs text-muted-foreground">
          Страница {page} из {totalPages}
        </span>
        {page < totalPages ? (
          <Link
            href={`${basePath}?page=${page + 1}&${params.toString()}`}
            className="text-sm text-primary hover:underline"
          >
            Вперёд →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
