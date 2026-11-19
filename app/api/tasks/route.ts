import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { listTasks, createTask, type TaskListQuery } from "@/services/task.service";
import { jsonSuccess, jsonError } from "@/lib/api/envelope";
import { handleApiError } from "@/lib/api/handle-error";
import { assertJsonContentType, readJsonBody } from "@/lib/api/body-limit";
import { paginationQuerySchema } from "@/lib/validation/query";
import { assertSameOrigin } from "@/lib/api/origin";

const TASK_BODY_LIMIT = 64 * 1024;

const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"];

function validateTaskBody(body: unknown): void {
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
    dueDate: (v: unknown) => v == null || (typeof v === "string" && !isNaN(new Date(v).getTime())),
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

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser();

    const searchParams = request.nextUrl.searchParams;
    const query: TaskListQuery = {
      page: Number(searchParams.get("page") ?? "1"),
      limit: Number(searchParams.get("limit") ?? "20"),
      search: searchParams.get("search") ?? "",
      sort: searchParams.get("sort") ?? "createdAt:desc",
      status: searchParams.get("status") ?? undefined,
      priority: searchParams.get("priority") ?? undefined,
      assignedToId: searchParams.get("assignedToId") ?? undefined,
      leadId: searchParams.get("leadId") ?? undefined,
      contactId: searchParams.get("contactId") ?? undefined,
      overdue:
        searchParams.get("overdue") === "true"
          ? true
          : searchParams.get("overdue") === "false"
            ? false
            : undefined,
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

    const result = await listTasks(user, { ...query, ...parsed.data });

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
    const rawBody = await readJsonBody(request, TASK_BODY_LIMIT);
    validateTaskBody(rawBody);

    const body = rawBody as {
      title: string;
      description?: string | null;
      status?: string;
      priority?: string;
      dueDate?: string | null;
      assignedToId?: string | null;
      leadId?: string | null;
      contactId?: string | null;
    };

    const task = await createTask(user, {
      title: String(body.title).trim(),
      description: body.description ?? null,
      status: body.status ?? undefined,
      priority: body.priority ?? undefined,
      dueDate: body.dueDate ?? null,
      assignedToId: body.assignedToId ?? null,
      leadId: body.leadId ?? null,
      contactId: body.contactId ?? null,
    });

    return jsonSuccess(task, { status: 201 });
  } catch (error) {
    const handled = handleApiError(error);

    return NextResponse.json(handled.body, { status: handled.status });
  }
}
