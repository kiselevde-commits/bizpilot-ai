import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Query-contract tests for the Dashboard service.
 *
 * Real PostgreSQL behaviour (Workspace isolation, grouping and UTC boundaries)
 * is covered by `tests/integration/dashboard-*.integration.test.ts`, which only
 * run against an explicitly isolated test database. These unit tests pin the
 * Prisma query shape and the 14-day UTC bucket construction without a database.
 */

const mocks = vi.hoisted(() => ({
  leadCount: vi.fn(),
  leadGroupBy: vi.fn(),
  leadFindMany: vi.fn(),
  contactCount: vi.fn(),
  taskCount: vi.fn(),
  taskFindMany: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    lead: {
      count: mocks.leadCount,
      groupBy: mocks.leadGroupBy,
      findMany: mocks.leadFindMany,
    },
    contact: { count: mocks.contactCount },
    task: { count: mocks.taskCount, findMany: mocks.taskFindMany },
    $queryRaw: mocks.queryRaw,
  },
}));

import { getDashboardData, hasDemoData } from "@/services/dashboard.service";

type QueryArgs = {
  where?: Record<string, unknown>;
  orderBy?: Array<Record<string, "asc" | "desc">>;
  take?: number;
  select?: Record<string, { where?: Record<string, unknown> }>;
};

const user: SessionUser = {
  id: "user-1",
  name: "Admin",
  email: "admin@example.test",
  role: "ADMIN",
  workspaceId: "workspace-1",
  workspaceName: "Workspace One",
};

function firstCall(mock: typeof mocks.leadFindMany): QueryArgs {
  const args = mock.mock.calls[0]?.[0];

  if (!args) {
    throw new Error("Expected a Prisma query call.");
  }

  return args as QueryArgs;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-22T12:34:56.000Z"));

  mocks.leadCount.mockReset().mockResolvedValue(0);
  mocks.leadGroupBy.mockReset().mockResolvedValue([]);
  mocks.leadFindMany.mockReset().mockResolvedValue([]);
  mocks.contactCount.mockReset().mockResolvedValue(0);
  mocks.taskCount.mockReset().mockResolvedValue(0);
  mocks.taskFindMany.mockReset().mockResolvedValue([]);
  mocks.queryRaw.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getDashboardData previews", () => {
  it("scopes, filters and deterministically orders priority leads", async () => {
    await getDashboardData(user);

    const args = firstCall(mocks.leadFindMany);

    expect(args.where).toEqual({
      workspaceId: "workspace-1",
      status: { notIn: ["CONVERTED", "REJECTED"] },
      priority: { in: ["HIGH", "URGENT"] },
    });
    expect(args.orderBy).toEqual([{ priority: "desc" }, { createdAt: "desc" }, { id: "desc" }]);
    expect(args.take).toBe(5);
    // A legacy foreign Contact must never be selected into this Workspace.
    expect(args.select?.contact?.where).toEqual({ workspaceId: "workspace-1" });
  });

  it("scopes and deterministically orders attention tasks", async () => {
    await getDashboardData(user);

    const args = firstCall(mocks.taskFindMany);

    expect(args.where).toEqual({
      workspaceId: "workspace-1",
      status: { in: ["TODO", "IN_PROGRESS"] },
      priority: { in: ["HIGH", "URGENT"] },
      dueDate: { not: null },
    });
    expect(args.orderBy).toEqual([
      { dueDate: "asc" },
      { priority: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ]);
    expect(args.take).toBe(5);
    expect(args.select?.assignedTo?.where).toEqual({ workspaceId: "workspace-1" });
  });
});

describe("getDashboardData 14-day trend", () => {
  it("builds session-timezone-independent UTC bounds and 14 ordered buckets", async () => {
    mocks.queryRaw.mockResolvedValue([
      { date: "2026-11-09", count: 2n },
      { date: "2026-11-22", count: 1n },
    ]);

    const data = await getDashboardData(user);

    expect(data.leadsByDay).toHaveLength(14);
    expect(data.leadsByDay[0]).toEqual({ date: "2026-11-09", count: 2 });
    expect(data.leadsByDay[12]).toEqual({ date: "2026-11-21", count: 0 });
    expect(data.leadsByDay[13]).toEqual({ date: "2026-11-22", count: 1 });
    expect(data.leadsByDay.reduce((sum, row) => sum + row.count, 0)).toBe(3);

    const call = mocks.queryRaw.mock.calls[0];

    expect(call).toBeDefined();

    // Both bounds are explicit UTC wall-clock components for make_timestamp(...),
    // which returns `timestamp without time zone`. No Date/timestamptz or
    // `AT TIME ZONE` conversion is passed, so PostgreSQL session TimeZone
    // cannot move the window.
    expect(call?.slice(1)).toEqual(["workspace-1", 2026, 11, 9, 2026, 11, 23]);

    const sql = String(call?.[0]);

    expect(sql).toMatch(/"createdAt" >= make_timestamp\(/);
    expect(sql).toMatch(/"createdAt" < make_timestamp\(/);
    expect(sql).not.toContain("AT TIME ZONE");
    expect(sql).toContain('to_char("createdAt", \'YYYY-MM-DD\')');
  });

  it("returns zero-filled buckets for an empty Workspace", async () => {
    const data = await getDashboardData(user);

    expect(data.leadsByDay).toHaveLength(14);
    expect(data.leadsByDay.every((row) => row.count === 0)).toBe(true);
    expect(data.leadsByDay[0]?.date).toBe("2026-11-09");
    expect(data.leadsByDay[13]?.date).toBe("2026-11-22");
  });
});

describe("hasDemoData", () => {
  it("checks the demo prefix only inside the current Workspace", async () => {
    mocks.leadCount.mockResolvedValue(2);

    await expect(hasDemoData(user)).resolves.toBe(true);

    const args = mocks.leadCount.mock.calls[0]?.[0] as QueryArgs | undefined;

    expect(args?.where).toEqual({
      workspaceId: "workspace-1",
      title: { startsWith: "[DEMO]" },
    });
  });
});
