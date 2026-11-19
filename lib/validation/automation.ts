import { z } from "zod";
import { AUTOMATION_EVENT_STATUSES } from "@/lib/constants";

export const automationEventStatusSchema = z.enum(AUTOMATION_EVENT_STATUSES);

export const automationEventIdSchema = z.string().uuid();

export const automationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: automationEventStatusSchema.optional(),
  sort: z.string().trim().max(100).default("createdAt:desc"),
});

export type AutomationListQuery = z.infer<typeof automationListQuerySchema>;

/**
 * Callback payload sent by the n8n workflow after Telegram delivery.
 *
 * `workspaceId` (and any other unexpected field) is intentionally ignored: the
 * workspace is always taken from the AutomationEvent found by idempotencyKey.
 */
export const n8nCallbackSchema = z
  .object({
    idempotencyKey: z.string().trim().min(1).max(200),
    status: z
      .string()
      .trim()
      .transform((value) => value.toLowerCase())
      .pipe(z.enum(["delivered", "failed"])),
    externalEventId: z.string().trim().min(1).max(200).nullish(),
    error: z.string().max(2000).nullish(),
  })
  .passthrough();

export type N8nCallbackPayload = z.infer<typeof n8nCallbackSchema>;
