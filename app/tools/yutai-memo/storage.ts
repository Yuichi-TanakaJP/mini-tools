// app/tools/yutai-memo/storage.ts
import type { MemoItem, Tag } from "./types";
import { DEFAULT_TAGS } from "./types";

const ITEMS_KEY = "yutai_memo_items_v1";
const TAGS_KEY = "yutai_memo_tags_v1";
const MIGRATED_KEY = "yutai_memo_migrated_tags_v1";

type LegacyTagKey = "early" | "one_share" | "tenure" | "failure" | "must";
type LegacyMemoItem = Omit<MemoItem, "tagIds"> & { tags: LegacyTagKey[] };

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
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveItems(items: MemoItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
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
      tagIds: (tags ?? []) as string[],
    };
  });

  localStorage.setItem(ITEMS_KEY, JSON.stringify(migrated));
  localStorage.setItem(MIGRATED_KEY, "1");
}
