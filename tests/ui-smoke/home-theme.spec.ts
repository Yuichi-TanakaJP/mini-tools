import { expect, test } from "@playwright/test";

test("home stays concise and theme is selected with icons", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: /投資と日常の、\s*小さな道具。/ })).toBeVisible();
  await expect(page.getByText("必要なものを、すぐ使えます。", { exact: true })).toBeVisible();
  await expect(page.getByText("保有・ウォッチを端末内に保存", { exact: true })).toBeVisible();
  await expect(page.getByText(/決算予定日・優待権利月のバッジ付き/)).toHaveCount(0);

  const themeTrigger = page.getByRole("button", { name: /^表示テーマ:/ });
  await expect(themeTrigger).toBeVisible();
  await themeTrigger.click();

  const themeMenu = page.getByRole("group", { name: "表示テーマを選択" });
  await expect(themeMenu.getByRole("button")).toHaveCount(3);
  await themeMenu.getByRole("button", { name: "ライト" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await themeTrigger.click();
  await page.getByRole("button", { name: "ダーク" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
