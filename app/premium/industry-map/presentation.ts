import type {
  Confidence,
  ControlType,
  RelationType,
  StrategicRole,
  TaxonomyKind,
  ThemeRelationType,
  ViewMode,
} from "./types";

/** 表示ラベルと配色。DB の値をそのまま出さず、日本語ラベルへ寄せる。 */

export const KIND_LABEL: Record<TaxonomyKind, string> = {
  classification: "分類",
  product_segment: "製品・事業",
  technology: "技術",
};

export const KIND_COLOR: Record<TaxonomyKind, string> = {
  classification: "var(--kind-classification)",
  product_segment: "var(--kind-product)",
  technology: "var(--kind-technology)",
};

export const RELATION_LABEL: Record<RelationType, string> = {
  contains: "含む",
  part_of: "の一部",
  depends_on: "依存する",
  enables: "可能にする",
  used_for: "用いられる",
  related_to: "関連",
};

export const RELATION_COLOR: Record<RelationType, string> = {
  contains: "var(--rel-hierarchy)",
  part_of: "var(--rel-hierarchy)",
  depends_on: "var(--rel-depends)",
  enables: "var(--rel-enables)",
  used_for: "var(--rel-used)",
  related_to: "var(--rel-related)",
};

export const ROLE_LABEL: Record<StrategicRole, string> = {
  core: "中核",
  growth: "成長",
  supporting: "補完",
  experimental: "実験",
  adjacent: "隣接",
};

/** 役割の色。順序尺度ではないので、濃淡ではなく色相で区別する。 */
export const ROLE_COLOR: Record<StrategicRole, string> = {
  core: "#1d44d8",
  growth: "#0d9488",
  supporting: "#64748b",
  experimental: "#7c3aed",
  adjacent: "#d97706",
};

export const CONTROL_LABEL: Record<ControlType, string> = {
  owned: "自社保有",
  controlled: "支配",
  partnered: "提携",
  integrated: "統合",
  used: "利用",
  unknown: "不明",
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "確度高",
  medium: "確度中",
  low: "確度低",
};

/**
 * 上場区分と国。Supabase 側で値が増えうるので、既知の値だけラベルにして
 * それ以外は元の値をそのまま出す（勝手に「不明」へ丸めない）。
 */
const LISTING_LABEL: Record<string, string> = {
  domestic_listed: "国内上場",
  foreign_listed: "海外上場",
  unlisted: "非上場",
  unknown: "上場区分未確認",
};

export function listingLabel(value: string): string {
  return LISTING_LABEL[value] ?? value;
}

/** 上場が確認できている企業かどうか。銘柄コードの有無と合わせて表示に使う。 */
export function isListed(value: string): boolean {
  return value === "domestic_listed" || value === "foreign_listed";
}

const COMPANY_STATUS_LABEL: Record<string, string> = {
  draft: "下書き",
  active: "確定",
  archived: "アーカイブ",
};

export function companyStatusLabel(value: string): string {
  return COMPANY_STATUS_LABEL[value] ?? value;
}

/**
 * 基準日。Supabase の `as_of` は日付のこともタイムスタンプのこともあるため、
 * 先頭の日付部分だけを出す。解釈できない値はそのまま返す（勝手に捨てない）。
 */
export function formatAsOf(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : value;
}

export const THEME_RELATION_LABEL: Record<ThemeRelationType, string> = {
  scope: "対象範囲",
  focus: "注目点",
  beneficiary_area: "受益領域",
  risk_area: "リスク領域",
  monitoring_axis: "監視軸",
  related: "関連",
};

export const THEME_RELATION_COLOR: Record<ThemeRelationType, string> = {
  scope: "#1d44d8",
  focus: "#0d9488",
  beneficiary_area: "#16a34a",
  risk_area: "#dc2626",
  monitoring_axis: "#7c3aed",
  related: "#64748b",
};

export type ViewDefinition = {
  mode: ViewMode;
  icon: string;
  label: string;
  /** そのビューが答える問い。ツールバー下のヒントに出す。 */
  question: string;
};

export const VIEWS: readonly ViewDefinition[] = [
  {
    mode: "tree",
    icon: "🗂",
    label: "階層",
    question: "この業界はどう分解されるか。折りたたんで構造をたどれます。",
  },
  {
    mode: "radial",
    icon: "🌐",
    label: "放射",
    question:
      "全体がどんな形か。中心から外側へ階層が一望できます。ドラッグで移動、Ctrl+ホイールかピンチ、＋−ボタンで拡大縮小できます。",
  },
  {
    mode: "network",
    icon: "🕸",
    label: "関係",
    question:
      "階層をまたぐ依存は何か。6種の関係をすべて線で描きます。ドラッグで移動、Ctrl+ホイールかピンチ、＋−ボタンで拡大縮小できます。",
  },
  {
    mode: "matrix",
    icon: "▦",
    label: "マトリクス",
    question: "企業（非上場・海外を含む）とテーマがどこを押さえ、どこが空白か。",
  },
  {
    mode: "table",
    icon: "☰",
    label: "表",
    question: "個々の定義を正確に確認する。検索と並べ替えができます。",
  },
];
