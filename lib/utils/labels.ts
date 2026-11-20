import type {
  AutomationEventStatus,
  ContactStatus,
  IntegrationStatus,
  LeadStatus,
  Priority,
  Role,
  TaskStatus,
} from "@prisma/client";

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

export const LEAD_CATEGORY_LABELS: Record<string, string> = {
  business_automation: "Бизнес-автоматизация",
  crm_integration: "Интеграция CRM",
  ai_bot: "AI-бот",
  document_flow: "Документооборот",
  web_app: "Веб-приложение",
  other: "Другое",
};

export const LEAD_INTENT_LABELS: Record<string, string> = {
  request: "Запрос",
  question: "Вопрос",
  complaint: "Жалоба",
  info: "Информация",
  other: "Другое",
};

export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  b2b: "B2B",
  b2c: "B2C",
  b2g: "B2G",
  unknown: "Неизвестно",
};


export const AUTOMATION_STATUS_LABELS: Record<AutomationEventStatus, string> = {
  PENDING: "Ожидает отправки",
  SENT: "Принято n8n",
  DELIVERED: "Доставлено",
  RETRYING: "Ожидает повтора",
  FAILED: "Ошибка",
};

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  NOT_CONFIGURED: "Не настроено",
  ACTIVE: "Активно",
  ERROR: "Ошибка",
};

export function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDateTimeLocalInput(value: Date | string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

