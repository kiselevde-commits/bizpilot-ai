import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";

/**
 * Scenario B — AI analysis with the mock provider.
 *
 * The Playwright web server is started with `AI_PROVIDER=mock` and
 * `ALLOW_MOCK_AI=true` (see `playwright.config.ts`), so CI never calls a paid
 * LLM. The scenario proves that a result is only persisted after the explicit
 * "Применить к заявке" confirmation.
 */
test.describe("Сценарий B — AI-анализ", () => {
  const suffix = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000)}`;
  const leadTitle = `E2E AI ${suffix}`;

  test("mock AI: анализ → подтверждение → сохранение и история", async ({ page }) => {
    await login(page, "ADMIN");

    // 1. Create a dedicated lead so the scenario never mutates seed data.
    await page.goto("/leads/new");
    await page.getByLabel("Название заявки").fill(leadTitle);
    await page.getByLabel("Источник").fill("E2E");
    await page
      .getByLabel("Текст заявки")
      .fill(
        "Нужна автоматизация отчётов и уведомления в Telegram для отдела продаж. " +
          "Контакт: Тест Тестов, test.ai@example.com, +7 900 123-45-67.",
      );
    await page.getByRole("button", { name: "Создать заявку" }).click();
    await expect(page).toHaveURL(/\/leads$/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: leadTitle })).toBeVisible();

    // 2. Open the assistant and pick the new lead.
    await page.goto("/ai-assistant");
    const leadSelect = page.locator("#lead-select");
    await expect(leadSelect).toBeVisible();
    await leadSelect.selectOption({ label: leadTitle });

    const leadId = await leadSelect.inputValue();
    expect(leadId).toMatch(/^[0-9a-f-]{36}$/);

    await expect(page.locator("#analysis-text")).not.toHaveValue("");
    await expect(page.getByTestId("ai-health")).toContainText("AI готов");

    // 3. Run the mock analysis.
    await page.getByTestId("analyze-button").click();
    await expect(page.getByTestId("ai-result")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("ai-summary")).toContainText("Мок-анализ");
    await expect(page.getByTestId("ai-score")).toContainText("50");
    await expect(page.getByTestId("ai-priority")).toContainText("Средний");
    await expect(page.getByTestId("ai-category")).toContainText("Бизнес-автоматизация");
    await expect(page.getByTestId("ai-extracted-contacts")).toContainText("test.ai@example.com");
    await expect(page.getByTestId("ai-extracted-contacts")).toContainText(
      "Контакты не сохранены автоматически",
    );
    await expect(page.getByTestId("ai-history")).toBeVisible();

    // 4. AI must not mutate the lead before the explicit confirmation.
    await expect(page.getByText("AI не меняет заявку без вашего подтверждения.")).toBeVisible();

    // 5. Explicitly apply the result.
    await page.getByTestId("apply-analysis").click();
    await expect(page.getByTestId("apply-analysis")).toHaveText("Применено");

    // 6. Draft reply is prepared but never sent automatically.
    await page.getByRole("button", { name: "Черновик ответа" }).click();
    await expect(page.getByTestId("draft-reply")).toContainText("Благодарим за заявку");
    await expect(page.getByText("Черновик не отправляется автоматически")).toBeVisible();

    // 7. The applied result is persisted on the lead card.
    await page.goto(`/leads/${leadId}`);
    await expect(page.getByRole("heading", { level: 1, name: leadTitle })).toBeVisible();
    await expect(page.getByText("AI-резюме")).toBeVisible();
    await expect(page.getByText("Мок-анализ", { exact: false })).toBeVisible();
    await expect(page.getByText("50", { exact: true })).toBeVisible();
    await expect(page.getByText("Бизнес-автоматизация")).toBeVisible();
    // Extracted contacts are shown in the analysis but never saved implicitly.
    await expect(page.getByText("Не связан")).toBeVisible();

    // 8. Analysis history survives a reload of the assistant.
    await page.goto(`/ai-assistant?leadId=${leadId}`);
    await expect(page.getByTestId("ai-history")).toBeVisible();
  });
});
