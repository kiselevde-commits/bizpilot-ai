import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckSquare,
  Clock3,
  FlaskConical,
  Inbox,
  ListChecks,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { getDashboardData, hasDemoData } from "@/services/dashboard.service";
import { requireUser } from "@/lib/auth/session";
import { queueAutomationDispatch } from "@/services/automation.service";
import { LEAD_STATUSES } from "@/lib/constants";
import { LEAD_STATUS_LABELS, PRIORITY_LABELS, formatDateTime } from "@/lib/utils/labels";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Обзор" };

const STATUS_COLORS: Record<string, string> = {
  NEW: "#5968ED",
  ANALYZING: "#9671F5",
  QUALIFIED: "#29B5AB",
  IN_PROGRESS: "#4F7EF7",
  WAITING: "#D99A39",
  CONVERTED: "#239B78",
  REJECTED: "#D65D71",
};

export default async function DashboardPage() {
  const user = await requireUser();
  queueAutomationDispatch();
  const [data, demoData] = await Promise.all([getDashboardData(user), hasDemoData(user)]);
  const today = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" }).format(new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Executive overview"
        title="Обзор"
        description={`Пульс рабочего пространства «${user.workspaceName}»: заявки, контакты, задачи и AI-аналитика в одном месте.`}
        actions={
          <>
            <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-white/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-soft sm:flex">
              <CalendarDays className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {today}
            </div>
            <Button asChild variant="secondary">
              <Link href="/ai-assistant">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                AI-анализ
              </Link>
            </Button>
          </>
        }
      />

      {demoData ? (
        <Alert data-testid="demo-data-banner" className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <AlertTitle>Демонстрационные данные</AlertTitle>
            <AlertDescription>
              Это тестовое рабочее пространство. Заявки и задачи с префиксом{" "}
              <span className="font-semibold text-ink">[DEMO]</span> вымышлены и созданы
              seed-скриптом.
            </AlertDescription>
          </div>
        </Alert>
      ) : null}

      <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ключевые метрики">
        <MetricCard
          title="Всего заявок"
          value={data.metrics.totalLeads}
          description={`Новых: ${data.metrics.newLeads}`}
          icon={Inbox}
          tone="indigo"
          progress={
            data.metrics.totalLeads > 0
              ? Math.round((data.metrics.inProgressLeads / data.metrics.totalLeads) * 100)
              : 0
          }
        />
        <MetricCard
          title="Контакты"
          value={data.metrics.totalContacts}
          description="Связанные контакты"
          icon={Users}
          tone="teal"
        />
        <MetricCard
          title="Задачи"
          value={data.metrics.totalTasks}
          description={
            data.metrics.overdueTasks > 0
              ? `Просрочено: ${data.metrics.overdueTasks}`
              : "Нет просроченных"
          }
          icon={ListChecks}
          tone="violet"
          alert={data.metrics.overdueTasks > 0}
        />
        <MetricCard
          title="Конверсия"
          value={`${data.metrics.conversionRate}%`}
          description={`Конвертировано: ${data.metrics.convertedLeads}`}
          icon={TrendingUp}
          tone="amber"
          progress={data.metrics.conversionRate}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Аналитика заявок">
        <LeadsByStatusChart data={data.leadsByStatus} />
        <LeadsByDayChart data={data.leadsByDay} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3" aria-label="Приоритетные заявки и задачи">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>Приоритетные заявки</CardTitle>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Срочные и высокоприоритетные обращения
              </p>
            </div>
            <Link
              href="/leads?sort=priority:desc"
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-medium text-primary transition-colors hover:text-iris"
            >
              Весь список
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {data.priorityLeads.length === 0 ? (
              <EmptyPreview text="Нет активных заявок с высоким приоритетом." />
            ) : (
              data.priorityLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  data-testid="priority-lead"
                  data-lead-id={lead.id}
                  data-priority={lead.priority}
                  data-created-at={lead.createdAt.toISOString()}
                  className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-all duration-150 hover:border-border/80 hover:bg-white hover:shadow-soft"
                >
                  <span
                    className={cn(
                      "h-9 w-1 shrink-0 rounded-full",
                      lead.priority === "URGENT"
                        ? "bg-destructive"
                        : lead.priority === "HIGH"
                          ? "bg-warning"
                          : "bg-primary/40",
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink group-hover:text-primary">
                      {lead.title}
                    </p>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                      <StatusBadge kind="lead" value={lead.status} dot={false} />
                      <span className="truncate text-[11px] text-muted-foreground">
                        {lead.contact?.name ?? "Без контакта"}
                      </span>
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-[11px] font-medium text-muted-foreground">Lead Score</p>
                    <p className="text-sm font-semibold tabular-nums text-ink">
                      {typeof lead.leadScore === "number" ? lead.leadScore : "—"}
                    </p>
                  </div>
                  <ArrowUpRight
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                    aria-hidden="true"
                  />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>Требуют внимания</CardTitle>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Просроченные и ближайшие приоритетные задачи
              </p>
            </div>
            {/* The preview intentionally shows overdue priority tasks as well as
                the nearest upcoming tasks, so the list link sorts by due date
                rather than filtering to only overdue tasks. */}
            <Link
              href="/tasks?sort=dueDate:asc"
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-medium text-primary transition-colors hover:text-iris"
            >
              Список
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {data.attentionTasks.length === 0 ? (
              <EmptyPreview text="Задач с установленным сроком пока нет." />
            ) : (
              data.attentionTasks.map((task) => {
                const overdue =
                  task.dueDate !== null && new Date(task.dueDate).getTime() < Date.now();

                return (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    data-testid="attention-task"
                    data-task-id={task.id}
                    data-priority={task.priority}
                    data-status={task.status}
                    data-due-date={task.dueDate?.toISOString() ?? ""}
                    className="group flex items-start gap-3 rounded-xl border border-transparent px-2.5 py-2.5 transition-all duration-150 hover:border-border/80 hover:bg-white hover:shadow-soft"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        overdue
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/[0.08] text-primary",
                      )}
                    >
                      {overdue ? (
                        <Clock3 className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <CheckSquare className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-[13px] font-medium text-ink group-hover:text-primary">
                        {task.title}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-[11px]",
                          overdue ? "font-medium text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {overdue ? "Просрочена · " : "Срок · "}
                        {task.dueDate ? formatDateTime(task.dueDate) : "—"}
                      </p>
                    </div>
                    <span className="mt-1 shrink-0 text-[10px] font-medium text-muted-foreground">
                      {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS] ??
                        task.priority}
                    </span>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
  progress,
  alert,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone: "indigo" | "teal" | "violet" | "amber";
  progress?: number;
  alert?: boolean;
}) {
  const toneClasses = {
    indigo: "bg-primary/10 text-primary",
    teal: "bg-aqua/10 text-aqua",
    violet: "bg-iris/10 text-iris",
    amber: "bg-warning/[0.12] text-[#7d5410]",
  } as const;

  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-muted-foreground">{title}</p>
            <p className="metric-value mt-3">{value}</p>
          </div>
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-inset",
              toneClasses[tone],
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
        </div>

        {typeof progress === "number" ? (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand-gradient transition-all duration-500"
              style={{
                width: progress === 0 ? "0%" : `${Math.max(2, Math.min(100, progress))}%`,
              }}
            />
          </div>
        ) : null}

        <p
          className={cn(
            "mt-3 text-[11px]",
            alert ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

function LeadsByStatusChart({ data }: { data: { status: string; count: number }[] }) {
  const counts = new Map(data.map((row) => [row.status, row.count]));
  const ordered = LEAD_STATUSES.map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  })).filter((row) => row.count > 0);
  const total = ordered.reduce((sum, row) => sum + row.count, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle>Воронка заявок</CardTitle>
          <p className="mt-1 text-[12px] text-muted-foreground">Распределение по статусам</p>
        </div>
        <span className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {total} всего
        </span>
      </CardHeader>
      <CardContent className="space-y-5">
        {total === 0 ? (
          <EmptyPreview text="Заявок пока нет." />
        ) : (
          <>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              {ordered.map((row) => (
                <div
                  key={row.status}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${(row.count / total) * 100}%`,
                    backgroundColor: STATUS_COLORS[row.status] ?? "#5968ED",
                  }}
                  title={`${LEAD_STATUS_LABELS[row.status as keyof typeof LEAD_STATUS_LABELS] ?? row.status}: ${row.count}`}
                />
              ))}
            </div>

            <ul className="space-y-3">
              {ordered.map((row) => {
                const percent = total > 0 ? Math.round((row.count / total) * 100) : 0;
                const color = STATUS_COLORS[row.status] ?? "#5968ED";

                return (
                  <li key={row.status} className="flex items-center gap-3 text-[13px]">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {LEAD_STATUS_LABELS[row.status as keyof typeof LEAD_STATUS_LABELS] ??
                        row.status}
                    </span>
                    <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${percent}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="w-8 text-right text-[12px] font-semibold tabular-nums text-ink">
                      {row.count}
                    </span>
                    <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
                      {percent}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function formatChartDate(value: string): string {
  const [year, month, day] = value.split("-");

  return year && month && day ? `${day}.${month}.${year}` : value;
}

function LeadsByDayChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((row) => row.count));
  const total = data.reduce((sum, row) => sum + row.count, 0);
  const firstDate = data[0]?.date ?? "";
  const lastDate = data[data.length - 1]?.date ?? "";
  const peak = data.reduce((best, row) => (row.count > best.count ? row : best), {
    date: "",
    count: 0,
  });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle id="leads-by-day-title">Динамика заявок</CardTitle>
          <p className="mt-1 text-[12px] text-muted-foreground">Последние 14 дней</p>
        </div>
        <span className="rounded-full border border-primary/[0.15] bg-primary/[0.06] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-primary">
          +{total} за период
        </span>
      </CardHeader>
      <CardContent>
        <figure aria-labelledby="leads-by-day-title" aria-describedby="leads-by-day-summary">
          {/* Purely visual bars; the accessible equivalent is the data table below. */}
          <div aria-hidden="true" className="relative mt-2 flex h-44 items-end gap-1.5 sm:gap-2">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-border/60" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-border/40" />
            {data.map((row) => {
              const height = row.count === 0 ? 2 : Math.max(6, Math.round((row.count / max) * 100));
              return (
                <div key={row.date} className="group relative flex h-full flex-1 items-end">
                  <div
                    className={cn(
                      "w-full rounded-t-md transition-all duration-200 group-hover:opacity-80",
                      row.count === 0
                        ? "bg-muted"
                        : "bg-[linear-gradient(180deg,#7C8AF5_0%,#5968ED_100%)] shadow-[0_5px_16px_-8px_rgba(89,104,237,0.8)]",
                    )}
                    style={{ height: `${height}%` }}
                    title={`${row.date}: ${row.count}`}
                  />
                  <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-medium text-white group-hover:block">
                    {row.count}
                  </span>
                </div>
              );
            })}
          </div>
          <div aria-hidden="true" className="mt-2 flex gap-1.5 sm:gap-2">
            {data.map((row, index) => (
              <div key={row.date} className="min-w-0 flex-1 text-center">
                {index % 2 === 0 ? (
                  <span className="text-[9px] tabular-nums text-muted-foreground">
                    {row.date.slice(5).replace("-", ".")}
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          <figcaption id="leads-by-day-summary" className="sr-only">
            Период с {formatChartDate(firstDate)} по {formatChartDate(lastDate)}. Всего заявок за
            период: {total}.{" "}
            {peak.count > 0
              ? `Максимум — ${peak.count} за ${formatChartDate(peak.date)}.`
              : "Заявок за период не было."}
          </figcaption>

          <table className="sr-only">
            <caption>Динамика заявок по датам</caption>
            <thead>
              <tr>
                <th scope="col">Дата</th>
                <th scope="col">Количество заявок</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.date}>
                  <th scope="row">{formatChartDate(row.date)}</th>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      </CardContent>
    </Card>
  );
}

function EmptyPreview({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/30 px-4 py-6 text-[13px] text-muted-foreground">
      <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      {text}
    </div>
  );
}
