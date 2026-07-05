# 優待ダッシュボード 仕様

## 概要

- URL: `/tools/yutai-dashboard`
- 分類: market データ + LocalStorage 併用ツール（PC 向け）
- 主な用途: 月次優待候補の発掘（ピック / パス / 優待メモ追加）と、登録済み銘柄の運用管理（日興/SBI・仕込み時期・クロス戦略・取得実績の確認）を 1 つのテーブルで行う

## 対象ユーザー

- 優待クロスの月次ピック作業と運用管理を PC の広い画面でまとめて行いたいユーザー
- `yutai-candidates`（スマホ向けカード UI）と同じ選択状態を PC のテーブルで扱いたいユーザー

## 画面仕様

### 主な画面要素

- フィルタバー: 対象月（「全月」を含む）、表示軸（権利月 / 仕込み月）、状態、日興クロス、SBI、クロス戦略、並び順、テキスト検索
- 対象月「全月」（`?month=all`）は manifest の全月データを結合して表示する。同じ権利月が複数年分ある場合は最新年のデータだけを使う（12ヶ月カレンダー想定）。SBI は当月在庫（latest）を使い、権利付き最終日は表示しない。仕込み月軸では「仕込み時期を設定した銘柄すべて」が対象になる
- 一覧テーブル: コード / 銘柄 / 権利月 / 日興 / SBI / 仕込み開始 / 1株開始 / クロス戦略 / 実績 / 操作
- 行クリックで開く詳細サイドパネル: 優待内容、リンク、日興規制明細、優待メモ全項目、クロス購入実績履歴
- 行内操作: ピック（★）/ パス（✕）/ 優待メモへ追加（＋メモ）

### 行の表示ルール

| 行の種類 | 表示 |
|---|---|
| メモ登録済み | 緑系の行。仕込み・1株・戦略・実績列を表示し、操作は「追加済」badge |
| ピック済み（未登録） | 琥珀系の行。メモ系列は `-` |
| パス済み | 灰色・低透過の行 |
| 未選択 | 白行。ピック / パス / 追加操作を表示 |

- 同一銘柄が別権利月でメモ登録済みの場合も、戦略・1株開始などは銘柄単位の情報として表示する。「追加済」判定は `コード:権利月` 単位。
- 仕込み月軸は、優待メモに登録され構造化した仕込み時期（`preparationMonthsBefore`）が設定された銘柄だけを対象にする（[2026-07-03 決定](../../decision-log/2026-07-03-yutai-preparation-month-axis.md)）。

### 入力

- ピック / パス の切替（排他）
- 優待メモへの追加（`yutai-candidates` と同じ `candidate-import` を使用）
- 各種フィルタ・検索・並び順・対象月

### 出力

- 候補と登録メモを結合した一覧テーブル
- 日興バッジ（一般可 / 一般注意 / 一般停止 / 一般× / 制度可）と SBI バッジ（SBI売可）
- 詳細パネルでの規制明細・実績履歴（年月別）・関連リンク表示
- メモ編集は Phase 1 では行わず、優待メモ帳へのリンクで誘導する

## データ仕様

### 取得元

- 月次候補 / 日興信用 / SBI 信用: `yutai-candidates/data-loader.ts` の `loadMonthlyYutaiPageData()` を共用（SSR、`MARKET_INFO_API_BASE_URL`）
- 優待メモ / 取得実績: `yutai-memo/storage.ts`（LocalStorage、マウント後に読む）
- ピック / パス / カードメモ: `_shared/yutai-selection.ts`（`yutai-candidates` と同一キーを共有）

### 保存先

- ピック / パス: LocalStorage（`monthly_yutai_picks_v1` / `monthly_yutai_passes_v1`）
- 優待メモ追加: LocalStorage（`yutai_memo_items_v1`）

### fallback

- market データの fallback は [Market Tools データ取得経路一覧](../cross-cutting/market-tools-data-fetch-paths.md) に従う（production では repo 同梱 JSON を自動表示しない）
- LocalStorage が空でもページはクラッシュさせず、未登録状態として表示する

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| 初回表示 | SSR で候補一覧を出し、LocalStorage 系はマウント後に反映（読み込み中はテーブルに「読み込み中…」） |
| API 未接続 | 「データ未接続」表示。候補 0 件として扱う |
| 該当なし | 「条件に一致する銘柄がありません」 |
| 仕込み月軸で対象なし | 「この月に仕込みを開始する登録銘柄はありません」 |

## premium / 権限制御

- premium 制限なし
- ログイン不要で利用できる

## 関連実装

- [app/tools/yutai-dashboard/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-dashboard/page.tsx)
- [app/tools/yutai-dashboard/ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-dashboard/ToolClient.tsx)
- [app/tools/_shared/yutai-credit.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/_shared/yutai-credit.ts)
- [app/tools/_shared/yutai-selection.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/_shared/yutai-selection.ts)
- [app/tools/yutai-candidates/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-candidates/data-loader.ts)

## 関連 docs

- UAT: [優待ダッシュボード UAT](../../uat/yutai-dashboard.md)
- Plan: [優待統合ダッシュボード（PC）実装計画](../../plans/yutai-dashboard-plan.md)
- Decision Log:
  - [2026-07-05 優待統合ダッシュボードの位置づけ](../../decision-log/2026-07-05-yutai-dashboard-positioning.md)
  - [2026-07-03 優待の仕込み月表示軸](../../decision-log/2026-07-03-yutai-preparation-month-axis.md)
  - [2026-04-05 yutai-candidates の SBI 短期対象表示ルール](../../decision-log/2026-04-05-yutai-candidates-sbi-short-handling.md)
