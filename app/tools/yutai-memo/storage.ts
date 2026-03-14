// app/tools/yutai-memo/storage.ts
import type { ArchivedMemoItem, MemoItem, Tag } from "./types";
import { DEFAULT_TAGS } from "./types";

const ITEMS_KEY = "yutai_memo_items_v1";
const TAGS_KEY = "yutai_memo_tags_v1";
const ARCHIVES_KEY = "yutai_memo_archives_v1";
const MIGRATED_KEY = "yutai_memo_migrated_tags_v1";

type LegacyTagKey = "early" | "one_share" | "tenure" | "failure" | "must";
type LegacyMemoItem = Omit<MemoItem, "tagIds"> & { tags: LegacyTagKey[] };

function toJstYearMonth(d: Date): { year: number; month: number } {
  const fmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? "0");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "0");
  return { year, month };
}

function toMonthKeyFromIso(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const ym = toJstYearMonth(new Date(t));
  return `${ym.year}-${`${ym.month}`.padStart(2, "0")}`;
}

function resolveEntitlementMonthKey(months: number[], acquiredAt: string): string | null {
  if (!Array.isArray(months) || months.length === 0) return toMonthKeyFromIso(acquiredAt);
  const t = Date.parse(acquiredAt);
  if (Number.isNaN(t)) return null;
  const ym = toJstYearMonth(new Date(t));
  const normalized = Array.from(
    new Set(months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))
  ).sort((a, b) => a - b);

  if (normalized.length === 0) return toMonthKeyFromIso(acquiredAt);

  const candidate = [...normalized].reverse().find((m) => m <= ym.month);
  const targetMonth = candidate ?? normalized[normalized.length - 1];
  const targetYear = targetMonth <= ym.month ? ym.year : ym.year - 1;
  return `${targetYear}-${`${targetMonth}`.padStart(2, "0")}`;
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
