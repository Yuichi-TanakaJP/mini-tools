# ポートフォリオ 仕様

> **実装状態:** 2026-08-23時点の画面は、最新snapshot、active policy・policy履歴、保存済みreview/recommendation/action、latest reflectionを読むUI-1〜UI-2初回版に、UI-3のreview履歴分離表示を加えたものである。reviewが参照したpolicy versionも表示する。
> ポートフォリオ意思決定プラットフォームの完成品ではない。目標運用とUIの実装順序は
> [ポートフォリオ意思決定ワークスペース実装計画](../../plans/portfolio-decision-workspace-plan.md) を参照する。

## 概要

- URL: `/premium/portfolio`
- 分類: Premium / 投資管理
- 現行の主な用途: ChatGPTで保存したポートフォリオ判断を「意思決定」画面で確認し、保有明細・履歴・DB確認を補助表示として利用する

## 対象ユーザー

- Premium仮ログインを通過し、同じSupabaseユーザーでstock-notesを利用している本人

## 画面仕様

### 主な画面要素

- **意思決定**: 判断状態、snapshot/reviewの基準日、全体要約、金額なしの補強・調査recommendation、未完了portfolio action
- **保有一覧**: 最新readyスナップショットの評価額・取得額・含み損益・商品別配分
- **口座・取込**: 最新スナップショットの口座別ポジション明細、過去の取込履歴
- **方針**: active policyの版・原則・構造化ルール・変更履歴、現行reviewの一時判断、latest reflection
- **履歴**: snapshot履歴とreview履歴。reviewは`draft` / `finalized` / `superseded`を表示し、置換済みreviewは現行判断と分けて表示する
- **DB確認**: MiniToolsがSupabaseから取得したportfolio、snapshot、position、review、review itemの生行数・ID・基準日を読み取り専用で確認する。銘柄マスタ件数は、portfolio_idを持たないユーザー単位の取得結果として表示し、readyがない場合は最新取込snapshotのポジション行も確認する

### 入力

- 現段階では画面からの編集入力は持たない
- CSV取込はstock-notesの認証付きAPIを使用する
- 目標仕様でも主入力はMiniToolsのフォームではなく、ChatGPTとの相談とする
- ChatGPTが全体contextを取得し、ユーザー確認後にreview/actionを保存する経路は未実装
- policyのdraft作成・active化、reviewのfinalize、reflectionの保存はMiniToolsから行わない。GPT/APIの責務である
- MiniToolsの画面からrecommendation/actionを編集・保存する入力は持たない。保存済みデータの正本はstock-notes API/DBである

### 出力

- 「意思決定」では、保存済みreviewの基準日・状態・要約、recommendationの対象/優先順位/条件/理由、actionの状態/実行条件を表示する
- 「意思決定」では、reviewが参照したpolicy versionを表示する。旧reviewで参照先が未保存の場合は「未紐付け（legacy review）」と表示し、active policyと混同しない
- 「方針」では、現行review（`draft`または`finalized`）だけを表示する。`superseded`しか残っていない場合は現行reviewなしとして表示し、履歴タブへ案内する
- 「履歴」では、`superseded`を含む保存済みreviewを表示する。`superseded`は「未確定のまま新しいreviewに置き換えた履歴」であり、現在の判断には使わない
- `proposed_amount` と `proposed_pct` が未設定のrecommendationは「金額未指定」「金額を仮定しない」と明示する
- 株式・投資信託を商品単位で表示する
- 口座別の同一商品は「表示」では集約し、「記録」では分けて表示する
- 金額が未取得の場合は `—` とし、0円とは区別する

### 現段階でできないこと

- MiniToolsからChatGPTの相談・保存を開始する
- MiniToolsからrecommendation/actionを作成・更新・完了する
- stock-notesのdecision-context全体をMiniTools専用の共通読み取り契約として集約する（現時点はSupabaseの本人行を読み取る暫定実装）
- 金額指定を含む新規資金の順位・配分を表示する（現在は金額なし候補の表示のみ）
- 前回reviewとの差分を表示する
- 銘柄ダッシュボードとportfolio方針を往復する

### DB確認タブの位置づけ

- `/premium/portfolio` の「DB確認」は、保存結果の確認・UAT用の読み取りビューである
- DBへの保存、更新、削除は行わない
- 画面に表示する件数は、現在の取得クエリが返した生行数であり、関連行の表示用整形で除外された行も含む。銘柄マスタはスキーマ上portfolio_idを持たないためユーザー単位、それ以外は現在のportfolio・snapshot・reviewに紐づく取得範囲である。DB全体の無条件スキャンではない
- 未取込・認証必須・ready snapshotなしを0件の成功状態と混同しない
- DBの正本はSupabaseであり、この画面は表示用の派生ビューである
- recommendation/actionの取得も本人のSupabase行だけを対象とし、取得失敗を「0件」として扱わない

これらは「後からあると便利」な拡張ではなく、実装計画上の完成条件である。

## データ仕様

### 取得元

- Supabaseの `stock_notes_portfolios`、`stock_notes_portfolio_snapshots`、`stock_notes_portfolio_accounts`、
  `stock_notes_portfolio_instruments`、`stock_notes_portfolio_positions`、`stock_notes_portfolio_reviews`、
  `stock_notes_portfolio_review_items`、`stock_notes_portfolio_recommendations`、`stock_notes_portfolio_actions`、
  `stock_notes_portfolio_policy_versions`、`stock_notes_portfolio_policy_rules`、`stock_notes_portfolio_reflections`
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
| readyスナップショットあり | 5タブに実データを表示 |
| Supabase取得失敗 | Server Componentの取得エラーとして既存のNext.jsエラー処理に委ねる |

## premium / 権限制御

- Premium Cookie認証を必須とする
- 実データはSupabase Authユーザーが存在する場合だけ取得する

## 関連実装

- [portfolio page](/c:/Users/yutaz/dev/mini-tools/app/premium/portfolio/page.tsx)
- [portfolio data loader](/c:/Users/yutaz/dev/mini-tools/app/premium/portfolio/data.ts)
- [portfolio types](/c:/Users/yutaz/dev/mini-tools/app/premium/portfolio/types.ts)
- [portfolio workspace](/c:/Users/yutaz/dev/mini-tools/app/premium/portfolio/PortfolioWorkspace.tsx)
- [portfolio decision view](/c:/Users/yutaz/dev/mini-tools/app/premium/portfolio/PortfolioDecision.tsx)

## 関連 docs

- UAT: [ポートフォリオ UAT](../../uat/portfolio.md)
- Decision Log: [ポートフォリオの「表示・記録・方針」構成](../../decision-log/2026-08-14-portfolio-record-display-policy.md)
- Decision Log: [ChatGPT起点の意思決定ワークスペース](../../decision-log/2026-08-15-portfolio-chat-first-operating-model.md)
- Decision Log: [ポートフォリオのWhatとpolicy/reflection表示](../../decision-log/2026-08-22-portfolio-what-and-policy-reflection-display.md)
- Plan: [ポートフォリオ意思決定ワークスペース実装計画](../../plans/portfolio-decision-workspace-plan.md)
