import { listContacts, type ContactListQuery } from "@/services/contact.service";
import { requireUser } from "@/lib/auth/session";
import { paginationQuerySchema } from "@/lib/validation/query";
import { CONTACT_STATUSES } from "@/lib/constants";
import { CONTACT_STATUS_LABELS, formatDateTime } from "@/lib/utils/labels";
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

export const metadata = { title: "Контакты" };

export default async function ContactsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
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
  const sort = parsed.success ? parsed.data.sort : "createdAt:desc";

  const query: ContactListQuery = { page, limit, search, status, sort };

  let result;
  try {
    result = await listContacts(user, query);
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader title="Контакты" description="Управление контактами" />
        <Alert variant="destructive">Не удалось загрузить контакты. Попробуйте позже.</Alert>
      </div>
    );
  }

  const hasFilters = Boolean(search || status);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Контакты"
        description="Управление контактами и их данными"
        actions={
          <Link href="/crm/new">
            <Button>Новый контакт</Button>
          </Link>
        }
      />

      <form
        method="get"
        action="/crm"
        aria-label="Фильтры контактов"
        className="grid gap-3 rounded-lg bg-muted p-4 sm:grid-cols-3"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="contact-search" className="text-xs font-medium text-muted-foreground">
            Поиск
          </label>
          <input
            id="contact-search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Имя, компания, email"
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="contact-status" className="text-xs font-medium text-muted-foreground">
            Статус
          </label>
          <select
            id="contact-status"
            name="status"
            defaultValue={status ?? ""}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Все статусы</option>
            {CONTACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONTACT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit">Применить</Button>
          <Link href="/crm">
            <Button type="button" variant="outline">
              Сбросить
            </Button>
          </Link>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Список контактов
            <span className="ml-2 font-normal text-muted-foreground">
              {result.pagination.total}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {result.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <h2 className="text-lg font-medium">
                {hasFilters ? "По фильтрам ничего не найдено" : "Контактов пока нет"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {hasFilters
                  ? "Измените условия поиска или сбросьте фильтры."
                  : "Создайте первый контакт, чтобы связывать его с заявками и задачами."}
              </p>
              <Link
                href={hasFilters ? "/crm" : "/crm/new"}
                className="mt-2 text-sm text-primary hover:underline"
              >
                {hasFilters ? "Сбросить фильтры" : "Создать контакт"}
              </Link>
            </div>
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[12rem]">Контакт</TableHead>
                    <TableHead className="hidden md:table-cell">Компания</TableHead>
                    <TableHead className="hidden lg:table-cell">Email</TableHead>
                    <TableHead className="hidden lg:table-cell">Телефон</TableHead>
                    <TableHead className="text-center">Статус</TableHead>
                    <TableHead className="hidden text-center sm:table-cell">Заявки</TableHead>
                    <TableHead className="hidden text-center sm:table-cell">Задачи</TableHead>
                    <TableHead className="hidden xl:table-cell">Создан</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((contact) => {
                    const c = contact as { _count?: { leads: number; tasks: number } };
                    return (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <Link
                            href={`/crm/${contact.id}`}
                            className="font-medium hover:underline"
                          >
                            {contact.name}
                          </Link>
                          <span className="mt-0.5 block text-xs text-muted-foreground md:hidden">
                            {contact.company || "Без компании"}
                          </span>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                          {contact.company || "—"}
                        </TableCell>
                        <TableCell className="hidden max-w-[16rem] truncate text-sm text-muted-foreground lg:table-cell">
                          {contact.email || "—"}
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell">
                          {contact.phone || "—"}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          <Badge variant="secondary">{CONTACT_STATUS_LABELS[contact.status]}</Badge>
                        </TableCell>
                        <TableCell className="hidden text-center text-sm tabular-nums sm:table-cell">
                          {c._count?.leads ?? 0}
                        </TableCell>
                        <TableCell className="hidden text-center text-sm tabular-nums sm:table-cell">
                          {c._count?.tasks ?? 0}
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground xl:table-cell">
                          {formatDateTime(contact.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/crm/${contact.id}`}
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
          basePath="/crm"
          search={search}
          status={status ?? ""}
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
  sort,
}: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  basePath: string;
  search: string;
  status: string;
  sort: string;
}) {
  if (totalPages <= 1) return null;

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status) params.set("status", status);
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
