import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { chromium, expect } from "@playwright/test";

// Keep all generated bundles and screenshots in a caller-selected disposable directory.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.STOCK_MONITORING_UAT_DIR) throw new Error("Set STOCK_MONITORING_UAT_DIR to a scratch directory");
const outDir = path.resolve(process.env.STOCK_MONITORING_UAT_DIR);
if (outDir === root || outDir.startsWith(root + path.sep)) throw new Error("Use a scratch directory outside the repository");
await mkdir(outDir, { recursive: true });
await build({ configFile: false, root, define: { "process.env.NODE_ENV": JSON.stringify("production") },
  resolve: { alias: { react: path.join(root, "node_modules/react"), "react-dom": path.join(root, "node_modules/react-dom") } },
  build: { outDir, emptyOutDir: false, lib: { entry: path.join(root, "scripts/fixtures/stock-monitoring-editor.tsx"), name: "Fixture", formats: ["iife"], fileName: () => "editor.js" } },
});
const html = '<!doctype html><meta charset="utf-8"><style>body{font:14px sans-serif;margin:16px}section{margin-bottom:24px}</style><div id="root"></div><script src="/editor.js"></script>';
const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", req.url === "/editor.js" ? "text/javascript" : "text/html; charset=utf-8");
  res.end(req.url === "/editor.js" ? await readFile(path.join(outDir, "editor.js")) : html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const a = page.getByRole("region", { name: "Editor A", exact: true });
  const b = page.getByRole("region", { name: "Editor B", exact: true });
  const save = (editor) => editor.getByRole("button", { name: "注目目的・監視設定を保存", exact: true });
  await expect(a.getByRole("combobox")).toHaveValue("unset");
  await b.getByRole("combobox").selectOption("off");
  await save(b).click();
  await expect(b.getByRole("status")).toContainText("設定を保存しました");
  await page.evaluate(() => window.refresh());
  await expect(a.getByRole("combobox")).toHaveValue("off");
  await a.getByRole("checkbox", { name: "業績・成長", exact: true }).check();
  await b.getByRole("combobox").selectOption("on");
  await save(b).click();
  // A has not refreshed yet: its write must be rejected by the edit-start CAS.
  await save(a).click();
  await expect(a.getByRole("alert")).toContainText("入力内容は保持");
  await expect(a.getByRole("checkbox", { name: "業績・成長", exact: true })).toBeChecked();
  expect(await page.evaluate(() => window.stored.creditMonitoringEnabled)).toBe(true);
  expect(await page.evaluate(() => window.writes)).toBe(2);
  await page.evaluate(() => window.refresh());
  await expect(save(a)).toBeDisabled();
  await expect(a.getByText("他の画面で設定が更新されました。", { exact: false })).toBeVisible();
  await a.getByRole("button", { name: "取得済みの最新設定を読み直す", exact: true }).click();
  await expect(a.getByRole("combobox")).toHaveValue("on");
  await expect(a.getByRole("checkbox", { name: "業績・成長", exact: true })).not.toBeChecked();
  await a.getByRole("checkbox", { name: "配当", exact: true }).check();
  await page.evaluate(() => { window.holdNext = true; });
  await save(a).click();
  await expect(a.getByRole("button", { name: "保存中…", exact: true })).toBeDisabled();
  await a.locator("form").evaluate((form) => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  await page.evaluate(() => window.finish());
  await expect(a.getByRole("status")).toContainText("設定を保存しました");
  expect(await page.evaluate(() => window.writes)).toBe(3);
  await page.evaluate(() => window.refresh());
  await expect(a.getByRole("checkbox", { name: "配当", exact: true })).toBeChecked();
  await expect(b.getByRole("checkbox", { name: "配当", exact: true })).toBeChecked();
  await a.getByRole("combobox").selectOption("off");
  await page.evaluate(() => { window.failNext = true; });
  await save(a).click();
  await expect(a.getByRole("alert")).toContainText("入力内容は保持");
  await expect(a.getByRole("combobox")).toHaveValue("off");
  await save(a).click();
  await expect(a.getByRole("status")).toContainText("設定を保存しました");
  expect(await page.evaluate(() => window.stored)).toMatchObject({ watchPurposes: ["dividend"], creditMonitoringEnabled: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: path.join(outDir, "two-editors-mobile.png"), fullPage: true });
  console.log("PASS: clean refresh, two editors/different fields, stale CAS, dirty conflict/input retention, explicit reload, pending duplicate prevention, retry, 390px layout");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
