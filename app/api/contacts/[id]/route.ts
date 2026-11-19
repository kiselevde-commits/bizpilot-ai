import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireRole } from "@/lib/auth/session";
import { DELETE_ROLES } from "@/lib/auth/roles";
import {
  getContact,
  updateContact,
  deleteContact,
  type ContactUpdateInput,
} from "@/services/contact.service";
import { jsonSuccess, jsonError } from "@/lib/api/envelope";
import { handleApiError } from "@/lib/api/handle-error";
import { assertJsonContentType, readJsonBody } from "@/lib/api/body-limit";

const CONTACT_BODY_LIMIT = 64 * 1024;

const CONTACT_STATUSES = ["NEW", "ACTIVE", "INACTIVE"];

function validateContactUpdateBody(body: unknown): void {
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireUser();
    const { id } = await params;

    const contact = await getContact(user, id);

    if (!contact) {
      return jsonError("NOT_FOUND", "Контакт не найден", 404);
    }

    return jsonSuccess(contact);
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
    const rawBody = await readJsonBody(request, CONTACT_BODY_LIMIT);
    validateContactUpdateBody(rawBody);

    const body = rawBody as Partial<{
      name: string;
      company: string | null;
      email: string | null;
      phone: string | null;
      notes: string | null;
      status: string;
    }>;

    const input: ContactUpdateInput = {};

    if (body.name !== undefined) input.name = String(body.name).trim();
    if (body.company !== undefined) input.company = body.company ?? null;
    if (body.email !== undefined) input.email = body.email ?? null;
    if (body.phone !== undefined) input.phone = body.phone ?? null;
    if (body.notes !== undefined) input.notes = body.notes ?? null;
    if (body.status !== undefined) input.status = String(body.status);

    const contact = await updateContact(user, id, input);

    return jsonSuccess(contact);
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

    await deleteContact(user, id);

    return NextResponse.json({ success: true, data: null, error: null });
  } catch (error) {
    const handled = handleApiError(error);

    return NextResponse.json(handled.body, { status: handled.status });
  }
}
