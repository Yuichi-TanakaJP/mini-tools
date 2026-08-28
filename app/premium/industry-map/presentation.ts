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
    question: "保有銘柄とテーマがどこを押さえ、どこが空白か。",
  },
  {
    mode: "table",
    icon: "☰",
    label: "表",
    question: "個々の定義を正確に確認する。検索と並べ替えができます。",
  },
];
