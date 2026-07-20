# 優待ダッシュボード 仕様

## 概要

- URL: `/tools/yutai-dashboard`
- 分類: market データ + LocalStorage 併用ツール（PC 向け）
- 主な用途: 月次優待候補の発掘（ピック / パス / 優待メモ追加）と、登録済み銘柄の運用管理（日興/SBI・仕込み時期・クロス戦略・取得実績・簡易優待効率の確認）を 1 つのテーブルで行う

## 対象ユーザー

- 優待クロスの月次ピック作業と運用管理を PC の広い画面でまとめて行いたいユーザー
- `yutai-candidates`（スマホ向けカード UI）と同じ選択状態を PC のテーブルで扱いたいユーザー

## 画面仕様

### 主な画面要素

- ビュー切替タブ: 「テーブル」/「12ヶ月ビュー」
- フィルタバー: 対象月（「全月」を含む）、表示軸（権利月 / 仕込み月）、状態、日興クロス、SBI、クロス戦略、並び順、テキスト検索
- 12ヶ月ビュー: 登録済みメモを対象にした 銘柄 × 12 ヶ月のガント風グリッド。仕込み開始（仕）〜権利月（権）を帯で表示し、取得済み権利月に ✓を付ける。帯は年をまたいで循環。検索・クロス戦略フィルタが効く。日興 / SBI などの当日変動値は載せない
  - **年度セレクタ**（既定=今年 JST）を持つ。権利月・仕込みは年度非依存（毎年共通）、取得・1株保有は選択年度で解釈する（詳細は [2026-07-12 12ヶ月ビューの年度軸](../../decision-log/2026-07-12-yutai-dashboard-calendar-year-axis.md)）
  - 各セルは上下2レーン構成。上レーンが優待クロスのサイクル（帯 / 仕 / 権 / ✓）、下レーンが1株保有ストリップ
  - **取得済み**: 選択年度に取得した権利月は緑✓、選択年度以外に取得実績がある月は灰✓（過去取得）。ツールチップに取得年を列挙。緑✓は取得履歴に加えて、まだアーカイブされていない現在の `acquired` フラグからも導出する。取得実績の年度は取得日から逆算され、仕込み開始〜権利月のリード期間中に取得した場合は当年の権利月に寄せる（[2026-07-12 取得実績のひもづけ](../../decision-log/2026-07-12-yutai-entitlement-attribution-lead-time.md)）
  - **1株保有**: 選択年度で解釈する。選択年度 > 開始年=通年、= 開始年=開始月〜12月（開始月マーカー）、< 開始年=非保有。開始が YYYY-MM で判定できないフリーテキストは年不明として通年扱い。銘柄名の下に「1株 YYYY-MM〜（N年目）」を表示する
  - **仕込み実績**: 取得（＝仕込み）データから、実際に仕込んだ月へ計画の帯/仕とは別のフクシア●を導出する。取得履歴は `acquiredAt` の月、まだアーカイブされていない現在の取得済みは `acquiredMarkedAt` の月に表示する。手動クリック記録と独立 LocalStorage（`yutai_dashboard_prep_log_v1`）は廃止する（[2026-07-12 取得＝仕込みの一本化](../../decision-log/2026-07-12-yutai-acquisition-equals-prep-lifecycle.md)）。断念記録（取引停止・残数なし）は別途仕様化予定
  - **現在月マーカー**: 選択年度が今年のとき、現在月（JST）の列を淡くハイライトする
  - 重なりの表示: 権利月は取得の有無に関わらず常に「権」で示し、取得済みは主バッジ右上の✓、権利月と仕込み開始が同月に重なる場合は左上の橙ドットで重ねて示す
  - 各行（テーブル）の権利月は、その候補自身の権利月を表示する。同一銘柄が複数の権利月を持つ場合は権利月ごとに別行になる
