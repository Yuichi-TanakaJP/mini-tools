// lib/tools-catalog.ts
// ツール定義の正本。ホームのグリッドとナビドロワーが同じ定義を参照する。
// ツールを追加・変更するときはここを編集する。

export type ToolCategory = "input" | "yutai" | "market" | "fun";

export type ToolItem = {
  title: string;
  short: string;
  detail: string;
  href: string;
  icon: string;
  category: ToolCategory;
  disabled?: boolean;
  statusLabel?: string;
};

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  input: "入力ツール",
  yutai: "優待・保有",
  market: "市場データ",
  fun: "おまけ",
};

// ドロワーやグループ表示でのカテゴリ並び順
export const CATEGORY_ORDER: ToolCategory[] = ["input", "yutai", "market", "fun"];

export const TOOLS: ToolItem[] = [
  {
    title: "マイ銘柄リスト",
    short: "保有・ウォッチを端末内に保存",
    detail: "保有銘柄と気になる銘柄を端末内に保存。決算予定日・優待権利月のバッジ付き。サーバー送信なし。",
    href: "/tools/my-stocks",
    icon: "⭐",
    category: "yutai",
  },
  {
    title: "株主優待期限帳",
    short: "優待の期限を管理",
    detail: "受け取った優待の使用期限を管理。期限切れを防ぐ、使い忘れゼロへ。",
    href: "/tools/yutai-expiry",
    icon: "🎁",
    category: "yutai",
  },
  {
    title: "優待銘柄メモ帳",
    short: "早取り/長期1株/任期注意を保存",
    detail: "早取り・長期1株・任期注意・失敗ログを銘柄ごとに保存。端末内に保存。",
    href: "/tools/yutai-memo",
    icon: "📝",
    category: "yutai",
  },
  {
    title: "開示イベントレーダー",
    short: "優待変更とマイ銘柄の重要開示",
    detail: "全銘柄の優待変更と、マイ銘柄の配当・業績修正・自社株買いなどをまとめて確認。",
    href: "/tools/disclosure-radar",
    icon: "📡",
    category: "market",
  },
  {
    title: "優待カレンダー",
    short: "月別の候補を探す",
    detail: "権利確定月ごとに優待銘柄を一覧で確認。気になる銘柄をピックして優待メモへ追加できます。",
    href: "/tools/yutai-candidates",
    icon: "🔎",
    category: "yutai",
  },
  {
    title: "決算カレンダー",
    short: "国内 / 海外の決算予定を確認",
    detail: "国内株と海外株の決算予定をカレンダーで確認。日付ごとに銘柄と決算種別を一覧表示。",
    href: "/tools/earnings-calendar",
    icon: "🗓️",
    category: "market",
  },
  {
    title: "経済指標カレンダー",
    short: "今週の重要指標を一覧で確認",
    detail: "米国・日本・欧州など主要国の経済指標を重要度・国別に絞り込み。前回・予想・結果をまとめて確認できます。",
    href: "/tools/econ-calendar",
    icon: "📅",
    category: "market",
  },
  {
    title: "市場ランキング",
    short: "時価総額 / 配当利回りを月次で確認",
    detail: "プライム・スタンダード・グロース市場ごとに、時価総額ランキングと配当利回りランキングを月別で確認。",
    href: "/tools/market-rankings",
    icon: "🏦",
    category: "market",
  },
  {
    title: "投資主体別売買動向",
    short: "海外投資家・個人の売買を確認",
    detail: "JPX公式データ由来の週次売買動向を、投資主体別の買い越し・売り越しで確認。",
    href: "/tools/investor-flow",
    icon: "💹",
    category: "market",
  },
  {
    title: "株価ランキング",
    short: "値上がり・値下がり・売買高",
    detail: "プライム・スタンダード・グロース市場の値上がり率・値下がり率・売買高ランキングをデイリーで確認。",
    href: "/tools/stock-ranking",
    icon: "📊",
    category: "market",
  },
  {
    title: "米国株ランキング",
    short: "値上がり・値下がり・売買代金",
    detail: "米国株の値上がり率・値下がり率・売買代金ランキングをデイリーで確認。",
    href: "/tools/us-stock-ranking",
    icon: "🇺🇸",
    category: "market",
  },
  {
    title: "日経225寄与度",
    short: "誰が指数を動かしたか",
    detail: "日経225の上昇・下落寄与、影響度マップ、全銘柄一覧を日付ごとに確認。",
    href: "/tools/nikkei-contribution",
    icon: "🗺️",
    category: "market",
  },
  {
    title: "TOPIX33業種",
    short: "どの業種が上げ下げを主導したか",
    detail: "TOPIX33業種の騰落率を日付ごとに確認。上昇・下落ランキングと全33業種一覧をまとめて見られます。",
    href: "/tools/topix33",
    icon: "📈",
    category: "market",
  },
  {
    title: "EDINET書類一覧",
    short: "有報・大量保有報告書をまとめて確認",
    detail: "金融庁EDINETに提出された有価証券報告書・大量保有報告書などを日次で一覧表示。上場企業フィルター・書類種別絞込み対応。",
    href: "/tools/edinet-documents",
    icon: "📄",
    category: "market",
  },
  {
    title: "TDNET適時開示一覧",
    short: "適時開示を日付ごとに確認",
    detail: "TDNETの全適時開示を一覧表示。銘柄コード・会社名・タイトル検索、財務関連・決算短信・訂正除外の絞り込みに対応。",
    href: "/tools/tdnet-disclosures",
    icon: "📢",
    category: "market",
  },
  {
    title: "ペンギン・エイリアンシューター",
    short: "絵文字で遊ぶミニゲーム",
    detail: "宇宙船に乗ったペンギンを操縦して、エイリアンをショット。絵文字ベースで気軽に遊べるおまけゲーム。",
    href: "/tools/penguin-rabbit-shooter",
    icon: "🐧",
    category: "fun",
  },
  {
    title: "ペンギンシューター",
    short: "Shoot救出ミッション",
    detail: "宇宙船Shutyに乗ったPenを操作して、捕まったShootを助ける新作ミニシューティング。",
    href: "/tools/penguin-shooter",
    icon: "🚀",
    category: "fun",
  },
  {
    title: "合計計算",
    short: "数字を貼るだけ",
    detail: "1行ごとに入力 → 合計。カンマ・円記号・マイナスもOK。入力は端末内保存。",
    href: "/tools/total",
    icon: "🧮",
    category: "input",
  },
  {
    title: "文字数カウント",
    short: "文章を貼るだけ",
    detail: "X投稿の下書きを貼って文字数を確認。URL・絵文字も正確に推定。140字残りも表示。",
    href: "/tools/charcount",
    icon: "🔤",
    category: "input",
  },
];

// カテゴリごとにツールをまとめて返す（CATEGORY_ORDER の順、空カテゴリは除外）
export function groupToolsByCategory(): { category: ToolCategory; tools: ToolItem[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    tools: TOOLS.filter((tool) => tool.category === category),
  })).filter((group) => group.tools.length > 0);
}
