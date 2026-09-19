import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * テーマトークンの「旧・実値」が画面に残っていないことを見る。
 *
 * トークンの値を変えても、SVG の fill / stroke やグラデーション文字列に
 * 書かれた実値は追従しない。その結果、同じ画面に accent が 2 種類出る、
 * 地の色だけ変わらない、といった形で統一感が崩れる。
 * 値を更新したら、ここへ旧値を足して残骸が無いことを確かめる。
 */
const RETIRED: ReadonlyArray<readonly [string, string]> = [
  ["#2554ff", "旧 accent（現在は --color-accent）"],
  ["#1d44d8", "旧 accent-hover（現在は --color-accent-hover）"],
  ["#eef2f7", "旧 page 背景（現在は --color-bg）"],
  ["#f4f6fb", "旧 bg-input（現在は --color-bg-input）"],
  ["#0d1117", "旧 Dark 背景（現在は --color-bg）"],
  ["#161b22", "旧 Dark カード（現在は --color-bg-card）"],
  ["#58a6ff", "旧 Dark accent（現在は --color-accent）"],
  ["#8b949e", "旧 Dark muted（現在は --color-text-muted）"],
];

/** ゲームは固有パレット、管理画面は常時 Dark。いずれも意図的な例外 */
const EXEMPT = [
  "penguin-shooter",
  "penguin-rabbit-shooter",
  join("app", "admin"),
];

function collect(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      collect(full, out);
    } else if (/\.(tsx?|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("retired theme colors", () => {
  const root = process.cwd();
  const files = [
    ...collect(resolve(root, "app")),
    ...collect(resolve(root, "components")),
  ].filter(
    (f) =>
      !f.endsWith(join("app", "globals.css")) &&
      !EXEMPT.some((skip) => f.includes(skip)),
  );

  it.each(RETIRED)("%s は残っていない（%s）", (hex) => {
    const offenders = files.filter((f) =>
      readFileSync(f, "utf8").toLowerCase().includes(hex),
    );
    expect(
      offenders.map((f) => f.slice(root.length + 1)),
      `${hex} が直書きで残っています`,
    ).toEqual([]);
  });
});
