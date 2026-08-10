# ルーティン一覧 仕様

## 概要

- URL: `/premium/routines`
- 分類: 運用可視化（市場データ系でも入力系でもない）
- 主な用途: いま自分が回している定期作業の総量を、週間タイムテーブルで一枚に把握する
- 目的: 日々浴びている情報量の現状を把握し、減らす・まとめる・自動化する対策の判断材料にする
  （経緯は [decision-log](../../decision-log/2026-08-08-routines-static-inventory.md) を参照）

実行実績のログではなく、**棚卸しした時点の設定内容**を静的に表示するツールです。
「今日やったか」を記録する機能は持ちません。

## 対象ユーザー

- リポジトリ運用者本人（自分の作業量の可視化が目的）
- 公開ツール一覧には載せない。詳細は [公開範囲](#公開範囲) を参照

## 画面仕様

### 主な画面要素

1. **サマリータイル**（4枚）
   - 週あたりの実行回数 / 月あたりの実行回数 / 登録ルーティン数（mode 別内訳） / 不定期件数
2. **週間タイムテーブル**
   - 縦軸 = 時刻、横軸 = 月〜日の 7 列
   - `daily` / `weekday` / `weekly` のルーティンだけを並べる
   - 実行時刻を決めていないものは最下段の「時刻未定」行に置く
   - 8 列あるため、狭い画面では表を横スクロールさせる（`minWidth: 980`）
3. **月次セクション**
   - `monthly` のルーティンを実行日の早い順に並べる
   - 連続した実行日は `3〜10日` の範囲表記、飛び飛びなら `1・15日` の中黒表記
4. **不定期セクション**
   - `adhoc` のルーティンを並べる

### 実行モード

| mode | 表示 | 意味 |
|---|---|---|
| `auto` | 🤖 自動（青） | Windows タスクスケジューラ等で無人実行される |
| `semi` | ⚡ 半自動（黄） | リマインダーが飛んできて、自分で実行する |
| `manual` | ✋ 手動（緑） | 完全に自分の意思で起動する |

### 入力

- なし。操作要素を持たない静的表示のみ

### 出力

- 上記の 4 セクション。状態を持たないため Server Component のまま描画する

## データ仕様

### 取得元

- [`app/premium/routines/data/routines.ts`](../../../app/premium/routines/data/routines.ts) の静的定義のみ
- API 呼び出しなし、外部データ取得なし

定義の出所は次の 2 つで、**取り込みは自動化しない**。

| mode | 出所 |
|---|---|
| `auto` / `semi` | Windows タスクスケジューラの登録内容（`market_info/scripts/register_tasks.ps1` ほか） |
| `manual` | 各リポジトリの `.claude/skills/*/SKILL.md`、`market_info/docs/operations/{daily,monthly}_operations.md`、および本人への確認 |

コードを伴わない目視確認（証券口座の入金確認など）は `repo` を持たない。

### 保存先

- なし。LocalStorage も使わない

### fallback

- 外部依存がないため fallback の概念を持たない

## 集計ルール

[`timetable.ts`](../../../app/premium/routines/timetable.ts) の純関数で計算する。

- **週あたりの実行回数** = 対象曜日数 × 時刻数。時刻未設定なら 1 回として数える
- **月あたりの実行回数** = `monthly` の時刻数。`3〜10日` のような複数日指定は
  「成功するまでの再試行枠」なので **1 回**として数える
- `adhoc` はどちらの回数にも含めず、件数だけ数える

## 状態・エラー表示

| 状態 | 表示・挙動 |
|---|---|
| 初回表示 | 常に全件表示。ローディングなし |
| データなし | 定義が空なら各セクションが空リストになる（異常系として扱わない） |
| 取得失敗 | 外部取得がないため発生しない |
| 保存失敗 | 保存を行わないため発生しない |

## 公開範囲

個人の作業内容の棚卸しであり、一般利用者向けの機能ではないため次のようにする。

- premium 配下に置き、Cookie セッションでゲートする（下記「premium / 権限制御」）
- [`lib/tools-catalog.ts`](../../../lib/tools-catalog.ts) に登録しない（公開ツール一覧とナビドロワーに出さない）
- [`app/sitemap.ts`](../../../app/sitemap.ts) に追加しない
- ページの `metadata.robots` を `index: false, follow: false` にする

旧 URL `/tools/routines` は [`next.config.js`](../../../next.config.js) の `redirects()` で
`/premium/routines` へ 308 リダイレクトする。

## premium / 権限制御

他の premium ページと同じ方式にする。

- `PREMIUM_COOKIE_NAME` の Cookie を [`verifyPremiumSession`](../../../lib/premium-auth.ts) で検証する
- 未ログインなら `/premium/login?next=/premium/routines` へ redirect する
- 到達導線は [Premium ホーム](../../../app/premium/page.tsx) のカード。直接 URL でも入れる
- `next` パラメータは `getSafePremiumNextPath` の許可リスト（`/premium` 配下）に含まれる

## 更新運用

設定を変えたら定義ファイルも更新する。棚卸しした日付は
`ROUTINES_SURVEYED_ON` に入れ、画面のチップに表示する。

実機の登録内容は次で確認できる。

```powershell
Get-ScheduledTask -TaskPath '\market_info\','\' | ForEach-Object {
  $_ | Select-Object TaskName, @{n='Trigger';e={$_.Triggers}}, @{n='Action';e={$_.Actions}}
}
```

## 関連実装

- [app/premium/routines/page.tsx](../../../app/premium/routines/page.tsx)
- [app/premium/routines/RoutinesView.tsx](../../../app/premium/routines/RoutinesView.tsx)
- [app/premium/routines/timetable.ts](../../../app/premium/routines/timetable.ts)
- [app/premium/routines/types.ts](../../../app/premium/routines/types.ts)
- [app/premium/routines/data/routines.ts](../../../app/premium/routines/data/routines.ts)
- [app/premium/routines/__tests__/timetable.test.ts](../../../app/premium/routines/__tests__/timetable.test.ts)

## 関連 docs

- Decision Log: [2026-08-08 ルーティン可視化を静的棚卸しにする](../../decision-log/2026-08-08-routines-static-inventory.md)
