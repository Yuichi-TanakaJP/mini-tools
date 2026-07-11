import { describe, expect, it } from "vitest";
import { hasPrepEntry, togglePrepEntry, type PrepLog } from "../prep-log";

describe("togglePrepEntry", () => {
  it("未記録の年月を追加し、昇順ユニークで保持する", () => {
    let log: PrepLog = {};
    log = togglePrepEntry(log, "138A", "2026-02");
    log = togglePrepEntry(log, "138A", "2026-01");
    expect(log["138A"]).toEqual(["2026-01", "2026-02"]);
  });

  it("同じ年月をもう一度トグルすると外す。空になれば code ごと消す", () => {
    let log: PrepLog = { "138A": ["2026-02"] };
    log = togglePrepEntry(log, "138A", "2026-02");
    expect(log["138A"]).toBeUndefined();
    expect(Object.keys(log)).toHaveLength(0);
  });

  it("不正な年月・空コードは無視する", () => {
    const log: PrepLog = {};
    expect(togglePrepEntry(log, "138A", "2026-2")).toBe(log);
    expect(togglePrepEntry(log, "", "2026-02")).toBe(log);
  });

  it("元の log を破壊しない", () => {
    const log: PrepLog = { "138A": ["2026-02"] };
    const next = togglePrepEntry(log, "138A", "2026-05");
    expect(log["138A"]).toEqual(["2026-02"]);
    expect(next["138A"]).toEqual(["2026-02", "2026-05"]);
  });
});

describe("hasPrepEntry", () => {
  it("記録の有無を返す", () => {
    const log: PrepLog = { "138A": ["2026-02"] };
    expect(hasPrepEntry(log, "138A", "2026-02")).toBe(true);
    expect(hasPrepEntry(log, "138A", "2026-03")).toBe(false);
    expect(hasPrepEntry(log, "999X", "2026-02")).toBe(false);
    expect(hasPrepEntry(log, "", "2026-02")).toBe(false);
  });
});
