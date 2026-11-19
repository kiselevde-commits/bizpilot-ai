import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireRole } from "@/lib/auth/session";
import { DELETE_ROLES } from "@/lib/auth/roles";
import {
  getLead,
  updateLead,
  deleteLead,
  type LeadUpdateInput,
} from "@/services/lead.service";
import { jsonSuccess, jsonError } from "@/lib/api/envelope";
import { handleApiError } from "@/lib/api/handle-error";
import { assertJsonContentType, readJsonBody } from "@/lib/api/body-limit";

const LEAD_BODY_LIMIT = 256 * 1024;

function validateLeadUpdateBody(body: unknown): void {
  if (!body || typeof body !== "object") {
    throw new Error("VALIDATION_ERROR: Invalid request body");
  }

  const obj = body as Record<string, unknown>;

  const validators: Record<string, (v: unknown) => boolean> = {
    title: (v: unknown) =>
      typeof v === "string" && v.trim().length > 0 && v.length <= 255,
    message: (v: unknown) => typeof v === "string" && v.length <= 20000,
    source: (v: unknown) => v == null || (typeof v === "string" && v.length <= 100),
    status: (v: unknown) =>
      ["NEW", "ANALYZING", "QUALIFIED", "IN_PROGRESS", "WAITING", "CONVERTED", "REJECTED"].includes(
        v as string,
      ),
    priority: (v: unknown) => ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(v as string),
    category: (v: unknown) =>
      ["business_automation", "crm_integration", "ai_bot", "document_flow", "web_app", "other"].includes(
        v as string,
      ),
    intent: (v: unknown) =>
      ["request", "question", "complaint", "info", "other"].includes(v as string),
    customerType: (v: unknown) => ["b2b", "b2c", "b2g", "unknown"].includes(v as string),
    contactId: (v: unknown) => typeof v === "string",
    assignedToId: (v: unknown) => typeof v === "string",
  };

  for (const [key, validator] of Object.entries(validators)) {
    if (key in obj && !validator(obj[key])) {
      throw new Error(`VALIDATION_ERROR: Invalid field ${key}`);
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireUser();
    const { id } = await params;

    const lead = await getLead(user, id);

    if (!lead) {
      return jsonError("NOT_FOUND", "Заявка не найдена", 404);
    }

    return jsonSuccess(lead);
  } catch (error) {
    const handled = handleApiError(error);

    return NextResponse.json(handled.body, { status: handled.status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireUser();
    const { id } = await params;

    assertJsonContentType(request);
    const rawBody = await readJsonBody(request, LEAD_BODY_LIMIT);
    validateLeadUpdateBody(rawBody);

    const body = rawBody as Partial<{
      title: string;
      message: string;
      source: string | null;
      status: string;
      priority: string;
      category: string | null;
      intent: string | null;
      customerType: string | null;
      contactId: string | null;
      assignedToId: string | null;
    }>;

    const input: LeadUpdateInput = {};

    if (body.title !== undefined) input.title = String(body.title).trim();
    if (body.message !== undefined) input.message = String(body.message);
    if (body.source !== undefined) input.source = body.source ?? null;
    if (body.status !== undefined) input.status = String(body.status);
    if (body.priority !== undefined) input.priority = String(body.priority);
    if (body.category !== undefined) input.category = body.category ?? null;
    if (body.intent !== undefined) input.intent = body.intent ?? null;
    if (body.customerType !== undefined) input.customerType = body.customerType ?? null;
    if (body.contactId !== undefined) input.contactId = body.contactId ?? null;
    if (body.assignedToId !== undefined) input.assignedToId = body.assignedToId ?? null;

    const lead = await updateLead(user, id, input);

    return jsonSuccess(lead);
  } catch (error) {
    const handled = handleApiError(error);

    return NextResponse.json(handled.body, { status: handled.status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireUser();
    requireRole(user, DELETE_ROLES);
    const { id } = await params;

    await deleteLead(user, id);

    return NextResponse.json({ success: true, data: null, error: null });
  } catch (error) {
    const handled = handleApiError(error);

    return NextResponse.json(handled.body, { status: handled.status });
  }
}