- 対象月「全月」（`?month=all`）は manifest の全月データを結合して表示する。同じ権利月が複数年分ある場合は最新年のデータだけを使う（12ヶ月カレンダー想定）。SBI は当月在庫（latest）を使い、権利付き最終日は表示しない。仕込み月軸では「仕込み時期を設定した銘柄すべて」が対象になる
- 一覧テーブル: コード / 銘柄 / 権利月 / 簡易効率 / 日興 / SBI / 仕込み開始 / 1株開始 / クロス戦略 / 実績 / 操作
- 行クリックで開く詳細サイドパネル: 優待内容、簡易優待効率の入力・計算、リンク、日興規制明細、優待メモ全項目、クロス購入実績履歴
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
- 権利月軸の候補行ごとに、必要株数と優待価値（円）を正の整数で入力する。値は コード:権利月 単位で保存し、空欄に戻すと未設定にする
- 優待メモへの追加（`yutai-candidates` と同じ `candidate-import` を使用）
- 詳細パネルからの優待メモ編集（銘柄名・クロス戦略・仕込み開始・早打ち目安・1株保有開始・任期条件・関連リンク・優先度・取得済み・メモ本文）
- 詳細パネルからの優待メモ解除（誤って追加した場合の取り消し）。候補行はその権利月だけを外し、権利月が無くなればメモごと削除する
- 表のセルからの直接編集: クロス戦略・仕込み開始・1株保有開始をセルをクリックしてその場で変更・保存できる。未登録の候補行でも編集でき、確定時に自動で優待メモへ追加する（先に「＋メモ」を押す必要はない）
  - 銘柄単位の値（クロス戦略・1株保有開始など）は、別権利月で登録済みならその値を表示する。まだメモがない銘柄のみ「未設定」「未購入」と表示する
  - 未登録の権利月を編集して確定すると、同じ銘柄に既存メモがあればその権利月に統合し、なければ新規メモを作る（銘柄単位の値を失わない）
  - 未設定時の表示は 仕込み開始「未設定」・1株保有開始「未購入」・クロス戦略「未設定」
  - 1株保有開始は、クリック位置に浮かぶ軽量な月ピッカー（年送り＋12ヶ月グリッド、「未購入に戻す」付き）で選ぶ。セルは押し広がらず、ネイティブ日付ピッカーは使わない。仕込み開始・クロス戦略はドロップダウン
- 各種フィルタ・検索・並び順・対象月

### 出力

- 候補と登録メモを結合した一覧テーブル
- 必要株数・優待価値・最低投資金額が揃った行は簡易優待効率を表示し、「簡易優待効率が高い順」で計算可能な行を降順、計算不能な行を末尾に並べる
- 日興バッジ（一般可 / 一般注意 / 一般停止 / 一般× / 制度可）と SBI バッジ（SBI売可）
- 詳細パネルでの規制明細・実績履歴（年月別）・関連リンク表示
- 詳細パネルの「編集」で優待メモをその場で更新できる（保存は `_shared/yutai-memo-edit` の純関数経由で LocalStorage へ）。優待メモ帳・優待カレンダーと同じ `yutai_memo_items_v1` を更新するため他画面にも反映される

## データ仕様

### 取得元

- 月次候補 / 日興信用 / SBI 信用: `yutai-candidates/data-loader.ts` の `loadMonthlyYutaiPageData()` を共用（SSR、`MARKET_INFO_API_BASE_URL`）
- 優待メモ / 取得実績: `yutai-memo/storage.ts`（LocalStorage、マウント後に読む）
- ピック / パス / カードメモ: `_shared/yutai-selection.ts`（`yutai-candidates` と同一キーを共有）

- 簡易効率の最低投資金額: 月次候補の minimum_investment_yen（みんかぶ由来の取得済みデータ）。必要株数・優待価値はユーザー入力であり、この段階では OCR や追加スクレイピングを行わない

### 保存先

- 必要株数 / 優待価値: 既存の月別カードメモ LocalStorage（monthly_yutai_card_memos_v1）へ任意項目 requiredShares / benefitValueYen として保存する。新しい保存キーは増やさず、既存データと後方互換にする

- ピック / パス: LocalStorage（`monthly_yutai_picks_v1` / `monthly_yutai_passes_v1`）
- 優待メモ追加: LocalStorage（`yutai_memo_items_v1`）

### 簡易優待効率

