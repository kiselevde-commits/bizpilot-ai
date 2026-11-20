import { listLeads, type LeadListQuery } from "@/services/lead.service";
import { requireUser } from "@/lib/auth/session";
import { paginationQuerySchema } from "@/lib/validation/query";
import { LEAD_STATUSES, PRIORITIES } from "@/lib/constants";
import {
  LEAD_STATUS_LABELS,
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

export const metadata = { title: "Заявки" };

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Сначала новые" },
  { value: "createdAt:asc", label: "Сначала старые" },
  { value: "priority:desc", label: "По приоритету" },
  { value: "leadScore:desc", label: "По Lead Score" },
] as const;

type LeadListItem = Awaited<ReturnType<typeof listLeads>>["items"][number] & {
  contact?: { id: string; name: string } | null;
};

export default async function LeadsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
    priority?: string;
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
  const sort = parsed.success ? parsed.data.sort : "createdAt:desc";

  const query: LeadListQuery = { page, limit, search, status, priority, sort };

  let result;
  try {
    result = await listLeads(user, query);
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader title="Заявки" description="Управление входящими заявками" />
        <Alert variant="destructive">Не удалось загрузить заявки. Попробуйте позже.</Alert>
      </div>
    );
  }

  const hasFilters = Boolean(search || status || priority);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Заявки"
        description="Управление входящими заявками и их статусами"
        actions={
          <Link href="/leads/new">
            <Button>Новая заявка</Button>
          </Link>
        }
      />

      <form
        method="get"
        action="/leads"
        aria-label="Фильтры заявок"
        className="grid gap-3 rounded-lg bg-muted p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="lead-search" className="text-xs font-medium text-muted-foreground">
            Поиск
          </label>
          <input
            id="lead-search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Название или текст"
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="lead-status" className="text-xs font-medium text-muted-foreground">
            Статус
          </label>
          <select
            id="lead-status"
            name="status"
            defaultValue={status ?? ""}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Все статусы</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="lead-priority" className="text-xs font-medium text-muted-foreground">
            Приоритет
          </label>
          <select
            id="lead-priority"
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
          <label htmlFor="lead-sort" className="text-xs font-medium text-muted-foreground">
            Сортировка
          </label>
          <select
            id="lead-sort"
            name="sort"
            defaultValue={sort}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit">Применить</Button>
          <Link href="/leads">
            <Button type="button" variant="outline">
              Сбросить
            </Button>
          </Link>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Список заявок
            <span className="ml-2 font-normal text-muted-foreground">
              {result.pagination.total}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {result.items.length === 0 ? (
            <EmptyState hasFilters={hasFilters} />
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[14rem]">Заявка</TableHead>
                    <TableHead className="hidden md:table-cell">Источник</TableHead>
                    <TableHead className="text-center">Статус</TableHead>
                    <TableHead className="hidden text-center sm:table-cell">Приоритет</TableHead>
                    <TableHead className="hidden text-center lg:table-cell">Score</TableHead>
                    <TableHead className="hidden lg:table-cell">Контакт</TableHead>
                    <TableHead className="hidden xl:table-cell">Создано</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((item) => {
                    const lead = item as LeadListItem;
                    return (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                            {lead.title}
                          </Link>
                          <span className="mt-0.5 block text-xs text-muted-foreground md:hidden">
                            {lead.source || "Без источника"}
                          </span>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                          {lead.source || "—"}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          <Badge variant="secondary">{LEAD_STATUS_LABELS[lead.status]}</Badge>
                        </TableCell>
                        <TableCell className="hidden text-center sm:table-cell">
                          <Badge variant="outline">{PRIORITY_LABELS[lead.priority]}</Badge>
                        </TableCell>
                        <TableCell className="hidden text-center text-sm tabular-nums lg:table-cell">
                          {typeof lead.leadScore === "number" ? lead.leadScore : "—"}
                        </TableCell>
                        <TableCell className="hidden max-w-[12rem] truncate text-sm lg:table-cell">
                          {lead.contact?.name || "—"}
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground xl:table-cell">
                          {formatDateTime(lead.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/leads/${lead.id}`}
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
          basePath="/leads"
          search={search}
          status={status ?? ""}
          priority={priority ?? ""}
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
  sort: string;
}) {
  if (totalPages <= 1) return null;

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (priority) params.set("priority", priority);
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

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <h2 className="text-lg font-medium">
        {hasFilters ? "По фильтрам ничего не найдено" : "Заявок пока нет"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {hasFilters
          ? "Измените условия поиска или сбросьте фильтры."
          : "Создайте первую заявку — AI-помощник проанализирует её."}
      </p>
      <Link
        href={hasFilters ? "/leads" : "/leads/new"}
        className="mt-2 text-sm text-primary hover:underline"
      >
        {hasFilters ? "Сбросить фильтры" : "Создать заявку"}
      </Link>
    </div>
  );
}
