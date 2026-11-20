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
import {
  AUTOMATION_STATUS_LABELS,
  INTEGRATION_STATUS_LABELS,
  ROLE_LABELS,
  formatDateTime,
} from "@/lib/utils/labels";
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
import Link from "next/link";

export const dynamic = "force-dynamic";

type SettingsSearchParams = {
  page?: string;
  status?: string;
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

function isAutomationStatus(
  value: string | undefined,
): value is (typeof AUTOMATION_EVENT_STATUSES)[number] {
  return Boolean(
    value &&
    AUTOMATION_EVENT_STATUSES.includes(value as (typeof AUTOMATION_EVENT_STATUSES)[number]),
  );
}

function eventBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case "DELIVERED":
      return "success";
    case "SENT":
      return "default";
    case "FAILED":
      return "destructive";
    case "PENDING":
    case "RETRYING":
      return "warning";
    default:
      return "secondary";
  }
}

function integrationBadgeVariant(status: string | null): BadgeVariant {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "ERROR":
      return "destructive";
    default:
      return "secondary";
  }
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
    <div className="space-y-6">
      <PageHeader
        title="Настройки"
        description="Профиль, автоматизация n8n и журнал доставки событий"
        actions={<LogoutButton />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Профиль</CardTitle>
          <CardDescription>
            Данные доступны только для чтения. Изменение профиля появится позже.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ReadOnlyField label="Имя" value={user.name} />
          <ReadOnlyField label="Email" value={user.email} />
          <ReadOnlyField label="Роль" value={ROLE_LABELS[user.role]} />
          <ReadOnlyField label="Рабочее пространство" value={user.workspaceName} />
        </CardContent>
      </Card>

      {!canView ? (
        <Alert>
          <AlertTitle>Автоматизация недоступна</AlertTitle>
          <AlertDescription>
            Журнал событий, статус n8n/Telegram и ручной повтор доступны ролям ADMIN и MANAGER.
            Обратитесь к администратору рабочего пространства.
          </AlertDescription>
        </Alert>
      ) : loadError ? (
        <Alert variant="destructive">
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
        <CardHeader>
          <CardTitle className="text-sm font-medium">Безопасность</CardTitle>
          <CardDescription>
            Секреты n8n, Telegram и PostgreSQL задаются только через ENV и Credentials n8n. В
            интерфейсе они не отображаются и не редактируются.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoutButton />
        </CardContent>
      </Card>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
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

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {AUTOMATION_EVENT_STATUSES.map((eventStatus) => (
          <Card key={eventStatus}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">
                {AUTOMATION_STATUS_LABELS[eventStatus]}
              </p>
              <p className="mt-1 text-2xl font-semibold">{status.counts[eventStatus]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Политика доставки</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <p>
            За один цикл: до <strong>{status.policy.maxBatch}</strong> событий.
          </p>
          <p>
            Lease: <strong>{status.policy.leaseMinutes} мин</strong>.
          </p>
          <p>
            Попытки: <strong>1 + 3</strong> (1, 5, 30 мин).
          </p>
          <p>
            Максимальный возраст: <strong>{status.policy.maxAgeHours} ч</strong>.
          </p>
        </CardContent>
      </Card>
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
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <CardDescription>{details}</CardDescription>
        </div>
        <Badge variant={integrationBadgeVariant(integrationStatus)}>
          {integrationStatus
            ? INTEGRATION_STATUS_LABELS[integrationStatus as keyof typeof INTEGRATION_STATUS_LABELS]
            : "Нет записи"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <p>
          {kind === "env" ? "Переменные окружения" : "Интеграция"}:{" "}
          <span className="font-medium text-foreground">
            {kind === "env"
              ? configured
                ? "настроены"
                : "не настроены"
              : integrationStatus && integrationStatus !== "NOT_CONFIGURED"
                ? "подтверждена callback"
                : "нет подтверждения"}
          </span>
        </p>
        <p>
          Последняя проверка:{" "}
          <span className="font-medium text-foreground">
            {lastCheckedAt ? formatDateTime(lastCheckedAt) : "ещё не было"}
          </span>
        </p>
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
      <AlertTitle>Требуется ручная сверка: {staleClaims.length} CLAIMED старше 15 минут</AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          n8n захватил событие, но не подтвердил результат. Автоматическая переотправка отключена.
          Проверьте Telegram и таблицу
          <code className="mx-1 rounded bg-muted px-1">n8n_processed</code>.
        </p>
        <ul className="space-y-1">
          {staleClaims.map((claim) => (
            <li key={claim.idempotencyKey} className="text-xs">
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
  const filterParams = new URLSearchParams();

  if (statusFilter) {
    filterParams.set("status", statusFilter);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Журнал событий автоматизации</CardTitle>
        <CardDescription>
          Всего событий: {events.pagination.total}. Время последней попытки — время последнего
          изменения события.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
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
          <div className="py-10 text-center">
            <p className="text-sm font-medium">Событий пока нет</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Создайте заявку — событие автоматизации появится в этом журнале.
            </p>
          </div>
        ) : (
          <>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Событие</TableHead>
                    <TableHead className="text-center">Статус</TableHead>
                    <TableHead className="text-center">Попытки</TableHead>
                    <TableHead>Последняя попытка</TableHead>
                    <TableHead>Ошибка</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.items.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Link
                          href={`/leads/${event.entityId}`}
                          className="font-medium hover:underline"
                        >
                          {readPayloadTitle(event.payload)}
                        </Link>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {event.idempotencyKey}
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={eventBadgeVariant(event.status)}>
                          {AUTOMATION_STATUS_LABELS[event.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">{event.attempts}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <p>{formatDateTime(event.updatedAt)}</p>
                        {event.status === "RETRYING" && event.nextRetryAt ? (
                          <p className="text-xs">Повтор: {formatDateTime(event.nextRetryAt)}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[260px] text-sm text-muted-foreground">
                        <span className="line-clamp-2" title={event.lastError ?? undefined}>
                          {event.lastError ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {canRetry &&
                        event.status === "FAILED" &&
                        Date.now() - new Date(event.createdAt).getTime() < 24 * 60 * 60 * 1000 ? (
                          <AutomationRetryButton eventId={event.id} />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {event.status === "FAILED" ? "Срок истёк" : "—"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <EventsPagination
              page={events.pagination.page}
              totalPages={events.pagination.totalPages}
              total={events.pagination.total}
              statusFilter={statusFilter}
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
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </Link>
  );
}

function EventsPagination({
  page,
  totalPages,
  total,
  statusFilter,
}: {
  page: number;
  totalPages: number;
  total: number;
  statusFilter: string | undefined;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const suffix = statusFilter ? `&status=${statusFilter}` : "";

  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">
        Страница {page} из {totalPages} · всего {total}
      </p>
      <div className="flex items-center gap-3 text-sm">
        {page > 1 ? (
          <Link
            href={`/settings?page=${page - 1}${suffix}`}
            className="text-primary hover:underline"
          >
            ← Назад
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            href={`/settings?page=${page + 1}${suffix}`}
            className="text-primary hover:underline"
          >
            Вперёд →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
