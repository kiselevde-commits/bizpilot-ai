export const ROLES = ["ADMIN", "MANAGER", "OPERATOR"] as const;

export const LEAD_STATUSES = [
  "NEW",
  "ANALYZING",
  "QUALIFIED",
  "IN_PROGRESS",
  "WAITING",
  "CONVERTED",
  "REJECTED",
] as const;

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const;

export const LEAD_CATEGORIES = [
  "business_automation",
  "crm_integration",
  "ai_bot",
  "document_flow",
  "web_app",
  "other",
] as const;

export const LEAD_INTENTS = ["request", "question", "complaint", "info", "other"] as const;

export const CUSTOMER_TYPES = ["b2b", "b2c", "b2g", "unknown"] as const;

export const CONTACT_STATUSES = ["NEW", "ACTIVE", "INACTIVE"] as const;

export const AI_ANALYSIS_STATUSES = ["SUCCESS", "FAILED"] as const;

export const INTEGRATION_TYPES = ["n8n", "telegram"] as const;

export const INTEGRATION_STATUSES = ["NOT_CONFIGURED", "ACTIVE", "ERROR"] as const;

export const AUTOMATION_EVENT_STATUSES = [
  "PENDING",
  "SENT",
  "DELIVERED",
  "FAILED",
  "RETRYING",
] as const;

export type RoleValue = (typeof ROLES)[number];
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];
export type PriorityValue = (typeof PRIORITIES)[number];
export type TaskStatusValue = (typeof TASK_STATUSES)[number];
export type LeadCategoryValue = (typeof LEAD_CATEGORIES)[number];
export type LeadIntentValue = (typeof LEAD_INTENTS)[number];
export type CustomerTypeValue = (typeof CUSTOMER_TYPES)[number];
export type ContactStatusValue = (typeof CONTACT_STATUSES)[number];
export type AIAnalysisStatusValue = (typeof AI_ANALYSIS_STATUSES)[number];
export type IntegrationTypeValue = (typeof INTEGRATION_TYPES)[number];
export type IntegrationStatusValue = (typeof INTEGRATION_STATUSES)[number];
export type AutomationEventStatusValue = (typeof AUTOMATION_EVENT_STATUSES)[number];
