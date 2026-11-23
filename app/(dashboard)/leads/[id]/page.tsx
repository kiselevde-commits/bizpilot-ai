import "server-only";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  CheckSquare,
  Clock3,
  Edit3,
  Inbox,
  MessageSquareText,
  Plus,
  Sparkles,
  Target,
  UserRound,
} from "lucide-react";
import { getLead } from "@/services/lead.service";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  LEAD_CATEGORY_LABELS,
  LEAD_INTENT_LABELS,
  LEAD_STATUS_LABELS,
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  formatDateTime,
} from "@/lib/utils/labels";

type LeadDetail = {
  id: string;
  title: string;
  message: string;
  status: keyof typeof LEAD_STATUS_LABELS;
  priority: keyof typeof PRIORITY_LABELS;
  source: string | null;
  summary: string | null;
  leadScore: number | null;
  category: string | null;
  intent: string | null;
  contactId: string | null;
  contact: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
  tasks: Array<{
    id: string;
    title: string;
    status: keyof typeof TASK_STATUS_LABELS;
    priority: keyof typeof PRIORITY_LABELS;
  }>;
};

export default async function LeadDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const user = await requireUser();

  const lead = (await getLead(user, id)) as LeadDetail | null;

  if (!lead) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Заявка #${lead.id.slice(-6)}`}
        title={lead.title}
        description={`${lead.source || "Без источника"} · создана ${formatDateTime(lead.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/leads/${lead.id}/edit`}>
                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                Редактировать
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/ai-assistant?leadId=${lead.id}`}>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                AI-анализ
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {lead.summary ? (
            <Card className="ai-panel ai-aura relative overflow-hidden">
              <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <CardTitle>AI-резюме</CardTitle>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Сгенерировано моделью и сохранено после подтверждения
                    </p>
                  </div>
                </div>
                <Link
                  href={`/ai-assistant?leadId=${lead.id}`}
                  className="hidden items-center gap-1 text-[12px] font-medium text-primary hover:text-iris sm:inline-flex"
                >
                  Открыть анализ
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink/90">
                  {lead.summary}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="ai-panel ai-aura relative overflow-hidden">
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold">AI-анализ ещё не применён</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      Получите резюме, оценку лида и рекомендации, затем подтвердите результат.
                    </p>
                  </div>
                </div>
                <Button asChild size="sm" className="shrink-0">
                  <Link href={`/ai-assistant?leadId=${lead.id}`}>
                    Запустить анализ
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                </span>
                <CardTitle>Текст заявки</CardTitle>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {lead.message.length.toLocaleString("ru-RU")} символов
              </span>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border/60 bg-muted/25 p-4">
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-muted-foreground">
                  {lead.message}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CheckSquare className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <CardTitle>Связанные задачи</CardTitle>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {lead.tasks.length} задач по этой заявке
                  </p>
                </div>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link href={`/tasks/new?leadId=${lead.id}`}>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Создать задачу
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {lead.tasks.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/25 px-4 py-5 text-[13px] text-muted-foreground">
                  <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  Задач пока нет. Создайте задачу, чтобы назначить следующий шаг.
                </div>
              ) : (
                <ul className="space-y-2">
                  {lead.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-white/60 p-3 transition-all duration-150 hover:border-primary/20 hover:bg-white hover:shadow-soft"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/tasks/${task.id}`}
                          className="block truncate text-[13px] font-semibold text-ink transition-colors group-hover:text-primary"
                        >
                          {task.title}
                        </Link>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <StatusBadge kind="task" value={task.status} />
                          <StatusBadge kind="priority" value={task.priority} />
                        </div>
                      </div>
                      <Link
                        href={`/tasks/${task.id}`}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                      >
                        Открыть
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="relative overflow-hidden">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/[0.07] to-transparent"
              aria-hidden="true"
            />
            <CardContent className="relative p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Lead score</p>
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    {typeof lead.leadScore === "number"
                      ? scoreLabel(lead.leadScore)
                      : "Оценка не рассчитана"}
                  </p>
                </div>
                <ScoreRing score={lead.leadScore} />
              </div>

              <div className="mt-5 grid gap-2.5 border-t border-border/70 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">Статус</span>
                  <StatusBadge kind="lead" value={lead.status} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">Приоритет</span>
                  <StatusBadge kind="priority" value={lead.priority} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">Категория</span>
                  <span className="max-w-[11rem] truncate text-right text-[12px] font-medium text-ink">
                    {lead.category ? (LEAD_CATEGORY_LABELS[lead.category] ?? lead.category) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">Намерение</span>
                  <span className="max-w-[11rem] truncate text-right text-[12px] font-medium text-ink">
                    {lead.intent ? (LEAD_INTENT_LABELS[lead.intent] ?? lead.intent) : "—"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aqua/10 text-aqua">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                </span>
                <CardTitle>Клиент</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <MetaRow icon={UserRound} label="Контакт">
                {lead.contact ? (
                  <Link
                    href={`/crm/${lead.contact.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {lead.contact.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Не связан</span>
                )}
              </MetaRow>
              <MetaRow icon={Inbox} label="Источник">
                <span className="text-muted-foreground">{lead.source || "—"}</span>
              </MetaRow>
              <MetaRow icon={CalendarDays} label="Создана">
                <span className="text-muted-foreground">{formatDateTime(lead.createdAt)}</span>
              </MetaRow>
              <MetaRow icon={Clock3} label="Обновлена">
                <span className="text-muted-foreground">{formatDateTime(lead.updatedAt)}</span>
              </MetaRow>
            </CardContent>
          </Card>

          <Card className="border-primary/[0.12] bg-primary/[0.03]">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-soft">
                  <Target className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[12px] font-semibold text-ink">Следующий шаг</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {lead.tasks.length > 0
                      ? "Проверьте ближайшую задачу и обновите статус после контакта с клиентом."
                      : "Создайте задачу, чтобы зафиксировать ответственного и срок следующего шага."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function scoreLabel(score: number): string {
  if (score >= 70) return "Высокий потенциал";
  if (score >= 45) return "Средний потенциал";
  if (score >= 25) return "Низкий потенциал";
  return "Требует квалификации";
}

function ScoreRing({ score }: { score: number | null }) {
  const value = typeof score === "number" ? Math.max(0, Math.min(100, score)) : 0;
  const circumference = 2 * Math.PI * 40;

  return (
    <div className="relative h-24 w-24 shrink-0" data-testid="lead-score">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="lead-score-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5968ED" />
            <stop offset="55%" stopColor="#7B74F2" />
            <stop offset="100%" stopColor="#9671F5" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="40" fill="none" stroke="#EEF1FA" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="url(#lead-score-gradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-ink">
          {typeof score === "number" ? score : "—"}
        </span>
        <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          из 100
        </span>
      </div>
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 text-[12px]">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 break-words">{children}</div>
      </div>
    </div>
  );
}
