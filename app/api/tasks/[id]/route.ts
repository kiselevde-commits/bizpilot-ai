import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireRole } from "@/lib/auth/session";
import { DELETE_ROLES } from "@/lib/auth/roles";
import {
  getTask,
  updateTask,
  deleteTask,
  type TaskUpdateInput,
} from "@/services/task.service";
import { jsonSuccess, jsonError } from "@/lib/api/envelope";
import { handleApiError } from "@/lib/api/handle-error";
import { assertJsonContentType, readJsonBody } from "@/lib/api/body-limit";
import { assertSameOrigin } from "@/lib/api/origin";

const TASK_BODY_LIMIT = 64 * 1024;

const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"];

function validateTaskUpdateBody(body: unknown): void {
  if (!body || typeof body !== "object") {
    throw new Error("VALIDATION_ERROR: Invalid request body");
  }

  const obj = body as Record<string, unknown>;

  const validators: Record<string, (v: unknown) => boolean> = {
    title: (v: unknown) =>
      typeof v === "string" && v.trim().length > 0 && v.length <= 255,
    description: (v: unknown) => v == null || (typeof v === "string" && v.length <= 2000),
    status: (v: unknown) => TASK_STATUSES.includes(v as string),
    priority: (v: unknown) => ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(v as string),
    dueDate: (v: unknown) =>
      v == null || v === "" || (typeof v === "string" && !isNaN(new Date(v).getTime())),
    assignedToId: (v: unknown) => v == null || typeof v === "string",
    leadId: (v: unknown) => v == null || typeof v === "string",
    contactId: (v: unknown) => v == null || typeof v === "string",
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

    const task = await getTask(user, id);

    if (!task) {
      return jsonError("NOT_FOUND", "Задача не найдена", 404);
    }

    return jsonSuccess(task);
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

    assertSameOrigin(request, process.env.APP_BASE_URL ?? request.nextUrl.origin);
    assertJsonContentType(request);
    const rawBody = await readJsonBody(request, TASK_BODY_LIMIT);
    validateTaskUpdateBody(rawBody);

    const body = rawBody as Partial<{
      title: string;
      description: string | null;
      status: string;
      priority: string;
      dueDate: string | null;
      assignedToId: string | null;
      leadId: string | null;
      contactId: string | null;
    }>;

    const input: TaskUpdateInput = {};

    if (body.title !== undefined) input.title = String(body.title).trim();
    if (body.description !== undefined) input.description = body.description ?? null;
    if (body.status !== undefined) input.status = String(body.status);
    if (body.priority !== undefined) input.priority = String(body.priority);
    if (body.dueDate !== undefined) input.dueDate = body.dueDate ?? null;
    if (body.assignedToId !== undefined) input.assignedToId = body.assignedToId ?? null;
    if (body.leadId !== undefined) input.leadId = body.leadId ?? null;
    if (body.contactId !== undefined) input.contactId = body.contactId ?? null;

    const task = await updateTask(user, id, input);

    return jsonSuccess(task);
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

    assertSameOrigin(request, process.env.APP_BASE_URL ?? request.nextUrl.origin);
    await deleteTask(user, id);

    return NextResponse.json({ success: true, data: null, error: null });
  } catch (error) {
    const handled = handleApiError(error);

    return NextResponse.json(handled.body, { status: handled.status });
  }
}
