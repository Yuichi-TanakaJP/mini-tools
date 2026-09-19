import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSearchPresets, SEARCH_PRESETS_KEY, saveSearchPresets } from "../search-preset-storage";

describe("search-preset-storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("localStorageから配列を読み込む", () => {
    const getItem = vi.fn(() => JSON.stringify([{ id: "preset-1" }]));
    vi.stubGlobal("window", { localStorage: { getItem } });

    expect(loadSearchPresets()).toEqual([{ id: "preset-1" }]);
    expect(getItem).toHaveBeenCalledWith(SEARCH_PRESETS_KEY);
  });

  it("不正な保存値は空配列として扱う", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => "not-json" } });

    expect(loadSearchPresets()).toEqual([]);
  });

  it("localStorageへJSONを保存してtrueを返す", () => {
    const setItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { setItem } });

    expect(saveSearchPresets([{ id: "preset-1" }])).toBe(true);
    expect(setItem).toHaveBeenCalledWith(SEARCH_PRESETS_KEY, JSON.stringify([{ id: "preset-1" }]));
  });

  it("localStorage書込が例外でもthrowせずfalseを返す", () => {
    vi.stubGlobal("window", {
      localStorage: {
        setItem: () => {
          throw new Error("quota exceeded");
        },
      },
    });

    expect(saveSearchPresets([])).toBe(false);
  });

  it("SSRでは読み書きとも空配列またはfalseを返す", () => {
    expect(loadSearchPresets()).toEqual([]);
    expect(saveSearchPresets([])).toBe(false);
  });
});
