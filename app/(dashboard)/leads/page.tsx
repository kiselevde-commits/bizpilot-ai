import {
  listLeads,
  type LeadListQuery,
} from "@/services/lead.service";
import { requireUser } from "@/lib/auth/session";
import { paginationQuerySchema } from "@/lib/validation/query";
import {
  LEAD_STATUSES,
  PRIORITIES,
} from "@/lib/constants";
import {
  LEAD_STATUS_LABELS,
  PRIORITY_LABELS,
  formatDateTime,
} from "@/lib/utils/labels";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

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

  const query: LeadListQuery = {
    page,
    limit,
    search,
    status,
    priority,
    sort,
  };

  let result;
  try {
    result = await listLeads(user, query);
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader title="Заявки" description="Управление входящими заявками" />
        <Alert variant="destructive">
          Не удалось загрузить заявки. Попробуйте позже.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Заявки"
        description="Управление входящими заявками и их статусами"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/leads/new">
              <Button>Новая заявка</Button>
            </Link>
          </div>
        }
      />

      <div className="flex flex-col lg:flex-row gap-4 items-end">
        <SearchFilters
          search={search}
          status={status ?? ""}
          priority={priority ?? ""}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Список заявок</CardTitle>
        </CardHeader>
        <CardContent>
          {result.items.length === 0 ? (
            <EmptyState
              title="Заявок не найдено"
              description="Начните с создания новой заявки или настройте фильтры."
              actionHref="/leads/new"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Заявка</TableHead>
                  <TableHead>Источник</TableHead>
                  <TableHead className="text-center">Статус</TableHead>
                  <TableHead className="text-center">Приоритет</TableHead>
                  <TableHead className="w-40">Контакт</TableHead>
                  <TableHead className="w-32">Создано</TableHead>
                  <TableHead className="w-24 sr-only md:sr-only-false">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((lead) => {
                  const l = lead as { contact?: { name: string } | null };
                  return (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Link href={`/leads/${lead.id}`} className="font-medium">
                          {lead.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lead.source || "—"}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        <Badge variant="secondary">
                          {LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS] || lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        <Badge variant="outline">
                          {PRIORITY_LABELS[lead.priority as keyof typeof PRIORITY_LABELS]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {l.contact?.name || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(lead.createdAt)}
                      </TableCell>
                      <TableCell className="text-center">
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

function SearchFilters({
  search,
  status,
  priority,
}: {
  search: string;
  status: string;
  priority: string;
}) {
  return (
    <div className="grid gap-4 p-4 bg-muted rounded-lg lg:grid-cols-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Поиск</label>
        <input
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          defaultValue={search}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Статус</label>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          defaultValue={status}
        >
          <option value="">Все статусы</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s as keyof typeof LEAD_STATUS_LABELS]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Приоритет</label>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          defaultValue={priority}
        >
          <option value="">Все приоритеты</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p as keyof typeof PRIORITY_LABELS]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit">Применить</Button>
        <Button variant="outline">Сбросить</Button>
      </div>
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
          Создать заявку
        </Link>
      )}
    </div>
  );
}

function Alert({ variant, children }: { variant?: string; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        variant === "destructive"
          ? "border-destructive bg-destructive/10 text-destructive"
          : "border-muted bg-background"
      }`}
    >
      {children}
    </div>
  );
}
