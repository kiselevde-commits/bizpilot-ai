import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";

const PAGES = [
  { path: "/dashboard", name: "Dashboard", heading: "Обзор" },
  { path: "/leads", name: "Leads", heading: "Заявки" },
  { path: "/crm", name: "Contacts", heading: "Контакты" },
  { path: "/tasks", name: "Tasks", heading: "Задачи" },
  { path: "/ai-assistant", name: "AI Assistant", heading: "AI-помощник" },
  { path: "/settings", name: "Settings", heading: "Настройки" },
];

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
];

test("UI audit: no horizontal overflow and no console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`${page.url()} :: ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`${page.url()} :: PAGEERROR ${err.message}`));

  await login(page, "ADMIN");

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);

    for (const item of PAGES) {
      await page.goto(item.path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(item.heading);

      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
        };
      });

      console.log(
        `VIEWPORT ${viewport.width} ${item.path} scrollWidth=${metrics.scrollWidth} clientWidth=${metrics.clientWidth} body=${metrics.bodyScrollWidth}`,
      );

      expect(metrics.scrollWidth, `${item.path} @ ${viewport.width}`).toBeLessThanOrEqual(
        metrics.clientWidth + 1,
      );
    }
  }

  // Mobile navigation must open and contain the main links.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await expect(page.getByRole("navigation", { name: "Основная навигация" })).toBeVisible();
  await expect(page.getByRole("link", { name: "AI-помощник" })).toBeVisible();

  // Pagination + filter combination on the leads list.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/leads?limit=5&page=2");
  await expect(page.getByText(/Страница 2 из/)).toBeVisible();
  await page.goto("/leads?status=NEW&sort=priority:desc&limit=5");
  await expect(page.getByText(/Страница 1 из/)).toBeVisible();

  // Empty state for a filter with no matches.
  await page.goto("/leads?search=__no_such_lead__");
  await expect(page.getByText("По фильтрам ничего не найдено")).toBeVisible();
  await expect(page.getByRole("link", { name: "Сбросить фильтры" })).toBeVisible();

  console.log(`CONSOLE_ERRORS ${JSON.stringify(consoleErrors, null, 2)}`);
  expect(consoleErrors).toEqual([]);
});
