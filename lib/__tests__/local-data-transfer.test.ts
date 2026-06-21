import { describe, expect, it } from "vitest";
import {
  BACKUP_SCHEMA,
  parseBackup,
  serializeBackup,
  type BackupFile,
} from "../local-data-transfer";

function makeBackup(data: Record<string, string>): BackupFile {
  return {
    schema: BACKUP_SCHEMA,
    version: 1,
    exportedAt: "2026-06-21T00:00:00.000Z",
    origin: "https://example.test",
    itemCount: Object.keys(data).length,
    data,
  };
}

describe("local-data-transfer", () => {
  it("serialize と parse で往復できる", () => {
    const backup = makeBackup({
      yutai_memo_items_v1: '[{"id":"a"}]',
      mini_tools_total_lines_v1: "1200\n300",
    });
    const json = serializeBackup(backup);
    const result = parseBackup(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.data).toEqual(backup.data);
      expect(result.backup.itemCount).toBe(2);
    }
  });

  it("schema が違う JSON は拒否する", () => {
    const result = parseBackup(JSON.stringify({ schema: "something-else", data: {} }));
    expect(result.ok).toBe(false);
  });

  it("JSON でない文字列は拒否する", () => {
    const result = parseBackup("not json {");
    expect(result.ok).toBe(false);
  });

  it("data が無い場合は拒否する", () => {
    const result = parseBackup(JSON.stringify({ schema: BACKUP_SCHEMA, version: 1 }));
    expect(result.ok).toBe(false);
  });

  it("data 内の非文字列値は無視する", () => {
    const result = parseBackup(
      JSON.stringify({
        schema: BACKUP_SCHEMA,
        version: 1,
        data: { good: "ok", bad: 123, also_bad: null },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.data).toEqual({ good: "ok" });
    }
  });
});
