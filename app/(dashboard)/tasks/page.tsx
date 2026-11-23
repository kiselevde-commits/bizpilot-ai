import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckSquare,
  Clock3,
  Link2,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { listTasks, type TaskListQuery } from "@/services/task.service";
import { requireUser } from "@/lib/auth/session";
import { paginationQuerySchema } from "@/lib/validation/query";
import { PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { PRIORITY_LABELS, TASK_STATUS_LABELS, formatDateTime } from "@/lib/utils/labels";
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
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataPagination } from "@/components/ui/data-pagination";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Задачи" };

type TaskRow = {
  lead?: { title: string } | null;
  contact?: { name: string } | null;
  assignedTo?: { name: string } | null;
};

function isOverdue(task: { dueDate: Date | null; status: string }): boolean {
  return (
    task.dueDate !== null &&
    new Date(task.dueDate).getTime() < Date.now() &&
    task.status !== "DONE" &&
    task.status !== "CANCELLED"
  );
}

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
    <div className="space-y-5">
      <PageHeader
        eyebrow="Next actions"
        title="Задачи"
        description="Следующие шаги по заявкам и клиентам: сроки, приоритеты и ответственные."
        actions={
          <Button asChild>
            <Link href="/tasks/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Новая задача
            </Link>
          </Button>
        }
      />

      <form
        method="get"
        action="/tasks"
        aria-label="Фильтры задач"
        className="glass-panel rounded-card p-4"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
            Фильтры и сортировка
          </div>
          {hasFilters ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              активны
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-10">
          <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-4">
            <label htmlFor="task-search" className="text-[11px] font-medium text-muted-foreground">
              Поиск
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="task-search"
                name="search"
                type="search"
                defaultValue={search}
                placeholder="Название или описание"
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-2">
            <label htmlFor="task-status" className="text-[11px] font-medium text-muted-foreground">
              Статус
            </label>
            <Select id="task-status" name="status" defaultValue={status ?? ""}>
              <option value="">Все статусы</option>
              {TASK_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {TASK_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-2">
            <label
              htmlFor="task-priority"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Приоритет
            </label>
            <Select id="task-priority" name="priority" defaultValue={priority ?? ""}>
              <option value="">Все приоритеты</option>
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-2">
            <label
              htmlFor="task-overdue"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Просроченные
            </label>
            <Select
              id="task-overdue"
              name="overdue"
              defaultValue={overdue === undefined ? "" : String(overdue)}
            >
              <option value="">Все задачи</option>
              <option value="true">Только просроченные</option>
              <option value="false">Без просроченных</option>
            </Select>
          </div>

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-10 lg:justify-end">
            <Button type="submit">
              <Search className="h-4 w-4" aria-hidden="true" />
              Применить
            </Button>
            <Button asChild variant="ghost">
              <Link href="/tasks">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Сбросить
              </Link>
            </Button>
          </div>
        </div>
      </form>

      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-iris/10 text-iris">
              <CheckSquare className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>Список задач</CardTitle>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {result.pagination.total} задач в рабочем пространстве
              </p>
            </div>
          </div>
          {hasFilters ? (
            <span className="hidden rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground sm:inline-flex">
              Фильтр применён
            </span>
          ) : null}
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          {result.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-iris/10 text-iris">
                <CheckSquare className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold">
                  {hasFilters ? "По фильтрам ничего не найдено" : "Задач пока нет"}
                </h2>
                <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
                  {hasFilters
                    ? "Измените условия поиска или сбросьте фильтры."
                    : "Создайте первую задачу и назначьте ответственного."}
                </p>
              </div>
              <Link
                href={hasFilters ? "/tasks" : "/tasks/new"}
                className="mt-1 text-[13px] font-medium text-primary hover:underline"
              >
                {hasFilters ? "Сбросить фильтры" : "Создать задачу"}
              </Link>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[15rem] pl-5">Задача</TableHead>
                      <TableHead className="text-center">Статус</TableHead>
                      <TableHead className="hidden text-center sm:table-cell">Приоритет</TableHead>
                      <TableHead className="hidden lg:table-cell">Срок</TableHead>
                      <TableHead className="hidden xl:table-cell">Заявка</TableHead>
                      <TableHead className="pr-5 text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((item) => {
                      const task = item as typeof item & TaskRow;
                      const late = isOverdue({ dueDate: task.dueDate, status: task.status });

                      return (
                        <TableRow key={task.id} className="group">
                          <TableCell className="pl-5">
                            <Link
                              href={`/tasks/${task.id}`}
                              className="block max-w-[24rem] truncate font-semibold text-ink transition-colors group-hover:text-primary"
                            >
                              {task.title}
                            </Link>
                            <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <UserRound className="h-3 w-3" aria-hidden="true" />
                              {task.assignedTo?.name || "Без ответственного"}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusBadge kind="task" value={task.status} />
                          </TableCell>
                          <TableCell className="hidden text-center sm:table-cell">
                            <StatusBadge kind="priority" value={task.priority} />
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap lg:table-cell">
                            {task.dueDate ? (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 text-[12px]",
                                  late ? "font-medium text-destructive" : "text-muted-foreground",
                                )}
                              >
                                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                                {formatDateTime(task.dueDate)}
                              </span>
                            ) : (
                              <span className="text-[12px] text-muted-foreground">—</span>
                            )}
                            {late ? (
                              <span className="mt-1 block text-[10px] font-semibold text-destructive">
                                Просрочена
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="hidden max-w-[12rem] truncate text-[13px] text-muted-foreground xl:table-cell">
                            {task.lead?.title || "—"}
                          </TableCell>
                          <TableCell className="pr-5 text-right">
                            <Link
                              href={`/tasks/${task.id}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                              aria-label="Открыть карточку задачи"
                            >
                              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y divide-border/60 md:hidden">
                {result.items.map((item) => {
                  const task = item as typeof item & TaskRow;
                  const late = isOverdue({ dueDate: task.dueDate, status: task.status });

                  return (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      className={cn(
                        "block px-4 py-4 transition-colors active:bg-muted/50",
                        late && "bg-destructive/[0.025]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-ink">{task.title}</p>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                            <UserRound className="h-3 w-3" aria-hidden="true" />
                            {task.assignedTo?.name || "Без ответственного"}
                          </p>
                        </div>
                        <ArrowUpRight
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <StatusBadge kind="task" value={task.status} />
                        <StatusBadge kind="priority" value={task.priority} />
                        {task.dueDate ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                              late
                                ? "border-destructive/20 bg-destructive/10 text-destructive"
                                : "border-border/70 bg-white/70 text-muted-foreground",
                            )}
                          >
                            {late ? (
                              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <CalendarClock className="h-3 w-3" aria-hidden="true" />
                            )}
                            {late ? "Просрочена: " : ""}
                            {formatDateTime(task.dueDate)}
                          </span>
                        ) : null}
                        {task.lead ? (
                          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-white/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">{task.lead.title}</span>
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
        <DataPagination
          page={result.pagination.page}
          limit={result.pagination.limit}
          total={result.pagination.total}
          totalPages={result.pagination.totalPages}
          basePath="/tasks"
          query={{ search, status: status ?? "", priority: priority ?? "", overdue, sort, limit }}
        />
      </Card>
    </div>
  );
}
