import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { COLOR_LITERAL_BUDGET } from "./color-literal-budget";

/**
 * 直書き色がこれ以上増えないように見張る。
 *
 * 配色の統一は一度やって終わりではなく、新しい画面を書くたびに崩れる。
 * 役割トークンを使わずに色を書いたら、このテストが落ちて気づけるようにする。
 */
const EXEMPT = [
  "penguin-shooter",
  "penguin-rabbit-shooter",
  join("app", "admin"),
];
const HEX = /#[0-9a-fA-F]{3,8}\b/g;

function collect(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      collect(full, out);
    } else if (/\.(tsx?|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function countLiterals(): Map<string, number> {
  const root = process.cwd();
  const counts = new Map<string, number>();
  const files = [
    ...collect(resolve(root, "app")),
    ...collect(resolve(root, "components")),
  ];
  for (const file of files) {
    if (EXEMPT.some((skip) => file.includes(skip))) continue;
    const rel = file
      .slice(root.length + 1)
      .split(/[\\/]/)
      .join("/");
    if (rel === "app/globals.css") continue;
    if (rel.includes("__tests__")) continue;
    const n = (readFileSync(file, "utf8").match(HEX) ?? []).length;
    if (n > 0) counts.set(rel, n);
  }
  return counts;
}

describe("color literal budget", () => {
  const counts = countLiterals();

  it("予算に載っていないファイルへ色リテラルを増やしていない", () => {
    const unlisted = [...counts.keys()].filter(
      (f) => !(f in COLOR_LITERAL_BUDGET),
    );
    expect(
      unlisted,
      "役割トークン（app/globals.css）を使ってください。グラフ・ブランド・ゲームなど" +
        "理由がある場合は color-literal-budget.ts に追加してください",
    ).toEqual([]);
  });

  it("既存ファイルの色リテラルが増えていない", () => {
    const grown = [...counts.entries()]
      .filter(
        ([f, n]) => f in COLOR_LITERAL_BUDGET && n > COLOR_LITERAL_BUDGET[f],
      )
      .map(([f, n]) => `${f}: ${COLOR_LITERAL_BUDGET[f]} -> ${n}`);
    expect(grown, "直書き色が増えています").toEqual([]);
  });

  it("減らしたら予算も下げる（予算が実態より緩くなっていない）", () => {
    const stale = Object.entries(COLOR_LITERAL_BUDGET)
      .filter(([f, budget]) => (counts.get(f) ?? 0) < budget)
      .map(([f, budget]) => `${f}: ${budget} -> ${counts.get(f) ?? 0}`);
    expect(stale, "色リテラルが減ったので予算を更新してください").toEqual([]);
  });
});
