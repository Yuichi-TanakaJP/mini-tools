# ポートフォリオ 仕様

> **実装状態:** 2026-08-15時点の画面は、最新snapshotと保存済みreviewを読むPhase 0版である。
> ポートフォリオ意思決定プラットフォームの完成品ではない。目標運用とUIの実装順序は
> [ポートフォリオ意思決定ワークスペース実装計画](../../plans/portfolio-decision-workspace-plan.md) を参照する。

## 概要

- URL: `/premium/portfolio`
- 分類: Premium / 投資管理
- 現行Phase 0の主な用途: 保有状況を「表示・記録・方針」の3つの視点で確認し、DB確認タブで読み取り結果を検証する

## 対象ユーザー

- Premium仮ログインを通過し、同じSupabaseユーザーでstock-notesを利用している本人

## 画面仕様

### 主な画面要素

- **表示**: 最新readyスナップショットの評価額・取得額・含み損益・商品別配分
- **記録**: 最新スナップショットの口座別ポジション明細、過去の取込履歴
- **方針**: 最新portfolio reviewの全体方針と銘柄別の役割・判断・買い増し条件・優先順位
- **DB確認**: MiniToolsがSupabaseから取得したportfolio、snapshot、position、review、review itemの生行数・ID・基準日を読み取り専用で確認する

### 入力

- 現段階では画面からの編集入力は持たない
- CSV取込はstock-notesの認証付きAPIを使用する
- 目標仕様でも主入力はMiniToolsのフォームではなく、ChatGPTとの相談とする
- ChatGPTが全体contextを取得し、ユーザー確認後にreview/actionを保存する経路は未実装

### 出力

- 株式・投資信託を商品単位で表示する
- 口座別の同一商品は「表示」では集約し、「記録」では分けて表示する
- 金額が未取得の場合は `—` とし、0円とは区別する

### 現段階でできないこと

- ChatGPTがportfolio全体の判断材料を一括取得する
- 全体の弱み、不足する役割、集中リスクを表示する
- 新規資金の順位、配分、待機資金、見送り理由を表示する
- snapshotとreviewの鮮度差を判定する
- 前回reviewとの差分を表示する
- 銘柄ダッシュボードとportfolio方針を往復する

### DB確認タブの位置づけ

- `/premium/portfolio` の「DB確認」は、保存結果の確認・UAT用の読み取りビューである
- DBへの保存、更新、削除は行わない
- 画面に表示する件数は、現在の取得クエリが返した生行数であり、関連行の表示用整形で除外された行も含む。DB全体の無条件スキャンではない
- 未取込・認証必須・ready snapshotなしを0件の成功状態と混同しない
- DBの正本はSupabaseであり、この画面は表示用の派生ビューである

これらは「後からあると便利」な拡張ではなく、実装計画上の完成条件である。

## データ仕様

### 取得元

- Supabaseの `stock_notes_portfolios`、`stock_notes_portfolio_snapshots`、`stock_notes_portfolio_accounts`、
  `stock_notes_portfolio_instruments`、`stock_notes_portfolio_positions`、`stock_notes_portfolio_reviews`、
  `stock_notes_portfolio_review_items`
- SupabaseログインセッションとRLSで本人の行だけを取得する
- CSV取込の正本はstock-notes側の `POST /portfolio/import`

### 保存先

- mini-toolsはポートフォリオデータを書き込まない
- 方針の主保存経路はChatGPTからstock-notes APIとする
- MiniToolsの編集UIはMVPの必須要件にしない

### fallback

- サンプルデータへのfallbackは行わない
- Supabase未設定・未ログインはログイン案内、portfolio未作成またはスナップショット未取込は未取込状態として表示する

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| Premium未認証 | `/premium/login?next=/premium/portfolio` へ遷移 |
| Supabase未設定・未ログイン | Supabaseログインが必要であることを表示 |
| portfolio未作成・CSV未取込 | サンプルを表示せず、未取込メッセージを表示 |
| readyスナップショットあり | 4タブに実データを表示 |
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
- Decision Log: [ChatGPT起点の意思決定ワークスペース](../../decision-log/2026-08-15-portfolio-chat-first-operating-model.md)
- Plan: [ポートフォリオ意思決定ワークスペース実装計画](../../plans/portfolio-decision-workspace-plan.md)
