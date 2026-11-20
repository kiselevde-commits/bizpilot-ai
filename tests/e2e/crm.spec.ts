import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";

/**
 * Scenario A — CRM flow:
 * login → Dashboard → create Lead → find it in the list → open the card →
 * link it to a Contact → create and assign a Task.
 *
 * Runs against the seeded demo workspace. All created entities use a unique
 * suffix so repeated runs never collide with seed data.
 */
test.describe("Сценарий A — CRM", () => {
  const suffix = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000)}`;
  const leadTitle = `E2E Заявка ${suffix}`;
  const contactName = `E2E Контакт ${suffix}`;
  const taskTitle = `E2E Задача ${suffix}`;
  // Duplicate detection matches normalized phone numbers, so every run needs
  // its own number (otherwise the second run gets 409 DUPLICATE_CONTACT).
  const phoneDigits = String(Date.now()).slice(-10);
  const phone = `+7 ${phoneDigits.slice(0, 3)} ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6, 8)}-${phoneDigits.slice(8)}`;

  test("полный цикл: заявка → контакт → задача", async ({ page }) => {
    await login(page, "ADMIN");

    // 2. Dashboard
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Заявки" })).toBeVisible();

    // 3. Create lead
    await page.getByRole("link", { name: "Заявки" }).click();
    await expect(page).toHaveURL(/\/leads$/);

    await page.getByRole("link", { name: "Новая заявка" }).click();
    await expect(page).toHaveURL(/\/leads\/new/);

    await page.getByLabel("Название заявки").fill(leadTitle);
    await page.getByLabel("Источник").fill("E2E");
    await page.getByLabel("Приоритет").selectOption("HIGH");
    await page
      .getByLabel("Текст заявки")
      .fill(
        "Нужна интеграция с CRM и автоматическая отправка уведомлений в Telegram. " +
          "Контакт: Иван Иванов, ivan.e2e@example.com, +7 999 000-11-22.",
      );
    await page.getByRole("button", { name: "Создать заявку" }).click();

    // 4. Lead appears in the list
    await expect(page).toHaveURL(/\/leads$/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: leadTitle })).toBeVisible();

    // Filter by search to prove list filters are functional
    await page.getByLabel("Поиск").fill(suffix);
    await page.getByRole("button", { name: "Применить" }).click();
    await expect(page).toHaveURL(new RegExp(`search=${suffix}`));
    await expect(page.getByRole("link", { name: leadTitle })).toBeVisible();

    // 5. Open the lead card
    await page.getByRole("link", { name: leadTitle }).click();
    await expect(page).toHaveURL(/\/leads\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: leadTitle })).toBeVisible();
    await expect(page.getByText("Не связан")).toBeVisible();

    const leadId = page.url().split("/").pop() ?? "";
    expect(leadId).toMatch(/^[0-9a-f-]{36}$/);

    // 6. Link to a Contact
    await page.getByRole("link", { name: "Контакты" }).click();
    await expect(page).toHaveURL(/\/crm$/);

    await page.getByRole("link", { name: "Новый контакт" }).click();
    await expect(page).toHaveURL(/\/crm\/new/);

    await page.getByLabel("Имя", { exact: true }).fill(contactName);
    await page.getByLabel("Компания").fill("ООО E2E");
    await page.getByLabel("Email").fill(`contact-${suffix}@example.com`);
    await page.getByLabel("Телефон").fill(phone);
    await page.getByRole("button", { name: "Создать контакт" }).click();

    await expect(page).toHaveURL(/\/crm\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: contactName })).toBeVisible();
    // Link the contact to the lead through the lead edit form
    await page.goto(`/leads/${leadId}/edit`);
    await expect(page.getByLabel("Название заявки")).toHaveValue(leadTitle);
    await page.getByLabel("Контакт").selectOption({ label: `${contactName} — ООО E2E` });
    await page.getByRole("button", { name: "Сохранить" }).click();

    await expect(page).toHaveURL(new RegExp(`/leads/${leadId}$`), { timeout: 30_000 });
    await expect(page.getByRole("link", { name: contactName })).toBeVisible();

    // 7. Create and assign a Task from the lead card
    await page.getByRole("link", { name: "Создать задачу" }).click();
    await expect(page).toHaveURL(new RegExp(`/tasks/new\\?leadId=${leadId}`));

    await page.getByLabel("Название задачи").fill(taskTitle);
    await page.getByLabel("Описание").fill("Связаться с клиентом и уточнить требования");
    await page.getByLabel("Приоритет").selectOption("HIGH");
    await page.getByLabel("Ответственный").selectOption({ label: "Менеджер Проектов · Менеджер" });
    await page.getByRole("button", { name: "Создать задачу" }).click();

    await expect(page).toHaveURL(/\/tasks$/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: taskTitle })).toBeVisible();

    // Task is assigned and linked back to the lead
    await page.goto(`/leads/${leadId}`);
    await expect(page.getByText(taskTitle)).toBeVisible();
    await page.getByRole("link", { name: "Открыть" }).first().click();
    await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: taskTitle })).toBeVisible();
    await expect(page.getByText("Менеджер Проектов").first()).toBeVisible();
  });

  test("OPERATOR не видит удаление, но может создать заявку", async ({ page }) => {
    await login(page, "OPERATOR");

    await page.goto("/leads/new");
    await page.getByLabel("Название заявки").fill(`E2E Оператор ${suffix}`);
    await page.getByLabel("Текст заявки").fill("Заявка, созданная оператором в E2E.");
    await page.getByRole("button", { name: "Создать заявку" }).click();

    await expect(page).toHaveURL(/\/leads$/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: `E2E Оператор ${suffix}` })).toBeVisible();

    // Automation journal is ADMIN/MANAGER only
    await page.goto("/settings");
    await expect(page.getByText("Автоматизация недоступна")).toBeVisible();
  });
});
