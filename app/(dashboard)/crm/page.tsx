import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Mail,
  Phone,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UserRound,
  Users,
} from "lucide-react";
import { listContacts, type ContactListQuery } from "@/services/contact.service";
import { requireUser } from "@/lib/auth/session";
import { paginationQuerySchema } from "@/lib/validation/query";
import { CONTACT_STATUSES } from "@/lib/constants";
import { CONTACT_STATUS_LABELS } from "@/lib/utils/labels";
import { initials } from "@/lib/utils/initials";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const metadata = { title: "Контакты" };

type ContactRow = {
  _count?: { leads: number; tasks: number };
};

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
    <div className="space-y-5">
      <PageHeader
        eyebrow="Customer base"
        title="Контакты"
        description="Клиенты, компании и связанные заявки — единая база для работы с клиентом."
        actions={
          <Button asChild>
            <Link href="/crm/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Новый контакт
            </Link>
          </Button>
        }
      />

      <form
        method="get"
        action="/crm"
        aria-label="Фильтры контактов"
        className="glass-panel rounded-card p-4"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
            Поиск по базе
          </div>
          {hasFilters ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              активен
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-10">
          <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-5">
            <label
              htmlFor="contact-search"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Поиск
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="contact-search"
                name="search"
                type="search"
                defaultValue={search}
                placeholder="Имя, компания, email или телефон"
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-3">
            <label
              htmlFor="contact-status"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Статус
            </label>
            <Select id="contact-status" name="status" defaultValue={status ?? ""}>
              <option value="">Все статусы</option>
              {CONTACT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {CONTACT_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-10 lg:justify-end">
            <Button type="submit">
              <Search className="h-4 w-4" aria-hidden="true" />
              Применить
            </Button>
            <Button asChild variant="ghost">
              <Link href="/crm">
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
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aqua/10 text-aqua">
              <Users className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>Список контактов</CardTitle>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {result.pagination.total} контактов в рабочем пространстве
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
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-aqua/10 text-aqua">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold">
                  {hasFilters ? "По фильтрам ничего не найдено" : "Контактов пока нет"}
                </h2>
                <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
                  {hasFilters
                    ? "Измените условия поиска или сбросьте фильтры."
                    : "Создайте первый контакт, чтобы связывать его с заявками и задачами."}
                </p>
              </div>
              <Link
                href={hasFilters ? "/crm" : "/crm/new"}
                className="mt-1 text-[13px] font-medium text-primary hover:underline"
              >
                {hasFilters ? "Сбросить фильтры" : "Создать контакт"}
              </Link>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[15rem] pl-5">Контакт</TableHead>
                      <TableHead className="hidden xl:table-cell">Email</TableHead>
                      <TableHead className="hidden 2xl:table-cell">Телефон</TableHead>
                      <TableHead className="text-center">Статус</TableHead>
                      <TableHead className="hidden text-center sm:table-cell">Заявки</TableHead>
                      <TableHead className="hidden text-center sm:table-cell">Задачи</TableHead>
                      <TableHead className="pr-5 text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((contact) => {
                      const counts = contact as typeof contact & ContactRow;
                      return (
                        <TableRow key={contact.id} className="group">
                          <TableCell className="pl-5">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 rounded-xl">
                                <AvatarFallback className="rounded-xl text-[11px]">
                                  {initials(contact.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <Link
                                  href={`/crm/${contact.id}`}
                                  className="block max-w-[18rem] truncate font-semibold text-ink transition-colors group-hover:text-primary"
                                >
                                  {contact.name}
                                </Link>
                                <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Building2 className="h-3 w-3" aria-hidden="true" />
                                  {contact.company || "Без компании"}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden max-w-[15rem] truncate text-[13px] text-muted-foreground xl:table-cell">
                            {contact.email || "—"}
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap text-[13px] text-muted-foreground 2xl:table-cell">
                            {contact.phone || "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusBadge kind="contact" value={contact.status} />
                          </TableCell>
                          <TableCell className="hidden text-center text-[13px] font-medium tabular-nums sm:table-cell">
                            {counts._count?.leads ?? 0}
                          </TableCell>
                          <TableCell className="hidden text-center text-[13px] font-medium tabular-nums sm:table-cell">
                            {counts._count?.tasks ?? 0}
                          </TableCell>
                          <TableCell className="pr-5 text-right">
                            <Link
                              href={`/crm/${contact.id}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                              aria-label="Открыть карточку контакта"
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
                {result.items.map((contact) => {
                  const counts = contact as typeof contact & ContactRow;
                  return (
                    <Link
                      key={contact.id}
                      href={`/crm/${contact.id}`}
                      className="block px-4 py-4 transition-colors active:bg-muted/50"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10 rounded-xl">
                          <AvatarFallback className="rounded-xl text-[12px]">
                            {initials(contact.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-semibold text-ink">
                                {contact.name}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                {contact.company || "Без компании"}
                              </p>
                            </div>
                            <ArrowUpRight
                              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </div>
                          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            {contact.email ? (
                              <span className="inline-flex min-w-0 items-center gap-1">
                                <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                                <span className="truncate">{contact.email}</span>
                              </span>
                            ) : null}
                            {contact.phone ? (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
                                {contact.phone}
                              </span>
                            ) : null}
                            {!contact.email && !contact.phone ? (
                              <span className="inline-flex items-center gap-1">
                                <UserRound className="h-3 w-3" aria-hidden="true" />
                                Нет способа связи
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <StatusBadge kind="contact" value={contact.status} />
                            <span className="rounded-full border border-border/70 bg-white/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Заявки: {counts._count?.leads ?? 0}
                            </span>
                            <span className="rounded-full border border-border/70 bg-white/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Задачи: {counts._count?.tasks ?? 0}
                            </span>
                          </div>
                        </div>
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
          basePath="/crm"
          query={{ search, status: status ?? "", sort, limit }}
        />
      </Card>
    </div>
  );
}
