import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import {
  listContacts,
  createContact,
  type ContactListQuery,
} from "@/services/contact.service";
import { jsonSuccess, jsonError } from "@/lib/api/envelope";
import { handleApiError } from "@/lib/api/handle-error";
import { assertJsonContentType, readJsonBody } from "@/lib/api/body-limit";
import { paginationQuerySchema } from "@/lib/validation/query";

const CONTACT_BODY_LIMIT = 64 * 1024;

const CONTACT_STATUSES = ["NEW", "ACTIVE", "INACTIVE"];

function validateContactBody(body: unknown): void {
  if (!body || typeof body !== "object") {
    throw new Error("VALIDATION_ERROR: Invalid request body");
  }

  const obj = body as Record<string, unknown>;

  const validators: Record<string, (v: unknown) => boolean> = {
    name: (v: unknown) =>
      typeof v === "string" && v.trim().length > 0 && v.length <= 255,
    company: (v: unknown) => v == null || (typeof v === "string" && v.length <= 255),
    email: (v: unknown) => v == null || (typeof v === "string" && v.length <= 254),
    phone: (v: unknown) => v == null || (typeof v === "string" && v.length <= 50),
    notes: (v: unknown) => v == null || (typeof v === "string" && v.length <= 2000),
    status: (v: unknown) => CONTACT_STATUSES.includes(v as string),
    force: (v: unknown) => typeof v === "boolean",
  };

  for (const [key, validator] of Object.entries(validators)) {
    if (key in obj && !validator(obj[key])) {
      throw new Error(`VALIDATION_ERROR: Invalid field ${key}`);
    }
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser();

    const searchParams = request.nextUrl.searchParams;
    const query: ContactListQuery = {
      page: Number(searchParams.get("page") ?? "1"),
      limit: Number(searchParams.get("limit") ?? "20"),
      search: searchParams.get("search") ?? "",
      sort: searchParams.get("sort") ?? "createdAt:desc",
      status: searchParams.get("status") ?? undefined,
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

    const result = await listContacts(user, parsed.data);

    return jsonSuccess(result);
  } catch (error) {
    const handled = handleApiError(error);

    return NextResponse.json(handled.body, { status: handled.status });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser();

    assertJsonContentType(request);
    const rawBody = await readJsonBody(request, CONTACT_BODY_LIMIT);
    validateContactBody(rawBody);

    const body = rawBody as {
      name: string;
      company?: string | null;
      email?: string | null;
      phone?: string | null;
      notes?: string | null;
      status?: string;
      force?: boolean;
    };

    const result = await createContact(user, {
      name: String(body.name).trim(),
      company: body.company ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      notes: body.notes ?? null,
      status: body.status ?? undefined,
      force: body.force === true,
    });

    return jsonSuccess(result, { status: 201 });
  } catch (error) {
    const handled = handleApiError(error);

    return NextResponse.json(handled.body, { status: handled.status });
  }
}
