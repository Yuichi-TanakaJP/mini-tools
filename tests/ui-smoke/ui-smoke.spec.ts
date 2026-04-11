import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type SmokeCase = {
  slug: string;
  path: string;
  heading: RegExp;
  action?: "fill-charcount" | "fill-total";
};

const smokeCases: SmokeCase[] = [
  { slug: "charcount", path: "/tools/charcount", heading: /X投稿文字数カウント/, action: "fill-charcount" },
  { slug: "total", path: "/tools/total", heading: /数字を貼るだけで合計/, action: "fill-total" },
  { slug: "yutai-memo", path: "/tools/yutai-memo", heading: /優待銘柄メモ帳/ },
  { slug: "yutai-expiry", path: "/tools/yutai-expiry", heading: /株主優待リスト|株主優待期限帳/ },
  { slug: "stock-ranking", path: "/tools/stock-ranking", heading: /株価ランキング|ランキング/ },
  { slug: "topix33", path: "/tools/topix33", heading: /TOPIX33|業種/ },
  { slug: "nikkei-contribution", path: "/tools/nikkei-contribution", heading: /日経225寄与度|寄与度/ },
];

async function persistArtifact(slug: string, name: string, body: string) {
  const dir = path.join(process.cwd(), ".tmp", "ui-smoke-artifacts", slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), body, "utf-8");
}

test.describe("ui smoke", () => {
  for (const smokeCase of smokeCases) {
    test(smokeCase.slug, async ({ page }, testInfo) => {
      const consoleErrors: string[] = [];
      const requestFailures: string[] = [];

      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });

      page.on("pageerror", (error) => {
        consoleErrors.push(error.message);
      });

      page.on("requestfailed", (request) => {
        const failureText = request.failure()?.errorText ?? "unknown";
        const url = request.url();
        if (
          url.includes("google-analytics.com/g/collect") ||
          url.includes("www.googletagmanager.com/gtag/js")
        ) {
          return;
        }
        requestFailures.push(`${request.method()} ${url} :: ${failureText}`);
      });

      const response = await page.goto(smokeCase.path, { waitUntil: "networkidle" });
      expect(response?.ok()).toBeTruthy();
      await expect(page.locator("body")).toContainText(smokeCase.heading);

      if (smokeCase.action === "fill-charcount") {
        const textarea = page.locator("textarea").first();
        await textarea.fill("テスト投稿です\nhttps://example.com");
        await expect(page.getByText("OK")).toBeVisible();
      }

      if (smokeCase.action === "fill-total") {
        const textarea = page.locator("textarea").first();
        await textarea.fill("1200\n300\n-50");
        await expect(page.getByText("1,450")).toBeVisible();
      }

      const screenshotPath = path.join(process.cwd(), ".tmp", "ui-smoke-artifacts", smokeCase.slug, "page.png");
      await page.screenshot({ path: screenshotPath, fullPage: true });

      await persistArtifact(smokeCase.slug, "console-errors.json", JSON.stringify(consoleErrors, null, 2));
      await persistArtifact(smokeCase.slug, "request-failures.json", JSON.stringify(requestFailures, null, 2));

      await testInfo.attach("console-errors", {
        body: Buffer.from(JSON.stringify(consoleErrors, null, 2)),
        contentType: "application/json",
      });
      await testInfo.attach("request-failures", {
        body: Buffer.from(JSON.stringify(requestFailures, null, 2)),
        contentType: "application/json",
      });

      expect(consoleErrors).toEqual([]);
      expect(requestFailures).toEqual([]);
    });
  }
});
