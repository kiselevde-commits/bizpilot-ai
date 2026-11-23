import { requireUser } from "@/lib/auth/session";
import { canViewAutomation } from "@/lib/auth/roles";
import {
  getAutomationStatus,
  listAutomationEvents,
  queueAutomationDispatch,
  type AutomationEventListResult,
  type AutomationStatusResult,
} from "@/services/automation.service";
import { AUTOMATION_EVENT_STATUSES } from "@/lib/constants";
import { AUTOMATION_STATUS_LABELS, ROLE_LABELS, formatDateTime } from "@/lib/utils/labels";
import { initials } from "@/lib/utils/initials";
import { PageHeader } from "@/components/layout/page-header";
import { LogoutButton } from "@/components/auth/logout-button";
import { AutomationRetryButton } from "@/components/automation/retry-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataPagination } from "@/components/ui/data-pagination";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertTriangle,
  Building2,
  Clock3,
  Database,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRound,
  Users,
  Webhook,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SettingsSearchParams = {
  page?: string;
  status?: string;
};

function isAutomationStatus(
  value: string | undefined,
): value is (typeof AUTOMATION_EVENT_STATUSES)[number] {
  return Boolean(
    value &&
    AUTOMATION_EVENT_STATUSES.includes(value as (typeof AUTOMATION_EVENT_STATUSES)[number]),
  );
}

function readPayloadTitle(payload: unknown): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const title = (payload as Record<string, unknown>).title;

    if (typeof title === "string" && title.trim().length > 0) {
      return title;
    }
  }

  return "Событие заявки";
}

