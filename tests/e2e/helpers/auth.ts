/**
 * E2E login helper.
 *
 * Logs in through the real credentials form (so Auth.js, CSRF and cookies are
 * exercised end to end) and reuses the resulting storage state across tests.
 */
import { expect, type BrowserContext, type Page } from "@playwright/test";

export type DemoRole = "ADMIN" | "MANAGER" | "OPERATOR";

export const DEMO_EMAILS: Record<DemoRole, string> = {
  ADMIN: process.env.E2E_ADMIN_EMAIL ?? "admin@demo.local",
  MANAGER: process.env.E2E_MANAGER_EMAIL ?? "manager@demo.local",
  OPERATOR: process.env.E2E_OPERATOR_EMAIL ?? "operator@demo.local",
};

export const ROLE_LABELS: Record<DemoRole, string> = {
  ADMIN: "Администратор",
  MANAGER: "Менеджер",
  OPERATOR: "Оператор",
};

export function demoPassword(): string {
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    throw new Error(
      "SEED_ADMIN_PASSWORD is required for E2E: run against a database seeded with the same value.",
    );
  }

  return password;
}

export async function login(page: Page, role: DemoRole = "ADMIN"): Promise<void> {
  await page.goto("/login");

  await page.getByLabel("Email", { exact: true }).fill(DEMO_EMAILS[role]);
  await page.getByLabel("Пароль", { exact: true }).fill(demoPassword());
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Меню пользователя" }).click();
  await page.getByRole("menuitem", { name: "Выйти" }).click();

  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
}

export async function newLoggedInContext(
  context: BrowserContext,
  role: DemoRole = "ADMIN",
): Promise<Page> {
  const page = await context.newPage();
  await login(page, role);
  return page;
}
