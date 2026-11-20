import { getDashboardData, hasDemoData } from "@/services/dashboard.service";
import { requireUser } from "@/lib/auth/session";
import { queueAutomationDispatch } from "@/services/automation.service";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await requireUser();
  queueAutomationDispatch();
  const [data, demoData] = await Promise.all([getDashboardData(user), hasDemoData(user)]);

  return (
    <div className="space-y-6">
      <PageHeader title="Обзор" description="Ключевые показатели вашего рабочего пространства" />

      {demoData ? (
        <Alert data-testid="demo-data-banner">
          <AlertTitle>Demo data</AlertTitle>
          <AlertDescription>
            Демонстрационное рабочее пространство. Заявки и задачи с префиксом{" "}
            <span className="font-medium">[DEMO]</span> вымышлены и созданы seed-скриптом.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Всего заявок"
          value={data.metrics.totalLeads}
          description={`Новых: ${data.metrics.newLeads}`}
          borderColor="border-blue-200"
          icon="📥"
        />
        <MetricCard
          title="Контакты"
          value={data.metrics.totalContacts}
          description="Связанные контакты"
          borderColor="border-green-200"
          icon="👥"
        />
        <MetricCard
          title="Задачи"
          value={data.metrics.totalTasks}
          description={
            data.metrics.overdueTasks > 0
              ? `Просрочено: ${data.metrics.overdueTasks}`
              : "Нет просроченных"
          }
          borderColor="border-purple-200"
          icon="✅"
        />
        <MetricCard
          title="Конверсия"
          value={data.metrics.conversionRate + "%"}
          description="Конвертированных заявок"
          borderColor="border-orange-200"
          icon="📈"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <LeadsByStatusChart data={data.leadsByStatus} />
        <LeadsByDayChart data={data.leadsByDay} />
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  borderColor,
  icon,
}: {
  title: string;
  value: number | string;
  description: string;
  borderColor: string;
  icon: string;
}) {
  return (
    <Card className={borderColor}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span className="text-xs text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold">{value}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function LeadsByStatusChart({ data }: { data: { status: string; count: number }[] }) {
  const total = data.reduce((sum, row) => sum + row.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Заявки по статусам</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.map((row) => {
          const percent = total > 0 ? Math.round((row.count / total) * 100) : 0;
          return (
            <div key={row.status} className="flex items-center gap-4">
              <span className="w-16 text-xs">{row.status}</span>
              <div className="h-2.5 flex-1 rounded-full bg-muted/50">
                <div className="h-2.5 rounded-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
              <span className="w-8 text-right text-xs">{row.count}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function LeadsByDayChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(0, ...data.map((row) => row.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Заявки по дням</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((row) => {
          const percent = Math.round((row.count / max) * 100);
          return (
            <div key={row.date} className="flex items-center gap-4">
              <span className="w-16 text-xs">{row.date}</span>
              <div className="h-2.5 flex-1 rounded-full bg-muted/50">
                <div className="h-2.5 rounded-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
              <span className="w-8 text-right text-xs">{row.count}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
