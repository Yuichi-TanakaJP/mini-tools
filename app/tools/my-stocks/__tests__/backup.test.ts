import { describe, it, expect } from "vitest";
import type { MyStockItem } from "../types";
import {
  BACKUP_SCHEMA,
  mergeItems,
  parseBackupItems,
  serializeBackup,
} from "../backup";

function item(overrides: Partial<MyStockItem> = {}): MyStockItem {
  return {
    id: "id-1",
    code: "7203",
    name: "トヨタ自動車",
    market: "プライム（内国株式）",
    sector: "輸送用機器",
    tab: "holding",
    quantity: 100,
    acquisitionPrice: 2500,
    memo: "",
    addedAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe("serializeBackup / parseBackupItems", () => {
  it("直列化したものを復元できる（round-trip）", () => {
    const items = [item(), item({ id: "id-2", code: "6758", name: "ソニーG", tab: "watch" })];
    const restored = parseBackupItems(serializeBackup(items));
    expect(restored).not.toBeNull();
    expect(restored).toHaveLength(2);
    expect(restored?.[0].code).toBe("7203");
  });

  it("schema を持つバックアップ形式を受け付ける", () => {
    const text = JSON.stringify({
      schema: BACKUP_SCHEMA,
      version: 1,
      exportedAt: "2026-05-31T00:00:00.000Z",
      items: [item()],
    });
    expect(parseBackupItems(text)).toHaveLength(1);
  });

  it("items 配列のみの JSON も寛容に受け付ける", () => {
    expect(parseBackupItems(JSON.stringify([item()]))).toHaveLength(1);
  });

  it("不正な JSON は null", () => {
    expect(parseBackupItems("{ not json")).toBeNull();
  });

  it("schema 不一致のオブジェクトは null", () => {
    const text = JSON.stringify({ schema: "other", items: [item()] });
    expect(parseBackupItems(text)).toBeNull();
  });

  it("不正な要素は正規化で除去される", () => {
    const text = JSON.stringify([item(), { foo: "bar" }, { tab: "holding" }]);
    expect(parseBackupItems(text)).toHaveLength(1);
  });
});

describe("mergeItems", () => {
  it("同一タブ・同一コードはスキップして既存を優先する", () => {
    const current = [item({ id: "cur", memo: "既存メモ" })];
    const incoming = [item({ id: "inc", memo: "取込メモ" })];
    const result = mergeItems(current, incoming);
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.merged).toHaveLength(1);
    expect(result.merged[0].memo).toBe("既存メモ");
  });

  it("タブが違えば同一コードでも追加する", () => {
    const current = [item({ id: "cur", tab: "holding" })];
    const incoming = [item({ id: "inc", tab: "watch" })];
    const result = mergeItems(current, incoming);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.merged).toHaveLength(2);
  });

  it("id が衝突する追加項目は新しい id を振り直す", () => {
    const current = [item({ id: "dup", code: "7203", tab: "holding" })];
    const incoming = [item({ id: "dup", code: "6758", tab: "holding" })];
    const result = mergeItems(current, incoming);
    expect(result.added).toBe(1);
    const ids = result.merged.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length); // 全 id 一意
  });
});
