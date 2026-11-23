import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers/auth";

/**
 * Dashboard contract scenarios.
 *
 * Every assertion is based on entities created by this file, so the result does
 * not depend on which random rows happen to be present in a demo seed. The
 * workspace previews are read through their data attributes and compared with
 * the documented service order:
 *
 * - priority leads: `priority DESC, createdAt DESC, id DESC` (bounded to five);
 * - attention tasks: `dueDate ASC, priority DESC, createdAt DESC, id DESC`
 *   (HIGH/URGENT TODO/IN_PROGRESS only).
 */

const suffix = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000)}`;
const DAY_MS = 24 * 60 * 60 * 1000;

// Playwright always owns the server, so the CSRF origin is the origin of the
// page the test is currently driving (never an externally supplied E2E_BASE_URL).
function originOf(page: Page): string {
  return new URL(page.url()).origin;
}

type PreviewRow = {
  id: string;
  priority: string;
  status?: string;
  createdAt?: string;
  dueDate?: string;
};

type CreatedLead = { id: string; title: string };
type CreatedTask = { id: string; title: string };

function priorityRank(priority: string): number {
  const ranks: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 };

  return ranks[priority] ?? 0;
}

function comparePreviewDesc(a: PreviewRow, b: PreviewRow): number {
  const byPriority = priorityRank(b.priority) - priorityRank(a.priority);

  if (byPriority !== 0) {
    return byPriority;
  }

  const byCreatedAt = Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? "");

  if (byCreatedAt !== 0) {
    return byCreatedAt;
  }

  return b.id.localeCompare(a.id);
}

async function createLead(
  page: Page,
  title: string,
  priority: "HIGH" | "MEDIUM" | "URGENT",
): Promise<CreatedLead> {
  const response = await page.request.post("/api/leads", {
    headers: { Origin: originOf(page) },
    data: {
      title,
      message: `E2E dashboard fixture ${suffix}`,
      source: "E2E",
      status: "NEW",
      priority,
    },
  });

  expect(response.status(), `create lead ${title}`).toBe(201);

  const payload = (await response.json()) as { data: CreatedLead };

  return payload.data;
}

async function createTask(
  page: Page,
  input: {
    title: string;
    priority: "HIGH" | "MEDIUM" | "URGENT";
    dueDate: string;
    status?: "TODO" | "DONE";
  },
): Promise<CreatedTask> {
  const response = await page.request.post("/api/tasks", {
    headers: { Origin: originOf(page) },
    data: {
      title: input.title,
      description: `E2E dashboard fixture ${suffix}`,
      priority: input.priority,
      dueDate: input.dueDate,
      status: input.status ?? "TODO",
    },
  });

  expect(response.status(), `create task ${input.title}`).toBe(201);

  const payload = (await response.json()) as { data: CreatedTask };

  return payload.data;
}

async function readPreviewRows(page: Page, testId: string): Promise<PreviewRow[]> {
  return page.locator(`[data-testid="${testId}"]`).evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.getAttribute("data-lead-id") ?? node.getAttribute("data-task-id") ?? "",
      priority: node.getAttribute("data-priority") ?? "",
      ...(node.getAttribute("data-status")
        ? { status: node.getAttribute("data-status") ?? "" }
        : {}),
      ...(node.getAttribute("data-created-at")
        ? { createdAt: node.getAttribute("data-created-at") ?? "" }
        : {}),
      ...(node.getAttribute("data-due-date")
        ? { dueDate: node.getAttribute("data-due-date") ?? "" }
        : {}),
    })),
  );
}

test.describe("Dashboard", () => {
  test("приоритетные заявки: порядок, tie-break и переход к карточке", async ({ page }) => {
    await login(page, "ADMIN");

    const urgent: CreatedLead[] = [];

    for (let index = 0; index < 5; index += 1) {
      urgent.push(await createLead(page, `E2E приоритет ${suffix} ${index + 1}`, "URGENT"));
      // Keep `createdAt` distinct so the secondary sort key is observable.
      await page.waitForTimeout(20);
    }

    const high = await createLead(page, `E2E приоритет ${suffix} HIGH`, "HIGH");

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: "Обзор" })).toBeVisible();

    const rows = await readPreviewRows(page, "priority-lead");

    // The five newest URGENT fixtures must occupy the bounded preview. The HIGH
    // fixture proves that priority outranks recency and that the block is capped.
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((row) => row.id))).toEqual(new Set(urgent.map((lead) => lead.id)));
    expect(rows.some((row) => row.id === high.id)).toBe(false);
    expect(rows.every((row) => row.priority === "HIGH" || row.priority === "URGENT")).toBe(true);

    for (let index = 0; index < rows.length - 1; index += 1) {
      expect(
        comparePreviewDesc(rows[index]!, rows[index + 1]!),
        `row ${index} must precede row ${index + 1}`,
      ).toBeLessThan(0);
    }

    const titles = new Map([...urgent, high].map((lead) => [lead.id, lead.title] as const));
    const first = rows[0]!;
    const firstTitle = titles.get(first.id);

    expect(firstTitle).toBeDefined();

    await page.locator('[data-testid="priority-lead"]').first().click();
    await expect(page).toHaveURL(new RegExp(`/leads/${first.id}$`));
    await expect(page.getByRole("heading", { level: 1, name: firstTitle! })).toBeVisible();

    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Весь список", exact: true }).click();
    await expect(page).toHaveURL(/\/leads\?sort=priority:desc$/);
    await expect(page.getByRole("heading", { level: 1, name: "Заявки" })).toBeVisible();
  });

  test("превью задач: фильтры, ближайший срок и переход к списку", async ({ page }) => {
    await login(page, "ADMIN");

    const urgent = await createTask(page, {
      title: `E2E задача ${suffix} URGENT`,
      priority: "URGENT",
      dueDate: "2000-01-02T00:00:00.000Z",
    });
    const medium = await createTask(page, {
      title: `E2E задача ${suffix} MEDIUM`,
      priority: "MEDIUM",
      dueDate: "2000-01-01T00:00:00.000Z",
    });
    const done = await createTask(page, {
      title: `E2E задача ${suffix} DONE`,
      priority: "HIGH",
      dueDate: "1999-01-01T00:00:00.000Z",
      status: "DONE",
    });

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: "Обзор" })).toBeVisible();

    const rows = await readPreviewRows(page, "attention-task");

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.id).toBe(urgent.id);
    expect(rows.every((row) => row.priority === "HIGH" || row.priority === "URGENT")).toBe(true);
    expect(rows.every((row) => row.status === "TODO" || row.status === "IN_PROGRESS")).toBe(true);
    expect(rows.some((row) => row.id === medium.id)).toBe(false);
    expect(rows.some((row) => row.id === done.id)).toBe(false);

    for (let index = 0; index < rows.length - 1; index += 1) {
      expect(Date.parse(rows[index]!.dueDate ?? "")).toBeLessThanOrEqual(
        Date.parse(rows[index + 1]!.dueDate ?? ""),
      );
    }

    await page.locator('[data-testid="attention-task"]').first().click();
    await expect(page).toHaveURL(new RegExp(`/tasks/${urgent.id}$`));
    await expect(page.getByRole("heading", { level: 1, name: urgent.title })).toBeVisible();

    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Список", exact: true }).click();
    await expect(page).toHaveURL(/\/tasks\?sort=dueDate:asc$/);
    await expect(page.getByRole("heading", { level: 1, name: "Задачи" })).toBeVisible();

    // The target list keeps the due-date order and contains the same entity.
    // A title search avoids depending on other tasks that may share the
    // fixture's due date after repeated runs.
    await page.goto(`/tasks?sort=dueDate:asc&search=${encodeURIComponent(urgent.title)}`);
    await expect(page.getByRole("link", { name: urgent.title })).toBeVisible();
  });

  test("14-дневная динамика: 14 последовательных UTC-дат", async ({ page }) => {
    await login(page, "ADMIN");
    await page.goto("/dashboard");

    const trendTable = page.getByRole("table", { name: "Динамика заявок по датам" });
    await expect(trendTable).toBeAttached();
    await expect(trendTable.locator("tbody tr")).toHaveCount(14);
    await expect(page.locator("#leads-by-day-summary")).toContainText("Всего заявок за период");

    const dates = await trendTable
      .locator("tbody tr th")
      .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? ""));
    const counts = await trendTable
      .locator("tbody tr td")
      .evaluateAll((nodes) => nodes.map((node) => Number(node.textContent?.trim() ?? "NaN")));

    expect(dates).toHaveLength(14);
    expect(counts.every((value) => Number.isInteger(value) && value >= 0)).toBe(true);

    const utcDays = dates.map((value) => {
      const [day, month, year] = value.split(".").map(Number);

      expect(Number.isInteger(day) && Number.isInteger(month) && Number.isInteger(year)).toBe(true);

      return Date.UTC(year!, month! - 1, day!);
    });

    for (let index = 0; index < utcDays.length - 1; index += 1) {
      expect(utcDays[index + 1]! - utcDays[index]!).toBe(DAY_MS);
    }

    // The table is rendered from UTC boundaries. Allowing one day of slack keeps
    // the assertion stable across a UTC midnight during the test run; the exact
    // boundaries are covered by the PostgreSQL integration test.
    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    expect([todayUtc, todayUtc - DAY_MS]).toContain(utcDays[13]);
  });

  test("навигация: основные разделы открываются из sidebar", async ({ page }) => {
    await login(page, "ADMIN");

    const nav = page.getByRole("navigation", { name: "Основная навигация" });
    const sections = [
      { link: "Обзор", heading: "Обзор", path: "/dashboard" },
      { link: "Заявки", heading: "Заявки", path: "/leads" },
      { link: "Контакты", heading: "Контакты", path: "/crm" },
      { link: "Задачи", heading: "Задачи", path: "/tasks" },
      { link: "AI-помощник", heading: "AI-помощник", path: "/ai-assistant" },
      { link: "Настройки", heading: "Настройки", path: "/settings" },
    ];

    for (const section of sections) {
      await nav.getByRole("link", { name: section.link, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${section.path}$`));
      await expect(page.getByRole("heading", { level: 1 })).toContainText(section.heading);
    }
  });
});
