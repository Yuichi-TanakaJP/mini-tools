import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeListView } from "./ThemeViewer";
import { parseThemeListPageResponse } from "./data-loader";

function listPage(hasMore: boolean) {
  return parseThemeListPageResponse({
    schemaVersion: "theme-viewer-list.v2", nextCursor: hasMore ? "next_cursor" : null, hasMore,
    themes: [{ id: "theme-1", slug: "test", displayName: "Test theme", status: "draft" }],
  });
}

describe("theme page navigation", () => {
  it("shows current page size and a next link without claiming a total", () => {
    const html = renderToStaticMarkup(createElement(ThemeListView, { result: { status: "ok", data: listPage(true) } }));
    expect(html).toContain("このページ 1件（続きがあります）");
    expect(html).toContain('href="/premium/themes?cursor=next_cursor"');
    expect(html).toContain('href="/premium/themes/theme-1"');
    expect(html).not.toContain("全1件");
  });
  it("marks the final page and allows restarting", () => {
    const html = renderToStaticMarkup(createElement(ThemeListView, { result: { status: "ok", data: listPage(false) }, isContinuation: true }));
    expect(html).toContain("最後のページ");
    expect(html).toContain("最初のページへ");
    expect(html).not.toContain("続きを見る");
  });
  it("keeps a failed continuation as an error with a restart link", () => {
    const html = renderToStaticMarkup(createElement(ThemeListView, { result: { status: "upstream_error", message: "一時的な取得失敗", httpStatus: 503 }, isContinuation: true }));
    expect(html).toContain("一時的な取得失敗");
    expect(html).toContain("最初のページへ");
    expect(html).not.toContain("データはまだありません");
    expect(html).not.toContain("最後のページ");
  });
});