- 計算株価 = Premium認証付き`/api/yutai/stock-prices`の実株価。対象銘柄の取得失敗・API失敗時は、最低投資金額 ÷ 100 の概算株価へフォールバックする
- 必要資金 = 計算株価 × 必要株数
- 簡易優待効率（%） = 優待価値 ÷ 必要資金 × 100
- ヘッダーに株価データの取得件数・生成時刻、詳細に株価/概算株価の区別と実株価の基準日を表示する
- 株価APIはブラウザーから同一originの認証proxyだけを呼び、`no-store`かつPWA `NetworkOnly`とする。JSONをLocalStorageへ保存しない
- 手数料・配当・株価変動・長期保有条件は未反映
- 計算は _shared/yutai-efficiency.ts の純関数で行い、不足値・0以下・必要株数または優待価値が整数でない場合は計算不能とする
- 仕込み月軸のメモ行は複数権利月を持ち得るため入力対象外とし、権利月軸の月別候補行から入力する

### fallback

- market データの fallback は [Market Tools データ取得経路一覧](../cross-cutting/market-tools-data-fetch-paths.md) に従う（production では repo 同梱 JSON を自動表示しない）
- LocalStorage が空でもページはクラッシュさせず、未登録状態として表示する

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| 初回表示 | SSR で候補一覧を出し、LocalStorage 系はマウント後に反映（読み込み中はテーブルに「読み込み中…」） |
| API 未接続 | 「データ未接続」表示。候補 0 件として扱う |
| 株価読み込み中 | ヘッダーに「株価: 読み込み中」。候補一覧は表示し、概算できる行は概算値を使う |
| 株価API失敗 / 個別株価なし | ヘッダーに失敗状態を表示し、最低投資金額がある行だけ概算株価へフォールバックする |
| 該当なし | 「条件に一致する銘柄がありません」 |
| 仕込み月軸で対象なし | 「この月に仕込みを開始する登録銘柄はありません」 |

## premium / 権限制御

- premium ログイン必須
- 未ログインまたはセッション期限切れの場合は、データ取得前に `/premium/login` へ移動する
- ログイン後は `/tools/yutai-dashboard` へ戻る。遷移前の `?month=` がある場合は月指定も維持する
- premium セッションはログインから30日間有効
- ダッシュボードのHTML/RSCはPWAランタイムキャッシュへ保存せず、常にネットワーク経由で認証を通す
- 検索エンジンには掲載しない（`noindex, nofollow`）

## 関連実装

- [app/tools/yutai-dashboard/page.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-dashboard/page.tsx)
- [app/tools/yutai-dashboard/ToolClient.tsx](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-dashboard/ToolClient.tsx)
- [app/tools/_shared/yutai-credit.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/_shared/yutai-credit.ts)
- [app/tools/_shared/yutai-selection.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/_shared/yutai-selection.ts)
- [app/tools/_shared/yutai-efficiency.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/_shared/yutai-efficiency.ts)
- [app/tools/_shared/yutai-memo-edit.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/_shared/yutai-memo-edit.ts)
- [app/tools/yutai-candidates/data-loader.ts](/c:/Users/yutaz/dev/mini-tools/app/tools/yutai-candidates/data-loader.ts)

## 関連 docs

- UAT: [優待ダッシュボード UAT](../../uat/yutai-dashboard.md)
- Plan: [優待統合ダッシュボード（PC）実装計画](../../plans/yutai-dashboard-plan.md)
- Decision Log:
  - [2026-07-18 簡易優待効率MVP](../../decision-log/2026-07-18-yutai-dashboard-simple-efficiency.md)
  - [2026-07-20 優待効率へのPrivate実株価適用](../../decision-log/2026-07-20-yutai-dashboard-live-stock-price-efficiency.md)
  - [2026-07-19 優待ダッシュボードのpremium認証](../../decision-log/2026-07-19-yutai-dashboard-premium-auth.md)
  - [2026-07-12 12ヶ月ビューの年度軸](../../decision-log/2026-07-12-yutai-dashboard-calendar-year-axis.md)
  - [2026-07-12 取得＝仕込みの一本化と権利年ライフサイクル](../../decision-log/2026-07-12-yutai-acquisition-equals-prep-lifecycle.md)
  - [2026-07-05 優待統合ダッシュボードの位置づけ](../../decision-log/2026-07-05-yutai-dashboard-positioning.md)
  - [2026-07-03 優待の仕込み月表示軸](../../decision-log/2026-07-03-yutai-preparation-month-axis.md)
  - [2026-04-05 yutai-candidates の SBI 短期対象表示ルール](../../decision-log/2026-04-05-yutai-candidates-sbi-short-handling.md)
