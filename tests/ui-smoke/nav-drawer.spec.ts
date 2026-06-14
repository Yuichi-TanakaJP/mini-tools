import { expect, test } from "@playwright/test";

test.describe("nav drawer", () => {
  test("opens, filters, navigates, and highlights current tool", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (e) => consoleErrors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });

    await page.goto("/tools/total", { waitUntil: "networkidle" });

    const drawer = page.getByRole("dialog", { name: "ツールメニュー" });

    // 初期は閉じている（inert）
    await expect(drawer).toHaveAttribute("inert", /.*/);

    // ハンバーガーで開く → パネルにフォーカスが移る
    await page.getByRole("button", { name: "メニューを開く" }).click();
    await expect(drawer).not.toHaveAttribute("inert", /.*/);
    await expect(drawer).toBeFocused();

    // 現在地（合計計算）がハイライト = aria-current
    await expect(
      drawer.getByRole("link", { name: /合計計算/ })
    ).toHaveAttribute("aria-current", "page");

    // 検索で絞り込み
    await page.getByRole("searchbox", { name: "ツールを検索" }).fill("優待カレンダー");
    await expect(drawer.getByRole("link", { name: /優待カレンダー/ })).toBeVisible();
    await expect(drawer.getByRole("link", { name: /合計計算/ })).toHaveCount(0);

    // 別ツールへ遷移 → ドロワーが閉じる
    await drawer.getByRole("link", { name: /優待カレンダー/ }).click();
    await page.waitForURL("**/tools/yutai-candidates");
    await expect(drawer).toHaveAttribute("inert", /.*/);

    // 再度開いて Esc で閉じる → フォーカスがハンバーガーに戻る
    const hamburger = page.getByRole("button", { name: "メニューを開く" });
    await hamburger.click();
    await expect(drawer).not.toHaveAttribute("inert", /.*/);
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveAttribute("inert", /.*/);
    await expect(hamburger).toBeFocused();

    expect(consoleErrors).toEqual([]);
  });
});
