import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

export type StatusBadgeKind =
  | "lead"
  | "task"
  | "contact"
  | "priority"
  | "automation"
  | "integration"
  | "analysis";

type Tone =
  | "default"
  | "secondary"
  | "destructive"
  | "success"
  | "warning"
  | "outline"
  | "brand"
  | "indigo"
  | "violet"
  | "teal"
  | "iris"
  | "aqua";

const TONES: Record<StatusBadgeKind, Record<string, Tone>> = {
  lead: {
    NEW: "default",
    ANALYZING: "violet",
    QUALIFIED: "teal",
    IN_PROGRESS: "indigo",
    WAITING: "warning",
    CONVERTED: "success",
    REJECTED: "destructive",
  },
  task: {
    TODO: "secondary",
    IN_PROGRESS: "default",
    DONE: "success",
    CANCELLED: "outline",
  },
  contact: {
    NEW: "default",
    ACTIVE: "success",
    INACTIVE: "secondary",
  },
  priority: {
    LOW: "secondary",
    MEDIUM: "default",
    HIGH: "warning",
    URGENT: "destructive",
  },
  automation: {
    PENDING: "warning",
    SENT: "default",
    DELIVERED: "success",
    FAILED: "destructive",
    RETRYING: "warning",
  },
  integration: {
    NOT_CONFIGURED: "secondary",
    ACTIVE: "success",
    ERROR: "destructive",
  },
  analysis: {
    SUCCESS: "success",
    FAILED: "destructive",
  },
};

const LABELS: Record<StatusBadgeKind, Record<string, string>> = {
  lead: {
    NEW: "Новая",
    ANALYZING: "В анализе",
    QUALIFIED: "Квалифицирована",
    IN_PROGRESS: "В работе",
    WAITING: "Ожидание",
    CONVERTED: "Конвертирована",
    REJECTED: "Отклонена",
  },
  task: {
    TODO: "К выполнению",
    IN_PROGRESS: "В работе",
    DONE: "Выполнена",
    CANCELLED: "Отменена",
  },
  contact: {
    NEW: "Новый",
    ACTIVE: "Активный",
    INACTIVE: "Неактивный",
  },
  priority: {
    LOW: "Низкий",
    MEDIUM: "Средний",
    HIGH: "Высокий",
    URGENT: "Срочный",
  },
  automation: {
    PENDING: "Ожидает отправки",
    SENT: "Принято n8n",
    DELIVERED: "Доставлено",
    FAILED: "Ошибка",
    RETRYING: "Ожидает повтора",
  },
  integration: {
    NOT_CONFIGURED: "Не настроено",
    ACTIVE: "Активно",
    ERROR: "Ошибка",
  },
  analysis: {
    SUCCESS: "Успешно",
    FAILED: "Ошибка",
  },
};

export function StatusBadge({
  kind,
  value,
  label,
  className,
  dot = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  kind: StatusBadgeKind;
  value: string | null | undefined;
  label?: React.ReactNode;
  dot?: boolean;
}) {
  const key = value ?? "";
  const tone = TONES[kind][key] ?? "outline";
  const text = label ?? LABELS[kind][key] ?? (value || "—");

  return (
    <Badge variant={tone} className={cn("gap-1.5", className)} {...props}>
      {dot ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      ) : null}
      {text}
    </Badge>
  );
}
