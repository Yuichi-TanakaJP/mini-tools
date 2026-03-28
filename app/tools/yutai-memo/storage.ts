// app/tools/yutai-memo/storage.ts
import type { ArchivedMemoItem, MemoItem, Tag } from "./types";
import { CROSS_TYPES, DEFAULT_TAGS } from "./types";
import { resolveEntitlementMonthKey } from "./date-utils";

const ITEMS_KEY = "yutai_memo_items_v1";
const TAGS_KEY = "yutai_memo_tags_v1";
const ARCHIVES_KEY = "yutai_memo_archives_v1";
const MIGRATED_KEY = "yutai_memo_migrated_tags_v1";

type LegacyTagKey = "early" | "one_share" | "tenure" | "failure" | "must";
type LegacyMemoItem = Omit<MemoItem, "tagIds"> & { tags: LegacyTagKey[] };

function normalizeCrossType(value: unknown): MemoItem["crossType"] {
  switch (value) {
    case "長期優遇なし":
    case "単発クロス":
    case "連続クロス":
    case "先行クロス":
    case "1株放置":
      return value;
    case "長期：設定がない":
      return "長期優遇なし";
    case "長期：単発クロス":
      return "単発クロス";
    case "連続クロス型":
    case "長期：連続クロス":
      return "連続クロス";
    case "来期必須（先行投資）型":
    case "空クロス必須型":
    case "長期：選考クロス":
      return "先行クロス";
    case "1株放置（年数稼ぎ）型":
    case "長期：1株放置中":
    case "1株放置中":
      return "1株放置";
    default:
      return "長期優遇なし";
  }
}

function loadItemMonthsById(): Map<string, number[]> {
  const map = new Map<string, number[]>();
  const raw = localStorage.getItem(ITEMS_KEY);
  if (!raw) return map;

  try {
    const parsed = JSON.parse(raw) as MemoItem[];
    if (!Array.isArray(parsed)) return map;

    for (const it of parsed) {
      if (
        it &&
        typeof it === "object" &&
        typeof (it as any).id === "string" &&
        Array.isArray((it as any).months)
      ) {
        map.set((it as any).id, (it as any).months as number[]);
      }
    }
  } catch {
    return map;
  }

  return map;
}

export function loadTags(): Tag[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TAGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Tag[];
    if (!Array.isArray(parsed)) return [];
    // 正規化：createdAt が無い古いデータを補完（読み取り時に直す）
    const normalized = parsed.map((t) =>
      t && typeof t === "object" && "id" in t && "name" in t
        ? ({ ...t, createdAt: (t as any).createdAt ?? Date.now() } as Tag)
        : t
    );
    // ついでに保存して“次回から”補完不要にする（任意）
    localStorage.setItem(TAGS_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return [];
  }
}

export function saveTags(tags: Tag[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
}

export function loadItems(): MemoItem[] {
  if (typeof window === "undefined") return [];
  migrateIfNeeded(); // ★ ここで旧データを救う
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MemoItem[];
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed.map((it) =>
      it && typeof it === "object" && "id" in it
        ? ({
            ...it,
            createdAt: (it as any).createdAt ?? it.updatedAt,
            acquired: (it as any).acquired ?? false,
            crossType: normalizeCrossType((it as any).crossType),
            oneShareStartedAt:
              typeof (it as any).oneShareStartedAt === "string"
                ? (it as any).oneShareStartedAt
                : (it as any).oneShareHold
                  ? "開始時期未設定"
                  : undefined,
          } as MemoItem)
        : it
    );
    localStorage.setItem(ITEMS_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return [];
  }
}

export function saveItems(items: MemoItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

export function loadArchivedItems(): ArchivedMemoItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ARCHIVES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ArchivedMemoItem[];
    if (!Array.isArray(parsed)) return [];
    const monthsByMemoId = loadItemMonthsById();
    const normalized = parsed
      .filter(
        (it) =>
          it &&
          typeof it === "object" &&
          typeof (it as any).id === "string" &&
          typeof (it as any).memoId === "string" &&
          typeof (it as any).name === "string" &&
          typeof (it as any).acquiredAt === "string"
      )
      .map((it) => ({
        ...it,
        entitlementMonthKey:
          typeof (it as any).entitlementMonthKey === "string"
            ? (it as any).entitlementMonthKey
            : resolveEntitlementMonthKey(
                monthsByMemoId.get((it as any).memoId) ?? [],
                (it as any).acquiredAt
              ) ?? undefined,
      }));
    localStorage.setItem(ARCHIVES_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return [];
  }
}

export function saveArchivedItems(items: ArchivedMemoItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ARCHIVES_KEY, JSON.stringify(items));
}

function migrateIfNeeded() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATED_KEY) === "1") return;

  // tags がまだ無ければ初期タグを投入
  const existingTags = loadTags();
  if (existingTags.length === 0)
    saveTags(DEFAULT_TAGS.map((t) => ({ ...t, createdAt: Date.now() })));

  // 旧 items を見て、tags フィールドなら変換して保存し直す
  const raw = localStorage.getItem(ITEMS_KEY);
  if (!raw) {
    localStorage.setItem(MIGRATED_KEY, "1");
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    localStorage.setItem(MIGRATED_KEY, "1");
    return;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    localStorage.setItem(MIGRATED_KEY, "1");
    return;
  }

  const first = parsed[0] as any;
  // 既に新形式なら何もしない
  if (Array.isArray(first.tagIds)) {
    localStorage.setItem(MIGRATED_KEY, "1");
    return;
  }

  // 旧形式（tags: LegacyTagKey[]）とみなして変換
  if (!Array.isArray(first.tags)) {
    localStorage.setItem(MIGRATED_KEY, "1");
    return;
  }

  const legacyItems = parsed as LegacyMemoItem[];

  // legacyのタグは id がそのまま使える（early, one_share, ...）
  const migrated: MemoItem[] = legacyItems.map((it) => {
    const { tags, ...rest } = it as any;
    return {
      ...rest,
      createdAt: rest.updatedAt,
      acquired: false,
      tagIds: (tags ?? []) as string[],
    };
  });

  localStorage.setItem(ITEMS_KEY, JSON.stringify(migrated));
  localStorage.setItem(MIGRATED_KEY, "1");
}
