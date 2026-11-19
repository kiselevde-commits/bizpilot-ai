import type { ContactStatus, LeadStatus, Priority, Role, TaskStatus } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Администратор",
  MANAGER: "Менеджер",
  OPERATOR: "Оператор",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Новая",
  ANALYZING: "В анализе",
  QUALIFIED: "Квалифицирована",
  IN_PROGRESS: "В работе",
  WAITING: "Ожидание",
  CONVERTED: "Конвертирована",
  REJECTED: "Отклонена",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
  URGENT: "Срочный",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "К выполнению",
  IN_PROGRESS: "В работе",
  DONE: "Выполнена",
  CANCELLED: "Отменена",
};

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  NEW: "Новый",
  ACTIVE: "Активный",
  INACTIVE: "Неактивный",
};

export function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
