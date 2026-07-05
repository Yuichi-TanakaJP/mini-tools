# 2026-07-05 優待統合ダッシュボードの位置づけ

## 背景

優待クロスの運用に必要な情報（日興一般信用の扱い、SBI 短期対象、仕込み時期、1株保有開始、クロス実績、クロス戦略）が `yutai-candidates` と `yutai-memo` に分散しており、PC の広い画面で一覧しながらピック・運用判断を行う画面がなかった。

## 決めたこと

- PC 向けの統合ダッシュボード `yutai-dashboard` を独立ツールとして新設する。
- ダッシュボードは月次候補の全銘柄を表示し、発掘（ピック / パス / 優待メモ追加）と運用管理（仕込み・戦略・実績の確認）の両方を担う。登録済み銘柄だけに限定しない。
- 表示形式は表（テーブル）を主とし、行クリックの詳細パネルに長文・明細を寄せる。横スクロールの 12 ヶ月ビューは後続フェーズの補助ビューとする。
- ピック / パス状態は `yutai-candidates` と同じ LocalStorage キー（`monthly_yutai_picks_v1` / `monthly_yutai_passes_v1`）を共有する。
- `yutai-candidates` はスマホ向けカード UI として残す。縮小・廃止はダッシュボード定着後に別途判断する。
- 仕込み月軸の対象限定ルール（2026-07-03 決定）は変更しない。全候補が並ぶのは権利月軸のみ。
- ピック / パス / メモ追加と日興・SBI badge 判定のロジックは、実装前に `yutai-candidates` から共有モジュールへ抽出する。

## 理由

- 必要な 6 項目はすべて既存データ（yutai-memo の LocalStorage、`/nikko/credit`、SBI 信用 JSON、月次候補 JSON）で揃うため、新規データ取得ではなく結合ビューとして作るのが最小コスト。
- 見たい属性の多くは「月」ではなく「銘柄」に付くため、行 = 銘柄の表がソート・フィルタと相性がよい。日興 / SBI のような当日変動値を 12 ヶ月グリッドに載せると意味が曖昧になる。
- 当初は「ダッシュボード = 登録済み銘柄の運用画面、candidates = 発掘画面」と分ける案だったが、ユーザーの運用ではダッシュボード上でもピック・パス・メモ追加を行いたいため、機能を包含する形に変更した。状態フィルタで「登録済みのみ」に絞れば運用画面としても使える。
- `yutai-candidates/ToolClient.tsx` は約 1,900 行あり、テーブルビューを同居させると保守が苦しいため独立ツールとした。

## 影響範囲

- `app/tools/yutai-dashboard/`（新設）
- `app/tools/yutai-candidates/`（共有ロジック抽出のリファクタ）
- `app/tools/_shared/` または `lib/`（抽出先）
- `lib/tools-catalog.ts`
- `docs/plans/yutai-dashboard-plan.md`

## 関連

- Issue:
- PR:
- 参照 docs:
  - [優待統合ダッシュボード（PC）実装計画](../plans/yutai-dashboard-plan.md)
  - [2026-07-03 優待の仕込み月表示軸](./2026-07-03-yutai-preparation-month-axis.md)
  - [2026-04-05 yutai-candidates の SBI 短期対象表示ルール](./2026-04-05-yutai-candidates-sbi-short-handling.md)
