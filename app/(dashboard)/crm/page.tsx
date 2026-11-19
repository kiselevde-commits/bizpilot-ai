import {
  listContacts,
  type ContactListQuery,
} from "@/services/contact.service";
import { requireUser } from "@/lib/auth/session";
import { paginationQuerySchema } from "@/lib/validation/query";
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

  const query: ContactListQuery = {
    page,
    limit,
    search,
    status,
    sort,
  };

  let result;
  try {
    result = await listContacts(user, query);
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader title="Контакты" description="Управление контактами" />
        <Alert variant="destructive">
          Не удалось загрузить контакты. Попробуйте позже.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Контакты"
        description="Управление контактами и их данными"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/crm/new">
              <Button>Новый контакт</Button>
            </Link>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Список контактов</CardTitle>
        </CardHeader>
        <CardContent>
          {result.items.length === 0 ? (
            <EmptyState
              title="Контактов не найдено"
              description="Начните с создания нового контакта."
              actionHref="/crm/new"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Контакт</TableHead>
                  <TableHead className="text-center">Компания</TableHead>
                  <TableHead className="w-40 text-center">Email</TableHead>
                  <TableHead className="w-40 text-center">Телефон</TableHead>
                  <TableHead className="text-center">Статус</TableHead>
                  <TableHead className="w-32">Создано</TableHead>
                  <TableHead className="w-24">Заявок</TableHead>
                  <TableHead className="w-24">Задач</TableHead>
                  <TableHead className="w-24">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((contact) => {
                  const c = contact as { _count?: { leads: number; tasks: number } };
                  return (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Link href={`/crm/${contact.id}`} className="font-medium">
                          {contact.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.company || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground text-center">
                        {contact.email || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground text-center">
                        {contact.phone || "—"}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        <Badge variant="secondary">
                          {CONTACT_STATUS_LABELS[contact.status as keyof typeof CONTACT_STATUS_LABELS] || contact.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(contact.createdAt)}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {c._count?.leads ?? 0}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {c._count?.tasks ?? 0}
                      </TableCell>
                      <TableCell className="text-center">
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
          Создать контакт
        </Link>
      )}
    </div>
  );
}

