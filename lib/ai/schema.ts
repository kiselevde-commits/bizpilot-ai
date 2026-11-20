import "server-only";
import { z } from "zod";
import { LEAD_CATEGORIES, LEAD_INTENTS, PRIORITIES } from "@/lib/constants";

const MAX_SUMMARY_LENGTH = 300;
const MAX_DRAFT_REPLY_LENGTH = 800;
const MAX_LEAD_SCORE = 100;
const MIN_LEAD_SCORE = 0;
const MAX_CONTACT_FIELD_LENGTH = 200;
const MAX_PHONE_LENGTH = 50;

/**
 * Contact data mentioned directly in the lead text.
 *
 * The model is instructed to return only values that occur in the text; the
 * service additionally drops anything that cannot be found in the source
 * (see `filterExtractedContacts`), so a hallucinated contact can never reach
 * the user interface. The field is optional: older/other providers may omit it.
 */
export const ExtractedContactsSchema = z.object({
  name: z.string().max(MAX_CONTACT_FIELD_LENGTH).nullable().optional(),
  company: z.string().max(MAX_CONTACT_FIELD_LENGTH).nullable().optional(),
  email: z.string().max(MAX_CONTACT_FIELD_LENGTH).nullable().optional(),
  phone: z.string().max(MAX_PHONE_LENGTH).nullable().optional(),
});

export type ExtractedContacts = z.infer<typeof ExtractedContactsSchema>;

export const AIAnalysisResponseSchema = z.object({
  summary: z.string().min(1).max(MAX_SUMMARY_LENGTH),
  leadScore: z.number().int().min(MIN_LEAD_SCORE).max(MAX_LEAD_SCORE),
  category: z.enum(LEAD_CATEGORIES),
  intent: z.enum(LEAD_INTENTS),
  priority: z.enum(PRIORITIES),
  scoreBreakdown: z.record(z.string(), z.number().int().min(0).max(MAX_LEAD_SCORE)),
  justification: z.string().max(1000),
  factors: z.array(z.string().max(200)).max(20),
  recommendations: z.array(z.string().max(200)).max(20),
  risks: z.array(z.string().max(200)).max(20),
  missingInfo: z.array(z.string().max(200)).max(20),
  extractedContacts: ExtractedContactsSchema.optional(),
});

export type AIAnalysisResponse = z.infer<typeof AIAnalysisResponseSchema>;

export const GenerateReplyResponseSchema = z.object({
  draftReply: z.string().min(1).max(MAX_DRAFT_REPLY_LENGTH),
});

export type GenerateReplyResponse = z.infer<typeof GenerateReplyResponseSchema>;

export function validateAIAnalysisResponse(data: unknown): AIAnalysisResponse {
  return AIAnalysisResponseSchema.parse(data);
}

export function validateGenerateReplyResponse(data: unknown): GenerateReplyResponse {
  return GenerateReplyResponseSchema.parse(data);
}

export { MAX_SUMMARY_LENGTH, MAX_DRAFT_REPLY_LENGTH, MAX_LEAD_SCORE, MIN_LEAD_SCORE };
