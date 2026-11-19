import "server-only";
import { z } from "zod";
import { LEAD_CATEGORIES, LEAD_INTENTS, PRIORITIES } from "@/lib/constants";

const MAX_SUMMARY_LENGTH = 300;
const MAX_DRAFT_REPLY_LENGTH = 800;
const MAX_LEAD_SCORE = 100;
const MIN_LEAD_SCORE = 0;

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