export default async function SettingsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<SettingsSearchParams>;
}>) {
  const user = await requireUser();
  const params = await searchParams;
  const canView = canViewAutomation(user.role);
  const statusFilter = isAutomationStatus(params.status) ? params.status : undefined;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  let automationStatus: AutomationStatusResult | null = null;
  let events: AutomationEventListResult | null = null;
  let loadError = false;

  if (canView) {
    queueAutomationDispatch();

    try {
      [automationStatus, events] = await Promise.all([
        getAutomationStatus(user),
        listAutomationEvents(user, {
          page,
          limit: 20,
          status: statusFilter,
          sort: "createdAt:desc",
        }),
      ]);
    } catch {
      loadError = true;
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Workspace settings"
        title="Настройки"
        description="Профиль, рабочее пространство, интеграции и журнал доставки событий."
        actions={<LogoutButton />}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div
            className="h-20 bg-[linear-gradient(120deg,hsl(var(--primary)/0.12),hsl(var(--iris)/0.10),hsl(var(--aqua)/0.08))]"
            aria-hidden="true"
          />
          <CardContent className="-mt-10 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-3">
                <Avatar className="h-16 w-16 rounded-2xl shadow-lifted">
                  <AvatarFallback className="rounded-2xl text-[18px]">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 pb-0.5">
                  <h2 className="truncate text-[18px] font-semibold tracking-[-0.02em] text-ink">
                    {user.name}
                  </h2>
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{user.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="indigo">{ROLE_LABELS[user.role]}</Badge>
                    <Badge variant="secondary">Профиль только для чтения</Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-3">
              <ReadOnlyField icon={ShieldCheck} label="Роль" value={ROLE_LABELS[user.role]} />
              <ReadOnlyField
                icon={Building2}
                label="Рабочее пространство"
                value={user.workspaceName}
              />
              <ReadOnlyField icon={UserRound} label="Доступ" value="Только чтение" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aqua/10 text-aqua">
                <Building2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <CardTitle>Рабочее пространство</CardTitle>
                <CardDescription>{user.workspaceName}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoLine icon={Users} label="Команда">
              ADMIN, MANAGER и OPERATOR с серверной проверкой ролей
            </InfoLine>
            <InfoLine icon={Database} label="Данные">
              Все записи изолированы по workspaceId
            </InfoLine>
            <InfoLine icon={ShieldCheck} label="Доступ">
              Изменения профиля и секретов выполняются вне интерфейса
            </InfoLine>
          </CardContent>
        </Card>
      </div>

      {!canView ? (
        <Alert>
          <ShieldCheck aria-hidden="true" />
          <AlertTitle>Автоматизация недоступна</AlertTitle>
          <AlertDescription>
            Журнал событий, статус n8n/Telegram и ручной повтор доступны ролям ADMIN и MANAGER.
            Обратитесь к администратору рабочего пространства.
          </AlertDescription>
        </Alert>
      ) : loadError ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Не удалось загрузить автоматизацию</AlertTitle>
          <AlertDescription>
            Проверьте подключение к PostgreSQL и обновите страницу.
          </AlertDescription>
        </Alert>
      ) : automationStatus && events ? (
        <>
          <AutomationOverview status={automationStatus} />
          <StaleClaimsAlert staleClaims={automationStatus.staleClaims} />
          <EventsCard events={events} statusFilter={statusFilter} canRetry={canView} />
        </>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>Безопасность</CardTitle>
              <CardDescription>
                Секреты задаются только через ENV и Credentials n8n. В интерфейсе они не
                отображаются и не редактируются.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
            Секреты AI, n8n и Telegram не попадают в client bundle.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReadOnlyField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 truncate text-[13px] font-medium text-ink">{value}</p>
      </div>
    </div>
  );
}

function InfoLine({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-white/50 px-3 py-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function AutomationOverview({ status }: { status: AutomationStatusResult }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <IntegrationCard
          title="n8n"
          kind="env"
          configured={status.n8n.configured}
          integrationStatus={status.n8n.integrationStatus}
          lastCheckedAt={status.n8n.lastCheckedAt}
          details={
            status.n8n.callbackConfigured
              ? "Callback-секрет настроен"
              : "Callback-секрет не настроен"
          }
        />
        <IntegrationCard
          title="Telegram"
          kind="callback"
          configured={status.telegram.configured}
          integrationStatus={status.telegram.integrationStatus}
          lastCheckedAt={status.telegram.lastCheckedAt}
          details="Отправка выполняется workflow n8n, приложение только подтверждает callback"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {AUTOMATION_EVENT_STATUSES.map((eventStatus) => (
          <Card key={eventStatus}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  {AUTOMATION_STATUS_LABELS[eventStatus]}
                </p>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    eventStatus === "DELIVERED"
                      ? "bg-success"
                      : eventStatus === "FAILED"
                        ? "bg-destructive"
                        : eventStatus === "SENT"
                          ? "bg-primary"
                          : "bg-warning"
                  }`}
                  aria-hidden="true"
                />
              </div>
              <p className="mt-2 text-[24px] font-semibold tabular-nums leading-none tracking-[-0.03em] text-ink">
                {status.counts[eventStatus]}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>Политика доставки</CardTitle>
              <CardDescription>PostgreSQL Outbox, lease и контролируемые повторы</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 text-[12px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <PolicyItem label="За один цикл" value={`${status.policy.maxBatch} событий`} />
          <PolicyItem label="Lease" value={`${status.policy.leaseMinutes} мин`} />
          <PolicyItem label="Попытки" value="1 + 3 (1, 5, 30 мин)" />
          <PolicyItem label="Максимальный возраст" value={`${status.policy.maxAgeHours} ч`} />
        </CardContent>
      </Card>
    </div>
  );
}

function PolicyItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-ink">{value}</p>
    </div>
  );
}

function IntegrationCard({
  title,
  kind,
  configured,
  integrationStatus,
  lastCheckedAt,
  details,
}: {
  title: string;
  kind: "env" | "callback";
  configured: boolean;
  integrationStatus: string | null;
  lastCheckedAt: Date | null;
  details: string;
}) {
  const Icon = title === "Telegram" ? Send : Webhook;

  return (
    <Card className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary/[0.05] to-transparent"
        aria-hidden="true"
      />
      <CardHeader className="relative flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1 max-w-sm">{details}</CardDescription>
          </div>
        </div>
        <StatusBadge
          kind="integration"
          value={integrationStatus ?? "NOT_CONFIGURED"}
          label={integrationStatus ? undefined : "Нет записи"}
        />
      </CardHeader>
      <CardContent className="relative grid gap-2 text-[12px] text-muted-foreground sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-white/50 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
            {kind === "env" ? "Переменные окружения" : "Интеграция"}
          </p>
          <p className="mt-0.5 font-medium text-ink">
            {kind === "env"
              ? configured
                ? "настроены"
                : "не настроены"
              : integrationStatus && integrationStatus !== "NOT_CONFIGURED"
                ? "подтверждена callback"
                : "нет подтверждения"}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-white/50 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
            Последняя проверка
          </p>
          <p className="mt-0.5 font-medium text-ink">
            {lastCheckedAt ? formatDateTime(lastCheckedAt) : "ещё не было"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StaleClaimsAlert({ staleClaims }: { staleClaims: AutomationStatusResult["staleClaims"] }) {
  if (staleClaims.length === 0) {
    return null;
  }

  return (
    <Alert variant="warning">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>Требуется ручная сверка: {staleClaims.length} CLAIMED старше 15 минут</AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          n8n захватил событие, но не подтвердил результат. Автоматическая переотправка отключена.
          Проверьте Telegram и таблицу
          <code className="mx-1 rounded bg-muted px-1">n8n_processed</code>.
        </p>
        <ul className="space-y-1">
          {staleClaims.map((claim) => (
            <li key={claim.idempotencyKey} className="text-[11px]">
              <span className="font-mono">{claim.idempotencyKey}</span> —{" "}
              {formatDateTime(claim.claimedAt)}
              {claim.lastError ? ` — ${claim.lastError}` : ""}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function EventsCard({
  events,
  statusFilter,
  canRetry,
}: {
  events: AutomationEventListResult;
  statusFilter: string | undefined;
  canRetry: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-iris/10 text-iris">
            <Database className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <CardTitle>Журнал событий автоматизации</CardTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Всего событий: {events.pagination.total}
            </p>
          </div>
        </div>
        <span className="hidden text-[11px] text-muted-foreground sm:block">
          Время последней попытки — время изменения события
        </span>
      </CardHeader>
      <CardContent className="space-y-4 p-0 pt-4 sm:p-0 sm:pt-4">
        <div className="flex flex-wrap gap-1.5 px-4 sm:px-5">
          <FilterLink href="/settings" active={!statusFilter}>
            Все
          </FilterLink>
          {AUTOMATION_EVENT_STATUSES.map((eventStatus) => (
            <FilterLink
              key={eventStatus}
              href={`/settings?status=${eventStatus}`}
              active={statusFilter === eventStatus}
            >
              {AUTOMATION_STATUS_LABELS[eventStatus]}
            </FilterLink>
          ))}
        </div>

        {events.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Database className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-[14px] font-semibold">Событий пока нет</p>
            <p className="max-w-sm text-[12px] text-muted-foreground">
              Создайте заявку — событие автоматизации появится в этом журнале.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Событие</TableHead>
                    <TableHead className="text-center">Статус</TableHead>
                    <TableHead className="hidden text-center min-[1400px]:table-cell">
                      Попытки
                    </TableHead>
                    <TableHead>Последняя попытка</TableHead>
                    <TableHead>Ошибка</TableHead>
                    <TableHead className="pr-5 text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.items.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="max-w-[16rem] pl-5">
                        <Link
                          href={`/leads/${event.entityId}`}
                          className="block truncate font-semibold text-ink transition-colors hover:text-primary"
                        >
                          {readPayloadTitle(event.payload)}
                        </Link>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                          {event.idempotencyKey}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge kind="automation" value={event.status} />
                      </TableCell>
                      <TableCell className="hidden text-center text-[13px] tabular-nums min-[1400px]:table-cell">
                        {event.attempts}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-[12px] text-muted-foreground">
                        <p>{formatDateTime(event.updatedAt)}</p>
                        {event.status === "RETRYING" && event.nextRetryAt ? (
                          <p className="mt-0.5 text-[10px]">
                            Повтор: {formatDateTime(event.nextRetryAt)}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[16rem] text-[12px] text-muted-foreground">
                        <span className="line-clamp-2" title={event.lastError ?? undefined}>
                          {event.lastError ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        {canRetry &&
                        event.status === "FAILED" &&
                        Date.now() - new Date(event.createdAt).getTime() < 24 * 60 * 60 * 1000 ? (
                          <AutomationRetryButton eventId={event.id} />
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {event.status === "FAILED" ? "Срок истёк" : "—"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y divide-border/60 md:hidden">
              {events.items.map((event) => (
                <div key={event.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/leads/${event.entityId}`}
                      className="min-w-0 text-[13px] font-semibold text-ink"
                    >
                      {readPayloadTitle(event.payload)}
                    </Link>
                    <StatusBadge kind="automation" value={event.status} />
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                    {event.idempotencyKey}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" aria-hidden="true" />
                      Попытки: {event.attempts}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3 w-3" aria-hidden="true" />
                      {formatDateTime(event.updatedAt)}
                    </span>
                  </div>
                  {event.lastError ? (
                    <p className="mt-2 line-clamp-2 rounded-lg bg-destructive/[0.05] px-2 py-1.5 text-[11px] text-destructive">
                      {event.lastError}
                    </p>
                  ) : null}
                  {canRetry &&
                  event.status === "FAILED" &&
                  Date.now() - new Date(event.createdAt).getTime() < 24 * 60 * 60 * 1000 ? (
                    <div className="mt-2">
                      <AutomationRetryButton eventId={event.id} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <DataPagination
              page={events.pagination.page}
              limit={events.pagination.limit}
              total={events.pagination.total}
              totalPages={events.pagination.totalPages}
              basePath="/settings"
              query={{ status: statusFilter }}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-150 ${
        active
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-border/70 bg-white/60 text-muted-foreground hover:border-primary/20 hover:text-primary"
      }`}
    >
      {children}
    </Link>
  );
}
