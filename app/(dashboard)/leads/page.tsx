import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  Inbox,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { listLeads, type LeadListQuery } from "@/services/lead.service";
import { requireUser } from "@/lib/auth/session";
import { paginationQuerySchema } from "@/lib/validation/query";
import { LEAD_STATUSES, PRIORITIES } from "@/lib/constants";
import { LEAD_STATUS_LABELS, PRIORITY_LABELS, formatDateTime } from "@/lib/utils/labels";
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
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataPagination } from "@/components/ui/data-pagination";
import { Alert } from "@/components/ui/alert";

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
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sales pipeline"
        title="Заявки"
        description="Входящие обращения, статусы обработки и AI-оценка в единой CRM-воронке."
        actions={
          <Button asChild>
            <Link href="/leads/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Новая заявка
            </Link>
          </Button>
        }
      />

      <form
        method="get"
        action="/leads"
        aria-label="Фильтры заявок"
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
            <label htmlFor="lead-search" className="text-[11px] font-medium text-muted-foreground">
              Поиск
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="lead-search"
                name="search"
                type="search"
                defaultValue={search}
                placeholder="Название, текст или источник"
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-2">
            <label htmlFor="lead-status" className="text-[11px] font-medium text-muted-foreground">
              Статус
            </label>
            <Select id="lead-status" name="status" defaultValue={status ?? ""}>
              <option value="">Все статусы</option>
              {LEAD_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {LEAD_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-2">
            <label
              htmlFor="lead-priority"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Приоритет
            </label>
            <Select id="lead-priority" name="priority" defaultValue={priority ?? ""}>
              <option value="">Все приоритеты</option>
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-2">
            <label htmlFor="lead-sort" className="text-[11px] font-medium text-muted-foreground">
              Сортировка
            </label>
            <Select id="lead-sort" name="sort" defaultValue={sort}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
              <Link href="/leads">
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
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Inbox className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>Список заявок</CardTitle>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {result.pagination.total} записей в рабочем пространстве
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
            <EmptyState hasFilters={hasFilters} />
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[15rem] pl-5">Заявка</TableHead>
                      <TableHead className="text-center">Статус</TableHead>
                      <TableHead className="hidden text-center sm:table-cell">Приоритет</TableHead>
                      <TableHead className="hidden lg:table-cell text-center">Score</TableHead>
                      <TableHead className="hidden min-[1400px]:table-cell">Контакт</TableHead>
                      <TableHead className="hidden min-[1600px]:table-cell">Создано</TableHead>
                      <TableHead className="pr-5 text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((item) => {
                      const lead = item as LeadListItem;
                      return (
                        <ClickableTableRow
                          key={lead.id}
                          href={`/leads/${lead.id}`}
                          className="group"
                        >
                          <TableCell className="pl-5">
                            <Link
                              href={`/leads/${lead.id}`}
                              className="block max-w-[24rem] truncate font-semibold text-ink transition-colors group-hover:text-primary"
                            >
                              {lead.title}
                            </Link>
                            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                              {lead.source || "Без источника"}
                            </span>
                            {lead.contact?.name ? (
                              <span className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground min-[1400px]:hidden">
                                <UserRound className="h-3 w-3 shrink-0" aria-hidden="true" />
                                {lead.contact.name}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusBadge kind="lead" value={lead.status} />
                          </TableCell>
                          <TableCell className="hidden text-center sm:table-cell">
                            <StatusBadge kind="priority" value={lead.priority} />
                          </TableCell>
                          <TableCell className="hidden text-center lg:table-cell">
                            <ScoreMeter score={lead.leadScore} />
                          </TableCell>
                          <TableCell className="hidden max-w-[12rem] truncate text-[13px] text-muted-foreground min-[1400px]:table-cell">
                            <span className="flex items-center gap-1.5 truncate text-[13px] text-muted-foreground">
                              <UserRound
                                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                              {lead.contact?.name || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap text-[12px] text-muted-foreground min-[1600px]:table-cell">
                            {formatDateTime(lead.createdAt)}
                          </TableCell>
                          <TableCell className="pr-5 text-right">
                            <Link
                              href={`/leads/${lead.id}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                              aria-label="Открыть карточку заявки"
                            >
                              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                            </Link>
                          </TableCell>
                        </ClickableTableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y divide-border/60 md:hidden">
                {result.items.map((item) => {
                  const lead = item as LeadListItem;
                  return (
                    <Link
                      key={lead.id}
                      href={`/leads/${lead.id}`}
                      className="block px-4 py-4 transition-colors active:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-ink">{lead.title}</p>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {lead.source || "Без источника"}
                          </p>
                        </div>
                        <ArrowUpRight
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <StatusBadge kind="lead" value={lead.status} />
                        <StatusBadge kind="priority" value={lead.priority} />
                        <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-white/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          <CalendarClock className="h-3 w-3" aria-hidden="true" />
                          {formatDateTime(lead.createdAt)}
                        </span>
                        {typeof lead.leadScore === "number" ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Score {lead.leadScore}
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
          basePath="/leads"
          query={{ search, status: status ?? "", priority: priority ?? "", sort, limit }}
        />
      </Card>
    </div>
  );
}

function ScoreMeter({ score }: { score: number | null }) {
  if (typeof score !== "number") {
    return <span className="text-[12px] text-muted-foreground">—</span>;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-brand-gradient"
          style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
        />
      </span>
      <span className="w-6 text-right text-[12px] font-semibold tabular-nums text-ink">
        {score}
      </span>
    </span>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-[15px] font-semibold">
          {hasFilters ? "По фильтрам ничего не найдено" : "Заявок пока нет"}
        </h2>
        <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
          {hasFilters
            ? "Измените условия поиска или сбросьте фильтры."
            : "Создайте первую заявку — AI-помощник проанализирует её."}
        </p>
      </div>
      <Link
        href={hasFilters ? "/leads" : "/leads/new"}
        className="mt-1 text-[13px] font-medium text-primary hover:underline"
      >
        {hasFilters ? "Сбросить фильтры" : "Создать заявку"}
      </Link>
    </div>
  );
}
