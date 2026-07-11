# 優待統合ダッシュボード（PC）実装計画

株主優待のクロス取引運用を効率化するため、PC 向けの統合ダッシュボード `yutai-dashboard` を段階実装する計画。

## 目的

- 月次優待候補の発掘（ピック / パス / 優待メモ追加）と、登録済み銘柄の運用管理（仕込み・クロス戦略・実績確認）を、PC の広い画面で 1 つのテーブルから行えるようにする。
- 既存ツールに分散している次の情報を銘柄単位で結合表示する。
  - 日興 一般信用の扱い状態（`/nikko/credit`、`available_shares` 基準の badge 判定）
  - SBI 短期売り対象の扱い有無（`is_short` のみ。在庫状態は使わない）
  - 仕込み時期（`preparationMonthsBefore` + 自由文 `entryTiming`）
  - 1株保有開始時期（`oneShareStartedAt`）
  - クロス購入実績（取得済みアーカイブ `ArchivedMemoItem`）
  - クロス戦略（`crossType`）

## 位置づけと棲み分け

- `yutai-dashboard` は月次候補の**全銘柄**を表示する PC 向けテーブル画面。発掘と運用管理の両方をカバーする。
- 既存の `yutai-candidates` はスマホ向けカード UI として残す。縮小・廃止は本ダッシュボード定着後に別途判断する。
- ピック / パスの状態は `yutai-candidates` と同じ LocalStorage キー（`monthly_yutai_picks_v1` / `monthly_yutai_passes_v1`）を共有し、両画面で整合させる。
- 仕込み月軸の対象は「優待メモ登録済み ＋ 構造化した仕込み時期設定済み」に限定する既存決定（[2026-07-03 仕込み月表示軸](../decision-log/2026-07-03-yutai-preparation-month-axis.md)）を維持する。全候補が並ぶのは権利月軸のときのみ。

## 画面構成（Phase 1 時点）

- URL: `/tools/yutai-dashboard`
- 上部フィルタ: 対象月、表示軸（権利月 / 仕込み月）、状態（全部 / 登録済み / ピック済み / パス済み / 未選択）、日興、SBI、クロス戦略、テキスト検索
- テーブル列: コード / 銘柄名 / 権利月 / 日興 badge / SBI badge / 仕込み開始 / 1株開始 / クロス戦略 / 実績
- 行の種類ごとの表示:

| 行の種類 | 表示 |
|---|---|
| メモ登録済み | 全列表示。詳細パネルからメモ参照（Phase 2 で編集） |
| ピック済み（未登録） | ピック badge ＋「メモへ追加」。メモ系列は空 |
| 未選択 | 候補情報 ＋ 日興 / SBI 列 ＋ ピック / パス / 追加操作 |
| パス済み | 灰色表示。フィルタで非表示にできる |

- 行クリックで右サイドパネルに詳細を表示する: メモ全文、`entryTiming` 自由文、規制明細、実績履歴（年別）、みんかぶ / 公式リンク。
- 一覧セルは badge・短語に留め、長文・明細はサイドパネル側に寄せる。

## データ取得

新規データ取得は行わず、既存経路を再利用する。

| データ | 取得元 | 経路 |
|---|---|---|
| 月次候補 / 日興信用 / SBI 信用 | `MARKET_INFO_API_BASE_URL` | `yutai-candidates/data-loader.ts` の loader を共用（SSR） |
| 優待メモ / 取得実績 | LocalStorage | `yutai-memo/storage.ts` を ClientOnly パターンで読む |
| ピック / パス状態 | LocalStorage | `yutai-candidates` と同一キーを共用 |

fallback・キャッシュ方針は [Market Tools データ取得経路一覧](../specs/cross-cutting/market-tools-data-fetch-paths.md) に従う。

## フェーズ計画

### Phase 1: 共有ロジック抽出 + 表ビュー本体

PR を 2 本に分ける。

1. **共有ロジック抽出 PR**（リファクタのみ、挙動変更なし）
   - `yutai-candidates/ToolClient.tsx` から次を共有モジュールへ抽出する。
     - ピック / パス状態の LocalStorage 読み書き
     - 優待メモ追加（`candidate-import` 連携部分）
     - 日興信用 badge 判定（一般可 / 一般注意 / 一般停止 / 一般× / 制度可）
     - SBI badge 判定（`is_short` のみ）
   - 置き場所は `app/tools/_shared/` を基本とし、UI 非依存の純ロジックは `lib/` を検討する。
2. **ダッシュボード新画面 PR**
   - `app/tools/yutai-dashboard/` を新設（page / ToolClient / data-loader 共用）。
   - テーブル、フィルタ、行クリック詳細パネル、ピック / パス / メモ追加操作。
   - `lib/tools-catalog.ts` への登録、Tool Spec / UAT の追加。

### Phase 2: 詳細パネルからのメモ編集（実装済み 2026-07-07）

- 詳細パネルでメモ本文・任期条件・早打ち目安・取得済み状態・仕込み開始・1株保有開始・クロス戦略・優先度・関連リンク・銘柄名を編集できるようにした。
- 更新ロジックは UI 非依存の純関数として `app/tools/_shared/yutai-memo-edit.ts`（`buildMemoEditDraft` / `applyMemoEdit`）へ切り出し、単体テストを付けた。
- 全月表示にも対応した対象月「全月」（`?month=all`）と銘柄列幅の縮小は Phase 1 後のフィードバックで対応済み。
- 追加後の Phase 2 対象として、後日 `yutai-candidates` 側の重複メモ編集ロジックも `yutai-memo-edit` へ寄せる余地がある（今回は未実施）。

### Phase 3: 横スクロール 12 ヶ月ビュー（実装済み 2026-07-11）

- 「テーブル / 12ヶ月ビュー」のタブ切替を追加した。12ヶ月ビューは登録済みメモを対象に、銘柄 × 12 ヶ月のガント風グリッドを表示する。
- 各銘柄について、仕込み開始月（仕）〜権利月（権）を帯で表示し、取得済みの権利月には ✓（緑）を付ける。帯は年をまたいで循環する。
- 日興 / SBI のような当日変動値は 12 ヶ月グリッドに載せず、テーブルビュー側の担当とした。
- 検索・クロス戦略フィルタは 12ヶ月ビューにも効く。銘柄名列は横スクロール時に固定。

## 対象環境

- PC の Chrome を前提にした幅広テーブルレイアウト（利用端末は Android + Windows、いずれも Chrome）。
- スマホ最適化は行わない。スマホでの発掘作業は `yutai-candidates` を使う。

## 完了・継続の判断

- Phase 1 完了時点で「PC での月次ピック作業がカード UI より速いか」を実運用で確認する。
- 定着しない場合、Phase 2 以降へ進む前に本計画を見直す。

## 関連 docs

- Decision Log: [2026-07-05 優待統合ダッシュボードの位置づけ](../decision-log/2026-07-05-yutai-dashboard-positioning.md)
- Decision Log: [2026-07-03 優待の仕込み月表示軸](../decision-log/2026-07-03-yutai-preparation-month-axis.md)
- Decision Log: [2026-04-05 yutai-candidates の SBI 短期対象表示ルール](../decision-log/2026-04-05-yutai-candidates-sbi-short-handling.md)
- Cross-cutting: [Market Tools データ取得経路一覧](../specs/cross-cutting/market-tools-data-fetch-paths.md)
- Tool Spec: [優待銘柄メモ帳 仕様](../specs/tools/yutai-memo.md)
