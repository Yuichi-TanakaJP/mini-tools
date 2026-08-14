# ポートフォリオ 仕様

## 概要

- URL: `/premium/portfolio`
- 分類: Premium / 投資管理
- 主な用途: 保有状況を「表示・記録・方針」の3つの視点で確認する

## 対象ユーザー

- Premium仮ログインを通過し、同じSupabaseユーザーでstock-notesを利用している本人

## 画面仕様

### 主な画面要素

- **表示**: 最新readyスナップショットの評価額・取得額・含み損益・商品別配分
- **記録**: 最新スナップショットの口座別ポジション明細、過去の取込履歴
- **方針**: 最新portfolio reviewの全体方針と銘柄別の役割・判断・買い増し条件・優先順位

### 入力

- 現段階では画面からの編集入力は持たない。CSV取込はstock-notesの認証付きAPIを使用する

### 出力

- 株式・投資信託を商品単位で表示する
- 口座別の同一商品は「表示」では集約し、「記録」では分けて表示する
- 金額が未取得の場合は `—` とし、0円とは区別する

## データ仕様

### 取得元

- Supabaseの `stock_notes_portfolios`、`stock_notes_portfolio_snapshots`、`stock_notes_portfolio_accounts`、
  `stock_notes_portfolio_instruments`、`stock_notes_portfolio_positions`、`stock_notes_portfolio_reviews`、
  `stock_notes_portfolio_review_items`
- SupabaseログインセッションとRLSで本人の行だけを取得する
- CSV取込の正本はstock-notes側の `POST /portfolio/import`

### 保存先

- mini-toolsはポートフォリオデータを書き込まない
- 方針を保存するAPI・編集UIは後続段階で追加する

### fallback

- サンプルデータへのfallbackは行わない
- Supabase未設定・未ログインはログイン案内、portfolio未作成またはスナップショット未取込は未取込状態として表示する

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| Premium未認証 | `/premium/login?next=/premium/portfolio` へ遷移 |
| Supabase未設定・未ログイン | Supabaseログインが必要であることを表示 |
| portfolio未作成・CSV未取込 | サンプルを表示せず、未取込メッセージを表示 |
| readyスナップショットあり | 3タブに実データを表示 |
| Supabase取得失敗 | Server Componentの取得エラーとして既存のNext.jsエラー処理に委ねる |

## premium / 権限制御

- Premium Cookie認証を必須とする
- 実データはSupabase Authユーザーが存在する場合だけ取得する

## 関連実装

- [portfolio page](/c:/Users/yutaz/dev/mini-tools/app/premium/portfolio/page.tsx)
- [portfolio data loader](/c:/Users/yutaz/dev/mini-tools/app/premium/portfolio/data.ts)
- [portfolio types](/c:/Users/yutaz/dev/mini-tools/app/premium/portfolio/types.ts)
- [portfolio workspace](/c:/Users/yutaz/dev/mini-tools/app/premium/portfolio/PortfolioWorkspace.tsx)

## 関連 docs

- UAT: [ポートフォリオ UAT](../../uat/portfolio.md)
- Decision Log: [ポートフォリオの「表示・記録・方針」構成](../../decision-log/2026-08-14-portfolio-record-display-policy.md)
