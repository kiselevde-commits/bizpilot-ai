import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { listLeads, createLead, type LeadListQuery } from "@/services/lead.service";
import { jsonSuccess, jsonError } from "@/lib/api/envelope";
import { handleApiError } from "@/lib/api/handle-error";
import { assertJsonContentType, readJsonBody } from "@/lib/api/body-limit";
import { paginationQuerySchema } from "@/lib/validation/query";
import { assertSameOrigin } from "@/lib/api/origin";

const LEAD_BODY_LIMIT = 256 * 1024;

const LEAD_CREATE_SCHEMA = {
  title: (v: unknown) => typeof v === "string" && v.trim().length > 0 && v.length <= 255,
  message: (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 20000,
  source: (v: unknown) => v == null || (typeof v === "string" && v.length <= 100),
  status: (v: unknown) =>
    v == null ||
    ["NEW", "ANALYZING", "QUALIFIED", "IN_PROGRESS", "WAITING", "CONVERTED", "REJECTED"].includes(v as string),
  priority: (v: unknown) =>
    v == null || ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(v as string),
  category: (v: unknown) =>
    v == null ||
    [
      "business_automation",
      "crm_integration",
      "ai_bot",
      "document_flow",
      "web_app",
      "other",
    ].includes(v as string),
  intent: (v: unknown) =>
    v == null || ["request", "question", "complaint", "info", "other"].includes(v as string),
  customerType: (v: unknown) =>
    v == null || ["b2b", "b2c", "b2g", "unknown"].includes(v as string),
  contactId: (v: unknown) => v == null || typeof v === "string",
  assignedToId: (v: unknown) => v == null || typeof v === "string",
};

function validateLeadBody(body: unknown): void {
  if (!body || typeof body !== "object") {
    throw new Error("VALIDATION_ERROR: Invalid request body");
  }

  const obj = body as Record<string, unknown>;

  for (const [key, validator] of Object.entries(LEAD_CREATE_SCHEMA)) {
    if (key in obj && !validator(obj[key])) {
      throw new Error(`VALIDATION_ERROR: Invalid field ${key}`);
    }
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser();

    const searchParams = request.nextUrl.searchParams;
    const query: LeadListQuery = {
      page: Number(searchParams.get("page") ?? "1"),
      limit: Number(searchParams.get("limit") ?? "20"),
      search: searchParams.get("search") ?? "",
      sort: searchParams.get("sort") ?? "createdAt:desc",
      status: searchParams.get("status") ?? undefined,
      priority: searchParams.get("priority") ?? undefined,
      assignedToId: searchParams.get("assignedToId") ?? undefined,
      contactId: searchParams.get("contactId") ?? undefined,
    };

    const parsed = paginationQuerySchema.safeParse({
      page: query.page,
      limit: query.limit,
      search: query.search,
      sort: query.sort,
    });

    if (!parsed.success) {
      return jsonError("VALIDATION_ERROR", "Некорректные параметры запроса", 400);
    }

    const result = await listLeads(user, parsed.data);

    return jsonSuccess(result);
  } catch (error) {
    const handled = handleApiError(error);

    return NextResponse.json(handled.body, { status: handled.status });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser();

    assertSameOrigin(request, process.env.APP_BASE_URL ?? request.nextUrl.origin);
    assertJsonContentType(request);
    const rawBody = await readJsonBody(request, LEAD_BODY_LIMIT);
    validateLeadBody(rawBody);

    const body = rawBody as {
      title: string;
      message: string;
      source?: string | null;
      status?: string;
      priority?: string;
      category?: string | null;
      intent?: string | null;
      customerType?: string | null;
      contactId?: string | null;
      assignedToId?: string | null;
    };

    const lead = await createLead(user, {
      title: String(body.title).trim(),
      message: String(body.message),
      source: body.source ?? null,
      status: body.status ?? undefined,
      priority: body.priority ?? undefined,
      category: body.category ?? null,
      intent: body.intent ?? null,
      customerType: body.customerType ?? null,
      contactId: body.contactId ?? null,
      assignedToId: body.assignedToId ?? null,
    });

    return jsonSuccess(lead, { status: 201 });
  } catch (error) {
    const handled = handleApiError(error);

    return NextResponse.json(handled.body, { status: handled.status });
  }
}
