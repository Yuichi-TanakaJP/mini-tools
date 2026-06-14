import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveShareUrl } from "../share-url";

const SITE_URL = "https://mini-tools.example.com";

describe("resolveShareUrl", () => {
  let originalSiteUrl: string | undefined;

  beforeEach(() => {
    originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
  });

  describe("env 未設定", () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    });

    it("マウント前 (origin=null) は相対パスを返す（SSR と初回 CSR を一致させる）", () => {
      expect(resolveShareUrl(undefined, "/tools/my-stocks", null, null)).toBe(
        "/tools/my-stocks",
      );
    });

    it("query 付きの相対パスを保持する", () => {
      const sp = new URLSearchParams({ tab: "ratio", code: "7203" });
      expect(resolveShareUrl(undefined, "/tools/my-stocks", sp, null)).toBe(
        "/tools/my-stocks?tab=ratio&code=7203",
      );
    });

    it("マウント後 (origin 注入) は現在 origin を base に絶対 URL を返す", () => {
      expect(
        resolveShareUrl(undefined, "/tools/my-stocks", null, "http://localhost:3000"),
      ).toBe("http://localhost:3000/tools/my-stocks");
    });
  });

  describe("env 設定済み", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SITE_URL = SITE_URL;
    });

    it("マウント前でも env を base に絶対 URL を返す", () => {
      expect(resolveShareUrl(undefined, "/tools/my-stocks", null, null)).toBe(
        `${SITE_URL}/tools/my-stocks`,
      );
    });

    it("origin より env を優先する", () => {
      expect(
        resolveShareUrl(undefined, "/tools/my-stocks", null, "http://localhost:3000"),
      ).toBe(`${SITE_URL}/tools/my-stocks`);
    });

    it("末尾スラッシュは正規化する", () => {
      process.env.NEXT_PUBLIC_SITE_URL = `${SITE_URL}///`;
      expect(resolveShareUrl(undefined, "/tools/x", null, null)).toBe(
        `${SITE_URL}/tools/x`,
      );
    });
  });

  describe("url prop 指定", () => {
    it("絶対 URL の url prop はそのまま使う", () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      expect(
        resolveShareUrl("https://example.com/share/abc", "/tools/x", null, null),
      ).toBe("https://example.com/share/abc");
    });

    it("相対 url prop は base で絶対化する（env 優先）", () => {
      process.env.NEXT_PUBLIC_SITE_URL = SITE_URL;
      expect(resolveShareUrl("/p/123", "/tools/x", null, null)).toBe(
        `${SITE_URL}/p/123`,
      );
    });

    it("相対 url prop は base 未解決なら相対のまま返す", () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      expect(resolveShareUrl("/p/123", "/tools/x", null, null)).toBe("/p/123");
    });

    it("url prop は pathname より優先される", () => {
      process.env.NEXT_PUBLIC_SITE_URL = SITE_URL;
      expect(resolveShareUrl("/override", "/tools/x", null, "http://localhost:3000")).toBe(
        `${SITE_URL}/override`,
      );
    });
  });
});
