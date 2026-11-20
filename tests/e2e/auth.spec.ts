import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Аутентификация", () => {
  test("неверный пароль показывает ошибку и не пускает в дашборд", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email", { exact: true }).fill("admin@demo.local");
    await page.getByLabel("Пароль", { exact: true }).fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Войти" }).click();

    await expect(page.getByText("Неверный email или пароль")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("защищённая страница перенаправляет на логин", async ({ page }) => {
    await page.goto("/leads");

    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fleads/);
  });

  test("ADMIN входит, видит навигацию и выходит", async ({ page }) => {
    await login(page, "ADMIN");

    await expect(page.getByRole("navigation", { name: "Основная навигация" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Заявки" })).toBeVisible();
    await expect(page.getByRole("link", { name: "AI-помощник" })).toBeVisible();

    await page.getByRole("button", { name: "Меню пользователя" }).click();
    await expect(page.getByRole("menuitem", { name: "Выйти" })).toBeVisible();
  });
});
